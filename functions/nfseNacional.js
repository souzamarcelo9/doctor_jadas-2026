/**
 * NFS-e Padrão Nacional (Sefin Nacional) — emissão para contribuintes do
 * Simples Nacional, obrigatória em São Paulo a partir de 01/11/2026
 * (Resoluções CGSN 189 e 191/2026).
 *
 * Funções puras (montagem/assinatura/compactação) + o cliente HTTP da API.
 * Fontes: XSD v1.01 (DPS_v1.01.xsd), Anexo I (leiaute e regras de negócio
 * da DPS) e o Swagger "API NFS-e - Sefin Nacional".
 *
 * Fluxo: monta a DPS → assina (XMLDSig) → GZip + base64 →
 * POST /nfse { dpsXmlGZipB64 } (síncrono) com TLS mútuo (certificado A1).
 */

const zlib = require("zlib");
const https = require("https");
const axios = require("axios");
const { SignedXml } = require("xml-crypto");

const VERSAO_LEIAUTE = "1.01";
const NS_NFSE = "http://www.sped.fazenda.gov.br/nfse";
const SERIE_PADRAO = "00001"; // faixa 00001–49999 = aplicativo próprio (Anexo I)
const VER_APLIC = "DoctorJADS-1.0";

// cTribNac = 6 dígitos (item + subitem + desdobro). 04.01.01 = "Medicina".
const CTRIBNAC_MEDICINA = "040101";

const URLS = {
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional",
  producao: "https://sefin.nfse.gov.br/SefinNacional",
};

const ALGORITMOS = {
  sha1: {
    assinatura: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    digest: "http://www.w3.org/2000/09/xmldsig#sha1",
  },
  sha256: {
    assinatura: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    digest: "http://www.w3.org/2001/04/xmlenc#sha256",
  },
};
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

const apenasDigitos = (v) => String(v ?? "").replace(/\D/g, "");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Texto livre: tira caracteres de controle e espaços repetidos (o XSD não
 * aceita quebras de linha/tabs soltos em xDescServ). */
function textoLivre(s, max) {
  const limpo = String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return limpo.slice(0, max);
}

/** Data/hora de São Paulo (UTC-03:00, sem horário de verão desde 2019) no
 * formato do XSD, com `recuoSegundos` de folga — a Sefin rejeita DPS com
 * data de emissão no futuro em relação ao relógio dela. */
function agoraSaoPaulo(agora = new Date(), recuoSegundos = 60) {
  const t = new Date(agora.getTime() - recuoSegundos * 1000 - 3 * 3600 * 1000);
  const iso = t.toISOString(); // já deslocado em -3h, então "Z" é só a mesma hora de parede
  return { dhEmi: `${iso.slice(0, 19)}-03:00`, data: iso.slice(0, 10) };
}

/** Identificador de 45 posições: DPS + cLocEmi(7) + tipoInsc(1: 1=CPF, 2=CNPJ)
 * + inscrição(14) + série(5) + nDPS(15). */
function montarIdDps({ cLocEmi, cnpj, serie, nDPS }) {
  const doc = apenasDigitos(cnpj);
  const tipo = doc.length === 11 ? "1" : "2";
  return `DPS${apenasDigitos(cLocEmi).padStart(7, "0")}${tipo}${doc.padStart(14, "0")}${String(serie).padStart(5, "0")}${String(nDPS).padStart(15, "0")}`;
}

function dec2(n) {
  return Number(n).toFixed(2);
}

