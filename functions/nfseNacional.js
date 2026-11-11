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

  return `<DPS xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}"><infDPS Id="${id}"><tpAmb>${p.ambiente === "producao" ? 1 : 2}</tpAmb><dhEmi>${p.dhEmi}</dhEmi><verAplic>${VER_APLIC}</verAplic><serie>${serie}</serie><nDPS>${nDPS}</nDPS><dCompet>${p.dCompet}</dCompet><tpEmit>1</tpEmit><cLocEmi>${cLocEmi}</cLocEmi><prest><CNPJ>${cnpj}</CNPJ>${im && im.length <= 15 ? `<IM>${im}</IM>` : ""}<regTrib><opSimpNac>3</opSimpNac><regApTribSN>${regApTribSN}</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>${toma.replace(/\n\s*/g, "")}<serv><locPrest><cLocPrestacao>${apenasDigitos(p.cLocPrestacao || cLocEmi)}</cLocPrestacao></locPrest><cServ><cTribNac>${cTribNac}</cTribNac><xDescServ>${esc(descricao)}</xDescServ></cServ></serv><valores><vServPrest><vServ>${dec2(valor)}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${p.issRetido ? 2 : 1}</tpRetISSQN></tribMun><totTrib><pTotTribSN>${dec2(pTotTribSN)}</pTotTribSN></totTrib></trib></valores></infDPS></DPS>`;
}

/** Primeiro certificado de um PEM com cadeia (o do titular, na ordem que
 * extrairPemDoPfx devolve). */
function primeiroCertPem(certPem) {
  const m = String(certPem).match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!m) throw new Error("Certificado inválido.");
  return m[0];
}

/** Assina o <infDPS> (enveloped, C14N) e anexa <Signature> como último
 * filho de <DPS>, como o leiaute exige (TCDPS: infDPS, Signature). */
function assinarDps(dpsXml, privateKeyPem, certPem, algoritmo = "sha1") {
  const alg = ALGORITMOS[algoritmo];
  if (!alg) throw new Error(`Algoritmo de assinatura desconhecido: ${algoritmo}`);
  const id = dpsXml.match(/<infDPS[^>]*\sId="([^"]+)"/)?.[1];
  if (!id) throw new Error("DPS sem Id.");
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: primeiroCertPem(certPem),
    signatureAlgorithm: alg.assinatura,
    canonicalizationAlgorithm: C14N,
  });
  sig.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    uri: `#${id}`,
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", C14N],
    digestAlgorithm: alg.digest,
  });
  sig.computeSignature(dpsXml, { location: { reference: "//*[local-name(.)='DPS']", action: "append" } });
  return sig.getSignedXml();
}

/** GZip + base64 do XML em UTF-8 (padrão de troca da API). A mensagem
 * descompactada não pode ter declaração com outra codificação nem prefixo
 * de namespace (E1228/E1229). */
function compactarXml(xml) {
  return zlib.gzipSync(Buffer.from(xml, "utf8")).toString("base64");
}

function descompactarXml(b64) {
  return zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

/** Texto curto a partir da lista de erros da Sefin. */
function resumirErros(erros) {
  if (!Array.isArray(erros) || !erros.length) return "A Sefin Nacional rejeitou a DPS, sem detalhe.";
  return erros
    .map((e) => [e.codigo, e.descricao || e.mensagem].filter(Boolean).join(" — ") + (e.complemento ? ` (${e.complemento})` : ""))
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
  const erros = corpo?.erros || (corpo?.erro ? [corpo.erro] : []);
  return { ok: false, http, erros, bruto: typeof corpo === "string" ? corpo.slice(0, 500) : undefined };
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

/** Campos úteis do XML da NFS-e devolvido (número e data de processamento). */
function extrairDadosNfse(nfseXml) {
  const pega = (tag) => nfseXml?.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() || null;
  return { nNFSe: pega("nNFSe"), dhProc: pega("dhProc"), cStat: pega("cStat") };
}

module.exports = {
  VERSAO_LEIAUTE, SERIE_PADRAO, CTRIBNAC_MEDICINA, URLS,
  montarIdDps, montarDpsXml, assinarDps, compactarXml, descompactarXml,
  resumirErros, enviarDps, consultarPorIdDps, extrairDadosNfse, agoraSaoPaulo,
};