/**
 * Monta o XML da DPS (sem assinatura) para prestador ME/EPP (opSimpNac = 3).
 *
 * Regras do Anexo I que este montador respeita:
 *  - regApTribSN obrigatório para ME/EPP (E0166); 1 = tudo apurado pelo SN.
 *  - pAliq NÃO é informado quando a apuração é pelo SN (E0600).
 *  - totTrib obrigatório; para ME/EPP só vale pTotTribSN (E0712 veta indTotTrib).
 *  - regEspTrib = 0 quando a apuração é pelo SN (E0175).
 *  - sem dedução/redução/benefício municipal para quem apura pelo SN.
 *  - IBS/CBS só é aceito a partir da competência 01/01/2027 (E0850) — não vai.
 *  - finNFSe (0 = NFS-e regular) é exigido logo após tpEmit pelo esquema em uso na
 *    Sefin Nacional (SefinNacional_1.6.0), mais novo que o XSD v1.01 de 09/02/2026:
 *    descoberto pelo erro E1235 em produção restrita.
 */
function montarDpsXml(p) {
  const cnpj = apenasDigitos(p.cnpj);
  if (cnpj.length !== 14) throw new Error("CNPJ do prestador inválido.");
  const cLocEmi = apenasDigitos(p.cLocEmi);
  if (cLocEmi.length !== 7) throw new Error("Código IBGE do município emissor inválido.");
  const cTribNac = apenasDigitos(p.cTribNac || CTRIBNAC_MEDICINA);
  if (cTribNac.length !== 6) throw new Error("Código de tributação nacional deve ter 6 dígitos (ex.: 040101).");
  const valor = Number(p.valor);
  if (!(valor > 0)) throw new Error("Valor do serviço inválido.");
  const nDPS = Number(p.nDPS);
  if (!Number.isInteger(nDPS) || nDPS < 1) throw new Error("Número da DPS inválido.");
  const serie = String(Number(p.serie ?? SERIE_PADRAO)); // XSD: ^0{0,4}\d{1,5}$ — sem zeros à esquerda no elemento
  const id = montarIdDps({ cLocEmi, cnpj, serie, nDPS });

  const regApTribSN = p.regApTribSN || 1;
  const pTotTribSN = Number(p.pTotTribSN);
  if (!(pTotTribSN >= 0 && pTotTribSN < 100)) throw new Error("Percentual aproximado de tributos do Simples (pTotTribSN) inválido.");

  const tomaDoc = apenasDigitos(p.tomador?.cpfCnpj);
  const tomaNome = textoLivre(p.tomador?.nome, 150);
  const tomaFone = apenasDigitos(p.tomador?.fone);
  const tomaEmail = String(p.tomador?.email || "").trim();
  const temTomador = (tomaDoc.length === 11 || tomaDoc.length === 14) && tomaNome;
  const toma = temTomador
    ? `
      <toma>
        <${tomaDoc.length === 14 ? "CNPJ" : "CPF"}>${tomaDoc}</${tomaDoc.length === 14 ? "CNPJ" : "CPF"}>
        <xNome>${esc(tomaNome)}</xNome>${tomaFone.length >= 6 && tomaFone.length <= 20 ? `
        <fone>${tomaFone}</fone>` : ""}${tomaEmail && tomaEmail.length <= 80 ? `
        <email>${esc(tomaEmail)}</email>` : ""}
      </toma>`
    : "";

  const im = apenasDigitos(p.inscricaoMunicipal);
  const descricao = textoLivre(p.descricao, 1000);
  if (!descricao) throw new Error("A discriminação do serviço é obrigatória.");

  return `<DPS xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}"><infDPS Id="${id}"><tpAmb>${p.ambiente === "producao" ? 1 : 2}</tpAmb><dhEmi>${p.dhEmi}</dhEmi><verAplic>${VER_APLIC}</verAplic><serie>${serie}</serie><nDPS>${nDPS}</nDPS><dCompet>${p.dCompet}</dCompet><tpEmit>1</tpEmit><finNFSe>0</finNFSe><cLocEmi>${cLocEmi}</cLocEmi><prest><CNPJ>${cnpj}</CNPJ>${im && im.length <= 15 ? `<IM>${im}</IM>` : ""}<regTrib><opSimpNac>3</opSimpNac><regApTribSN>${regApTribSN}</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>${toma.replace(/\n\s*/g, "")}<serv><locPrest><cLocPrestacao>${apenasDigitos(p.cLocPrestacao || cLocEmi)}</cLocPrestacao></locPrest><cServ><cTribNac>${cTribNac}</cTribNac><xDescServ>${esc(descricao)}</xDescServ></cServ></serv><valores><vServPrest><vServ>${dec2(valor)}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${p.issRetido ? 2 : 1}</tpRetISSQN></tribMun><totTrib><pTotTribSN>${dec2(pTotTribSN)}</pTotTribSN></totTrib></trib></valores></infDPS></DPS>`;
}

/** Primeiro certificado de um PEM com cadeia (o do titular, na ordem que
 * extrairPemDoPfx devolve). */
function primeiroCertPem(certPem) {
  const m = String(certPem).match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!m) throw new Error("Certificado inválido.");
  return m[0];
}

/** Assina um elemento por Id (enveloped, C14N) e anexa <Signature> como
 * último filho da raiz. DPS: infDPS dentro de DPS. Pedido de evento:
 * infPedReg dentro de pedRegEvento. */
function assinarElemento(xml, { elemento, raiz }, privateKeyPem, certPem, algoritmo = "sha1") {
  const alg = ALGORITMOS[algoritmo];
  if (!alg) throw new Error(`Algoritmo de assinatura desconhecido: ${algoritmo}`);
  const id = xml.match(new RegExp(`<${elemento}[^>]*\\sId="([^"]+)"`))?.[1];
  if (!id) throw new Error(`${elemento} sem Id.`);
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: primeiroCertPem(certPem),
    signatureAlgorithm: alg.assinatura,
    canonicalizationAlgorithm: C14N,
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${elemento}']`,
    uri: `#${id}`,
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", C14N],
    digestAlgorithm: alg.digest,
  });
  sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${raiz}']`, action: "append" } });
  return sig.getSignedXml();
}

const assinarDps = (xml, key, cert, algoritmo) => assinarElemento(xml, { elemento: "infDPS", raiz: "DPS" }, key, cert, algoritmo);
const assinarPedidoEvento = (xml, key, cert, algoritmo) => assinarElemento(xml, { elemento: "infPedReg", raiz: "pedRegEvento" }, key, cert, algoritmo);

/**
 * Pedido de registro do evento de cancelamento (e101101).
 * Id = "PRE" + chave de acesso (50) + código do evento (101101) = 59 posições.
 * Assinatura obrigatória (Anexo II). cMotivo: 1 erro na emissão, 2 serviço
 * não prestado, 9 outros. xMotivo: 15 a 255 caracteres.
 */
function montarPedidoCancelamentoXml({ ambiente, dhEvento, cnpjAutor, chaveAcesso, cMotivo, xMotivo }) {
  const chave = apenasDigitos(chaveAcesso);
  if (chave.length !== 50) throw new Error("Chave de acesso da NFS-e inválida (precisa ter 50 dígitos).");
  const cnpj = apenasDigitos(cnpjAutor);
  if (cnpj.length !== 14) throw new Error("CNPJ do autor inválido.");
  if (!["1", "2", "9"].includes(String(cMotivo))) throw new Error("Justificativa de cancelamento inválida.");
  const motivo = textoLivre(xMotivo, 255);
  if (motivo.length < 15) throw new Error("Descreva o motivo do cancelamento com pelo menos 15 caracteres.");
  return `<pedRegEvento xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}"><infPedReg Id="PRE${chave}101101"><tpAmb>${ambiente === "producao" ? 1 : 2}</tpAmb><verAplic>${VER_APLIC}</verAplic><dhEvento>${dhEvento}</dhEvento><CNPJAutor>${cnpj}</CNPJAutor><chNFSe>${chave}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>${cMotivo}</cMotivo><xMotivo>${esc(motivo)}</xMotivo></e101101></infPedReg></pedRegEvento>`;
}

/** GZip + base64 do XML em UTF-8 (padrão de troca da API). A Sefin só aceita
 * se o XML declarar a codificação (E1229 "XML não está utilizando codificação
 * UTF-8" quando a declaração falta) e sem prefixo de namespace (E1228). A
 * declaração fica fora do elemento assinado, então não altera a assinatura. */
const DECLARACAO_XML = '<?xml version="1.0" encoding="UTF-8"?>';
function compactarXml(xml) {
  const comDeclaracao = /^\s*<\?xml/i.test(xml) ? xml : DECLARACAO_XML + xml;
  return zlib.gzipSync(Buffer.from(comDeclaracao, "utf8")).toString("base64");
}

function descompactarXml(b64) {
  return zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

/** A Sefin devolve a lista de erros em JSON, mas a capitalização das chaves
 * (codigo/Codigo) e o formato (array, objeto único, texto) variam entre as
 * rotas — normaliza tudo para { codigo, descricao, complemento }. */
function normalizarErros(bruto) {
  const itens = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];
  return itens
    .map((e) => {
      if (typeof e === "string") return { codigo: "", descricao: e, complemento: "" };
      if (!e || typeof e !== "object") return null;
      const pega = (...nomes) => {
        for (const k of Object.keys(e)) if (nomes.includes(k.toLowerCase()) && e[k] != null && e[k] !== "") return String(e[k]);
        return "";
      };
      const codigo = pega("codigo", "code", "cod");
      const descricao = pega("descricao", "mensagem", "message", "msg", "detail", "title");
      const complemento = pega("complemento", "detalhe", "detalhes");
      return codigo || descricao || complemento ? { codigo, descricao, complemento } : { codigo: "", descricao: JSON.stringify(e).slice(0, 400), complemento: "" };
    })
    .filter(Boolean);
}

/** Erros da resposta HTTP: tenta `erros`, `erro`, `errors`, e por fim o corpo inteiro. */
function extrairErrosDaResposta(corpo) {
  if (corpo && typeof corpo === "object") {
    const lista = normalizarErros(corpo.erros || corpo.erro || corpo.errors || corpo.Erros || corpo.Erro);
    if (lista.length) return lista;
    if (corpo.mensagem || corpo.message || corpo.title) return normalizarErros(corpo);
  }
  return [];
}

function brutoDaResposta(corpo) {
  const t = typeof corpo === "string" ? corpo : JSON.stringify(corpo ?? "");
  return String(t).slice(0, 2000);
}

/** Texto curto a partir da lista de erros da Sefin. */
function resumirErros(erros, http) {
  const lista = normalizarErros(erros);
  if (!lista.length) return `A Sefin Nacional rejeitou o pedido sem detalhar o motivo${http ? ` (HTTP ${http})` : ""}.`;
  return lista
    .map((e) => [e.codigo, e.descricao].filter(Boolean).join(" — ") + (e.complemento ? ` (${e.complemento})` : ""))
    .join(" | ");
}

function agentMtls(keyPem, certPem) {
  return new https.Agent({ key: keyPem, cert: certPem, minVersion: "TLSv1.2" });
}

async function chamarSefin({ ambiente, metodo, caminho, corpo, keyPem, certPem, timeout = 30000 }) {
  const url = `${URLS[ambiente === "producao" ? "producao" : "homologacao"]}${caminho}`;
  const resp = await axios.request({
    method: metodo,
    url,
    data: corpo,
    httpsAgent: agentMtls(keyPem, certPem),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout,
    validateStatus: () => true, // 400/403 trazem a lista de erros em JSON — é resposta válida, não exceção
  });
  return { http: resp.status, corpo: resp.data };
}

/** Envia a DPS já assinada. Devolve { ok, http, chaveAcesso, nfseXml, alertas, erros }. */
async function enviarDps({ ambiente, dpsAssinadaXml, keyPem, certPem }) {
  const { http, corpo } = await chamarSefin({
    ambiente, metodo: "POST", caminho: "/nfse", keyPem, certPem,
    corpo: { dpsXmlGZipB64: compactarXml(dpsAssinadaXml) },
  });
  if (http === 201 && corpo?.nfseXmlGZipB64) {
    return {
      ok: true, http,
      idDps: corpo.idDps,
      chaveAcesso: corpo.chaveAcesso,
      nfseXml: descompactarXml(corpo.nfseXmlGZipB64),
      alertas: corpo.alertas || [],
    };
  }
  return { ok: false, http, erros: extrairErrosDaResposta(corpo), bruto: brutoDaResposta(corpo) };
}

/** Envia o pedido de evento (já assinado) para uma NFS-e.
 * Devolve { ok, http, eventoXml, erros }. */
async function enviarEvento({ ambiente, chaveAcesso, pedidoAssinadoXml, keyPem, certPem }) {
  const { http, corpo } = await chamarSefin({
    ambiente, metodo: "POST", caminho: `/nfse/${apenasDigitos(chaveAcesso)}/eventos`, keyPem, certPem,
    corpo: { pedidoRegistroEventoXmlGZipB64: compactarXml(pedidoAssinadoXml) },
  });
  if (http === 201 && corpo?.eventoXmlGZipB64) {
    return { ok: true, http, eventoXml: descompactarXml(corpo.eventoXmlGZipB64) };
  }
  return { ok: false, http, erros: extrairErrosDaResposta(corpo), bruto: brutoDaResposta(corpo) };
}

/** Recupera a nota de uma DPS já enviada (resposta perdida, timeout...).
 * Evita emitir duas vezes: consulta pelo Id da DPS e, se existir, busca a NFS-e. */
async function consultarPorIdDps({ ambiente, idDps, keyPem, certPem }) {
  const r = await chamarSefin({ ambiente, metodo: "GET", caminho: `/dps/${idDps}`, keyPem, certPem });
  if (r.http === 404) return { encontrada: false };
  if (r.http !== 200 || !r.corpo?.chaveAcesso) return { encontrada: false, http: r.http, erros: r.corpo?.erro ? [r.corpo.erro] : [] };
  const n = await chamarSefin({ ambiente, metodo: "GET", caminho: `/nfse/${r.corpo.chaveAcesso}`, keyPem, certPem });
  if (n.http !== 200 || !n.corpo?.nfseXmlGZipB64) return { encontrada: true, chaveAcesso: r.corpo.chaveAcesso, nfseXml: null };
  return { encontrada: true, chaveAcesso: r.corpo.chaveAcesso, nfseXml: descompactarXml(n.corpo.nfseXmlGZipB64) };
}


// ---------------------------------------------------------------------
// API de Parâmetros Municipais (ADN) — o que cada município habilitou
// ---------------------------------------------------------------------
const URLS_PARAMETROS = {
  homologacao: "https://adn.producaorestrita.nfse.gov.br/parametrizacao",
  producao: "https://adn.nfse.gov.br/parametrizacao",
};

/** Subitens do item 4 (saúde) da lista nacional, com o código de 6 dígitos. */
const CODIGOS_SAUDE = [
  ["040101", "Medicina"], ["040102", "Biomedicina"],
  ["040201", "Análises clínicas e congêneres"], ["040202", "Patologia e congêneres"],
  ["040203", "Eletricidade médica e congêneres"], ["040204", "Radioterapia, quimioterapia e congêneres"],
  ["040205", "Ultrassonografia, ressonância, radiologia, tomografia e congêneres"],
  ["040301", "Hospitais e congêneres"], ["040302", "Laboratórios e congêneres"],
  ["040303", "Clínicas, sanatórios, ambulatórios e congêneres"],
  ["040401", "Instrumentação cirúrgica"], ["040501", "Acupuntura"],
  ["040601", "Enfermagem e serviços auxiliares"], ["040701", "Serviços farmacêuticos"],
  ["040801", "Terapia ocupacional"], ["040802", "Fisioterapia"], ["040803", "Fonoaudiologia"],
  ["040901", "Terapias físicas, orgânicas e mentais"], ["041001", "Nutrição"],
  ["041101", "Obstetrícia"], ["041201", "Odontologia"], ["041301", "Ortóptica"],
  ["041401", "Próteses sob encomenda"], ["041501", "Psicanálise"], ["041601", "Psicologia"],
  ["041801", "Inseminação artificial e fertilização in vitro"],
  ["042001", "Coleta de sangue e materiais biológicos"],
  ["042101", "Unidade de atendimento móvel e congêneres"],
];

async function chamarParametros({ ambiente, caminho, keyPem, certPem, timeout = 20000 }) {
  const url = `${URLS_PARAMETROS[ambiente === "producao" ? "producao" : "homologacao"]}${caminho}`;
  const resp = await axios.request({
    method: "GET", url,
    httpsAgent: agentMtls(keyPem, certPem),
    headers: { Accept: "application/json" },
    timeout,
    validateStatus: () => true,
  });
  return { http: resp.status, corpo: resp.data };
}

/** Consulta o convênio do município e, para cada código de saúde, se há
 * alíquota parametrizada (= código administrado pelo município). */
async function consultarCodigosHabilitados({ ambiente, codigoMunicipio, competencia, keyPem, certPem }) {
  const mun = apenasDigitos(codigoMunicipio);
  const conv = await chamarParametros({ ambiente, caminho: `/${mun}/convenio`, keyPem, certPem }).catch((e) => ({ http: 0, corpo: { mensagem: e.message } }));
  const convenio = {
    http: conv.http,
    mensagem: conv.corpo?.mensagem || null,
    parametros: conv.corpo?.parametrosConvenio || null,
  };

  const codigos = [];
  const fila = [...CODIGOS_SAUDE];
  const trabalhar = async () => {
    while (fila.length) {
      const [codigo, descricao] = fila.shift();
      try {
        const r = await chamarParametros({ ambiente, caminho: `/${mun}/${codigo}/${competencia}/aliquota`, keyPem, certPem });
        const mapa = r.corpo?.aliquotas && typeof r.corpo.aliquotas === "object" ? r.corpo.aliquotas : {};
        const aliquotas = Object.values(mapa).flat();
        codigos.push({
          codigo, descricao, http: r.http,
          habilitado: r.http === 200 && aliquotas.length > 0,
          aliquotas: aliquotas.slice(0, 3).map((a) => ({ aliq: a.Aliq ?? a.aliq ?? null, incidencia: a.Incidencia ?? a.incidencia ?? null })),
          mensagem: r.corpo?.mensagem || null,
        });
      } catch (e) {
        codigos.push({ codigo, descricao, http: 0, habilitado: false, aliquotas: [], mensagem: e.message });
      }
    }
  };
  await Promise.all([trabalhar(), trabalhar(), trabalhar(), trabalhar()]);
  codigos.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { convenio, codigos };
}

/** Campos úteis do XML da NFS-e devolvido (número e data de processamento). */
function extrairDadosNfse(nfseXml) {
  const pega = (tag) => nfseXml?.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() || null;
  return { nNFSe: pega("nNFSe"), dhProc: pega("dhProc"), cStat: pega("cStat") };
}

module.exports = {
  VERSAO_LEIAUTE, SERIE_PADRAO, CTRIBNAC_MEDICINA, URLS, URLS_PARAMETROS, CODIGOS_SAUDE,
  montarIdDps, montarDpsXml, assinarDps, assinarPedidoEvento, assinarElemento, montarPedidoCancelamentoXml, enviarEvento, compactarXml, descompactarXml,
  resumirErros, normalizarErros, consultarCodigosHabilitados, enviarDps, consultarPorIdDps, extrairDadosNfse, agoraSaoPaulo,
};
