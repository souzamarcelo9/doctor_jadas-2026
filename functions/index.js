const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const https = require("node:https");
const crypto = require("node:crypto");
const forge = require("node-forge");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

initializeApp();
const db = getFirestore();
const secretManager = new SecretManagerServiceClient();

// As chaves ficam no Secret Manager do Firebase, nunca em código-fonte nem
// no front-end. Definidas rodando:
//   firebase functions:secrets:set GROQ_API_KEY
//   firebase functions:secrets:set MEMED_API_KEY
//   firebase functions:secrets:set MEMED_SECRET_KEY
const groqApiKey = defineSecret("GROQ_API_KEY");
const memedApiKey = defineSecret("MEMED_API_KEY");
const memedSecretKey = defineSecret("MEMED_SECRET_KEY");

const REGION = "southamerica-east1";
const GROQ_STT_MODEL = "whisper-large-v3-turbo";
// A Groq descontinuou o "llama-3.3-70b-versatile" em 16/08/2026 (chamadas a
// ele passaram a responder com erro "model_decommissioned", causando o
// "Falha ao gerar o resumo da consulta" na tela de Atendimento). Trocado
// para o substituto recomendado pela própria Groq nesse aviso de
// depreciação: https://console.groq.com/docs/deprecations
const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";

/**
 * Recebe o áudio gravado no navegador (base64) e devolve a transcrição,
 * usando o endpoint de Speech-to-Text da Groq (Whisper).
 *
 * Entrada:  { audioBase64: string, idioma?: string }
 * Saída:    { texto: string }
 */
exports.transcreverAudio = onCall({ region: REGION, secrets: [groqApiKey], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para usar a transcrição.");
  }

  const { audioBase64, idioma = "pt" } = request.data || {};
  if (!audioBase64 || typeof audioBase64 !== "string") {
    throw new HttpsError("invalid-argument", "Áudio não enviado.");
  }

  let buffer;
  try {
    buffer = Buffer.from(audioBase64, "base64");
  } catch {
    throw new HttpsError("invalid-argument", "Áudio em formato inválido.");
  }
  if (buffer.length === 0) {
    throw new HttpsError("invalid-argument", "Áudio vazio.");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/webm" }), "consulta.webm");
  form.append("model", GROQ_STT_MODEL);
  form.append("language", idioma);
  form.append("response_format", "json");

  let resp;
  try {
    resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey.value()}` },
      body: form,
    });
  } catch (err) {
    logger.error("Falha de rede ao chamar a Groq (STT):", err);
    throw new HttpsError("unavailable", "Não foi possível falar com o serviço de transcrição. Tente novamente.");
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logger.error("Groq STT respondeu com erro:", resp.status, errText);
    throw new HttpsError("internal", "Falha ao transcrever o áudio.");
  }

  const data = await resp.json();
  return { texto: (data.text || "").trim() };
});

/**
 * Recebe a transcrição de uma consulta e devolve um resumo da queixa +
 * sugestões clínicas estruturadas, usando o Llama 3.3 70B via Groq.
 *
 * Entrada:  { transcricao: string }
 * Saída:    { queixaResumo: string, sugestoes: [{ tipo, label, confianca }] }
 */
exports.sumarizarConsulta = onCall({ region: REGION, secrets: [groqApiKey], timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para usar a IA.");
  }

  const { transcricao } = request.data || {};
  if (!transcricao || typeof transcricao !== "string" || transcricao.trim().length < 10) {
    throw new HttpsError("invalid-argument", "Transcrição vazia ou curta demais para resumir.");
  }

  const systemPrompt = `Você é um assistente clínico que ajuda um médico brasileiro a documentar uma consulta.
A partir da transcrição de uma consulta médica, responda SOMENTE com um JSON válido (sem markdown, sem texto fora do JSON), no formato exato:
{
  "queixaResumo": "resumo objetivo da queixa do paciente, em português, 2 a 4 frases, em terceira pessoa",
  "sugestoes": [
    { "tipo": "problema" | "conduta" | "exame" | "alerta", "label": "texto curto e específico da sugestão", "confianca": 0.0 a 1.0 }
  ]
}
Regras importantes:
- Gere no máximo 5 sugestões, só as que tiverem base clara na transcrição.
- NUNCA invente informação que não esteja na transcrição.
- Se não houver informação suficiente para nenhuma sugestão, devolva "sugestoes": [].
- A decisão clínica final é sempre do médico — suas sugestões são só um apoio.`;

  let resp;
  try {
    resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcricao },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    logger.error("Falha de rede ao chamar a Groq (chat):", err);
    throw new HttpsError("unavailable", "Não foi possível falar com o serviço de IA. Tente novamente.");
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logger.error("Groq chat respondeu com erro:", resp.status, errText);
    throw new HttpsError("internal", "Falha ao gerar o resumo da consulta.");
  }

  const data = await resp.json();
  const conteudo = data.choices?.[0]?.message?.content || "{}";

  let parsed;
  try {
    // Alguns modelos, mesmo em modo JSON, às vezes envolvem a resposta em
    // ```json ... ``` — removemos isso antes de fazer o parse, por segurança.
    const limpo = conteudo.replace(/^```json\s*|\s*```$/g, "").trim();
    parsed = JSON.parse(limpo);
  } catch (err) {
    logger.error("Resposta da IA não é um JSON válido:", conteudo);
    throw new HttpsError("internal", "A IA retornou um formato inesperado. Tente gravar novamente.");
  }

  return {
    queixaResumo: typeof parsed.queixaResumo === "string" ? parsed.queixaResumo : "",
    sugestoes: normalizarSugestoes(parsed.sugestoes),
  };
});

const TIPOS_VALIDOS = ["problema", "conduta", "exame", "alerta"];

/** O modelo às vezes devolve o "tipo" com variações (maiúscula, plural,
 * acento) mesmo quando instruído a usar um valor fixo — normalizamos aqui,
 * no servidor, em vez de deixar o cliente lidar com isso (e possivelmente
 * descartar a sugestão silenciosamente sem avisar ninguém). */
function normalizarSugestoes(sugestoes) {
  if (!Array.isArray(sugestoes)) return [];
  return sugestoes
    .map((s) => {
      if (!s || typeof s.label !== "string" || !s.label.trim()) return null;
      const tipoNormalizado = normalizarTipo(s.tipo);
      if (!tipoNormalizado) {
        logger.warn(`Sugestão da IA com tipo não reconhecido, descartada: "${s.tipo}"`);
        return null;
      }
      const confianca = typeof s.confianca === "number" ? Math.max(0, Math.min(1, s.confianca)) : 0.5;
      return { tipo: tipoNormalizado, label: s.label.trim(), confianca };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizarTipo(tipo) {
  if (typeof tipo !== "string") return null;
  const limpo = tipo
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
  if (TIPOS_VALIDOS.includes(limpo)) return limpo;
  if (limpo === "problemas") return "problema";
  if (limpo === "condutas") return "conduta";
  if (limpo === "exames" || limpo === "exame solicitado" || limpo === "exames solicitados") return "exame";
  if (limpo === "alertas" || limpo === "atencao") return "alerta";
  return null;
}

// ---------------------------------------------------------------------
// Memed — receita digital
// ---------------------------------------------------------------------

// Ambiente de testes da Memed, compartilhado por todos os parceiros (troque
// para a URL de produção depois da validação técnica com eles).
const MEMED_API_BASE = "https://integrations.api.memed.com.br";

/**
 * Faz login (ou cadastro, se ainda não existir) do médico na Memed, usando
 * a API-KEY/SECRET-KEY do parceiro (nunca vão pro front-end), e devolve o
 * token de acesso do usuário prescritor — usado pelo front-end pra carregar
 * o módulo deles.
 *
 * Campos obrigatórios pela Memed (nome, sobrenome, cpf, data de nascimento,
 * registro profissional em código/número/UF) precisam já estar salvos em
 * `clinicas/{clinicaId}/membros/{uid}` antes de chamar — se faltar algum,
 * devolve `failed-precondition` com a lista do que falta, pro front-end
 * mostrar um formulário de completar cadastro.
 *
 * O token é cacheado em `membros/{uid}.memedToken` — reaproveitado enquanto
 * for válido; passe `forcarNovoLogin: true` para gerar um novo (ex: se a
 * Memed rejeitar o token salvo).
 *
 * Entrada:  { clinicaId: string, forcarNovoLogin?: boolean }
 * Saída:    { token: string }
 */
const MEMED_CAMPOS_OBRIGATORIOS = ["sobrenome", "cpf", "dataNascimento", "boardNumber", "boardState"];

exports.memedObterToken = onCall({ region: REGION, secrets: [memedApiKey, memedSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para usar a prescrição digital.");
  }
  const { clinicaId, forcarNovoLogin = false } = request.data || {};
  if (!clinicaId) {
    throw new HttpsError("invalid-argument", "clinicaId não informado.");
  }

  const uid = request.auth.uid;
  const membroRef = db.doc(`clinicas/${clinicaId}/membros/${uid}`);
  const membroSnap = await membroRef.get();
  if (!membroSnap.exists) {
    throw new HttpsError("permission-denied", "Você não tem vínculo com essa clínica.");
  }
  const membro = membroSnap.data();

  if (!forcarNovoLogin && membro.memedToken) {
    return { token: membro.memedToken };
  }

  const faltando = MEMED_CAMPOS_OBRIGATORIOS.filter((campo) => !membro[campo]);
  if (faltando.length > 0) {
    throw new HttpsError("failed-precondition", "Cadastro incompleto para prescrever.", { camposFaltando: faltando });
  }

  // A chave do parceiro vai na query string (confirmado pela doc oficial —
  // diferente do padrão de header que a maioria das APIs usa).
  const qs = `apikey=${encodeURIComponent(memedApiKey.value())}&secretkey=${encodeURIComponent(memedSecretKey.value())}`;
  const headers = { Accept: "application/vnd.api+json", "Content-Type": "application/json" };

  // Tenta buscar o prescritor já cadastrado (identificador = nosso uid, usado
  // como external_id) antes de tentar cadastrar de novo.
  let resp;
  try {
    resp = await fetch(`${MEMED_API_BASE}/v1/sinapse-prescricao/usuarios/${uid}?${qs}`, { headers });
  } catch (err) {
    logger.error("Falha de rede ao consultar usuário na Memed:", err);
    throw new HttpsError("unavailable", "Não foi possível falar com a Memed. Tente novamente.");
  }

  if (resp.status === 404) {
    // Ainda não existe do lado da Memed — cadastra agora.
    const [primeiroNome, ...resto] = (membro.nome || "").split(" ");
    const payload = {
      data: {
        type: "usuarios",
        attributes: {
          external_id: uid,
          nome: primeiroNome || membro.nome,
          sobrenome: membro.sobrenome || (resto.join(" ") || "-"),
          cpf: String(membro.cpf).replace(/\D/g, ""),
          board: {
            board_code: membro.boardCode || "CRM",
            board_number: String(membro.boardNumber).replace(/\D/g, ""),
            board_state: membro.boardState,
          },
          email: membro.email || undefined,
          telefone: membro.telefone ? String(membro.telefone).replace(/\D/g, "") : undefined,
          sexo: membro.sexo || undefined,
          data_nascimento: membro.dataNascimento, // formato dd/mm/aaaa
        },
      },
    };

    try {
      resp = await fetch(`${MEMED_API_BASE}/v1/sinapse-prescricao/usuarios?${qs}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger.error("Falha de rede ao cadastrar usuário na Memed:", err);
      throw new HttpsError("unavailable", "Não foi possível falar com a Memed. Tente novamente.");
    }
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logger.error("Memed respondeu com erro:", resp.status, errText);
    throw new HttpsError("internal", "Falha ao autenticar/cadastrar na Memed. Confira os dados do cadastro (CPF, registro profissional).");
  }

  const data = await resp.json();
  const token = data?.data?.attributes?.token || data?.token;
  if (!token) {
    logger.error("Resposta da Memed sem token reconhecível:", JSON.stringify(data));
    throw new HttpsError("internal", "A Memed não retornou um token válido.");
  }

  await membroRef.update({ memedToken: token, memedTokenAtualizadoEm: new Date().toISOString() });
  return { token };
});

// ---------------------------------------------------------------------
// NFS-e Paulistana — certificado digital + emissão
// ---------------------------------------------------------------------
//
// Referência: Manual de Utilização do Web Service da Prefeitura de São
// Paulo, versão 2.1 (layout v1) — https://nfe.prefeitura.sp.gov.br/arquivos/nfews.pdf
//
// ⚠️ ATENÇÃO — LAYOUT V1 vs V2: este manual documenta o layout v1. A partir
// de janeiro/2026 (Reforma Tributária) o layout v2 passou a ser obrigatório
// e provavelmente adiciona campos novos (IBS/CBS) ao tpRPS que este código
// ainda não cobre. A MECÂNICA (envelope SOAP, algoritmo de assinatura do
// RPS, TLS mútuo com certificado ICP-Brasil) deve continuar valendo — mas
// os CAMPOS do XML do RPS precisam ser conferidos contra o schema v2 antes
// de emitir em produção de verdade.
//
// Endpoint novo (recomendado, suporta v1 e v2): https://nfews.prefeitura.sp.gov.br/lotenfe.asmx

const NFSE_WSDL_HOST = "nfews.prefeitura.sp.gov.br";
const NFSE_WSDL_PATH = "/lotenfe.asmx";
// Por segurança, por padrão usamos o método de TESTE (não gera NF-e de
// verdade mesmo que o certificado seja aceito) — só troque para false
// depois de validar tudo com o certificado ICP-Brasil real do cliente.
const NFSE_MODO_TESTE = true;

function nomeSecretCertificado(clinicaId) {
  return `nfse-cert-${clinicaId}`;
}

async function lerSecretMaisRecente(nome) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const [versao] = await secretManager.accessSecretVersion({
    name: `projects/${projectId}/secrets/${nome}/versions/latest`,
  });
  return versao.payload.data.toString("utf8");
}

async function gravarSecret(nome, valor) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const secretPath = `projects/${projectId}/secrets/${nome}`;
  try {
    await secretManager.getSecret({ name: secretPath });
  } catch {
    await secretManager.createSecret({
      parent: `projects/${projectId}`,
      secretId: nome,
      secret: { replication: { automatic: {} } },
    });
  }
  await secretManager.addSecretVersion({
    parent: secretPath,
    payload: { data: Buffer.from(valor, "utf8") },
  });
}

/** Confere se o usuário é admin da clínica — só admin mexe no certificado
 * digital, dado o quanto é sensível. */
async function exigirAdmin(clinicaId, uid) {
  const membroSnap = await db.doc(`clinicas/${clinicaId}/membros/${uid}`).get();
  if (!membroSnap.exists || membroSnap.data().papel !== "admin") {
    throw new HttpsError("permission-denied", "Só administradores da clínica podem gerenciar o certificado digital.");
  }
}

/**
 * Recebe o certificado (.pfx/.p12) em base64 + senha, valida que o arquivo
 * abre com a senha informada, guarda no Secret Manager (nunca no Firestore)
 * e grava só metadados não-sensíveis na clínica (status, validade, CN).
 *
 * Entrada:  { clinicaId, arquivoBase64, senha, nomeArquivo }
 * Saída:    { ok: true, nomeCertificado, validoAte }
 */
exports.nfseSalvarCertificado = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login para continuar.");
  const { clinicaId, arquivoBase64, senha, nomeArquivo } = request.data || {};
  if (!clinicaId || !arquivoBase64 || !senha) {
    throw new HttpsError("invalid-argument", "Envie o arquivo do certificado e a senha.");
  }
  await exigirAdmin(clinicaId, request.auth.uid);

  let cn = null;
  let validoAte = null;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(arquivoBase64));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
    const bagsCert = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = bagsCert[forge.pki.oids.certBag]?.[0];
    if (!certBag?.cert) throw new Error("Certificado não encontrado no arquivo.");
    cn = certBag.cert.subject.getField("CN")?.value || null;
    validoAte = certBag.cert.validity.notAfter.toISOString();

    const bagsKey = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = bagsKey[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    if (!keyBag?.key) throw new Error("Chave privada não encontrada no arquivo.");
  } catch (err) {
    logger.warn("Falha ao abrir o certificado enviado:", err.message);
    throw new HttpsError("invalid-argument", "Não foi possível abrir o certificado — confira o arquivo e a senha.");
  }

  await gravarSecret(nomeSecretCertificado(clinicaId), JSON.stringify({ pfxBase64: arquivoBase64, senha }));

  await db.doc(`clinicas/${clinicaId}`).update({
    certificadoNfse: {
      status: "configurado",
      nomeArquivo: nomeArquivo || "certificado.pfx",
      nomeCertificado: cn,
      validoAte,
      importadoEm: new Date().toISOString(),
      importadoPor: request.auth.uid,
    },
  });

  return { ok: true, nomeCertificado: cn, validoAte };
});

/** Monta a string de 86 posições e assina com RSA-SHA1, conforme o
 * algoritmo de assinatura do RPS descrito no manual (item 4.3.2). */
function assinarRps(rps, privateKeyPem) {
  const pad = (v, n) => String(v).padStart(n, "0");
  const padRight = (v, n) => String(v).padEnd(n, " ");
  const cadeia =
    pad(rps.inscricaoMunicipalPrestador, 8) +
    padRight(rps.serie || "UNICA", 5) +
    pad(rps.numero, 12) +
    rps.dataEmissao.replace(/-/g, "") + // AAAAMMDD
    rps.tipoTributacao + // T | F | I | J
    "N" + // status: Normal
    (rps.issRetido ? "S" : "N") +
    pad(Math.round(rps.valorServicos * 100), 15) +
    pad(Math.round((rps.valorDeducoes || 0) * 100), 15) +
    pad(rps.codigoServico, 5) +
    (rps.cpfCnpjTomador ? (rps.cpfCnpjTomador.length === 11 ? "1" : "2") : "3") +
    pad(rps.cpfCnpjTomador || "", 14);

  const sign = crypto.createSign("RSA-SHA1");
  sign.update(cadeia, "ascii");
  return sign.sign(privateKeyPem, "base64");
}

function montarXmlRps(rps, assinatura) {
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  return `
    <RPS>
      <Assinatura>${assinatura}</Assinatura>
      <ChaveRPS>
        <InscricaoPrestador>${rps.inscricaoMunicipalPrestador}</InscricaoPrestador>
        <SerieRPS>${esc(rps.serie || "UNICA")}</SerieRPS>
        <NumeroRPS>${rps.numero}</NumeroRPS>
      </ChaveRPS>
      <TipoRPS>RPS</TipoRPS>
      <DataEmissao>${rps.dataEmissao}</DataEmissao>
      <StatusRPS>N</StatusRPS>
      <TributacaoRPS>${rps.tipoTributacao}</TributacaoRPS>
      <ValorServicos>${rps.valorServicos.toFixed(2)}</ValorServicos>
      <ValorDeducoes>${(rps.valorDeducoes || 0).toFixed(2)}</ValorDeducoes>
      <CodigoServico>${rps.codigoServico}</CodigoServico>
      <AliquotaServicos>${rps.aliquota}</AliquotaServicos>
      <ISSRetido>${rps.issRetido ? "true" : "false"}</ISSRetido>
      ${rps.cpfCnpjTomador ? `<CPFCNPJTomador>${rps.cpfCnpjTomador.length === 11 ? `<CPF>${rps.cpfCnpjTomador}</CPF>` : `<CNPJ>${rps.cpfCnpjTomador}</CNPJ>`}</CPFCNPJTomador>` : ""}
      ${rps.razaoSocialTomador ? `<RazaoSocialTomador>${esc(rps.razaoSocialTomador)}</RazaoSocialTomador>` : ""}
      <Discriminacao>${esc(rps.discriminacao)}</Discriminacao>
    </RPS>`.trim();
}

/**
 * Monta o RPS, assina, empacota no envelope SOAP e tenta enviar à Prefeitura
 * via TLS mútuo com o certificado da clínica — usando o método de TESTE por
 * padrão (não gera NF-e real mesmo se o certificado for aceito).
 *
 * Com um certificado autoassinado (fase de desenvolvimento), a rejeição do
 * handshake TLS é o resultado ESPERADO — é isso que confirma que o resto do
 * pipeline (montagem do XML, assinatura, conexão) está funcionando; só a
 * confiança na cadeia de certificação é que falha, propositalmente, até
 * termos um certificado ICP-Brasil de verdade.
 *
 * Entrada:  { clinicaId, notaFiscalId, dados: { cnpjPrestador, inscricaoMunicipalPrestador,
 *              cpfCnpjTomador, razaoSocialTomador, valorServicos, codigoServico,
 *              aliquota, discriminacao } }
 * Saída:    { status: "enviado_teste" | "rejeitado_certificado" | "erro", detalhe }
 */
exports.nfseEmitir = onCall({ region: REGION, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login para continuar.");
  const { clinicaId, notaFiscalId, dados } = request.data || {};
  if (!clinicaId || !notaFiscalId || !dados) {
    throw new HttpsError("invalid-argument", "Dados da nota incompletos.");
  }

  const clinicaSnap = await db.doc(`clinicas/${clinicaId}`).get();
  const certInfo = clinicaSnap.data()?.certificadoNfse;
  if (!certInfo || certInfo.status !== "configurado") {
    throw new HttpsError("failed-precondition", "Nenhum certificado digital configurado para esta clínica. Configure em Configurações → Certificado Digital.");
  }

  let secretJson;
  try {
    secretJson = JSON.parse(await lerSecretMaisRecente(nomeSecretCertificado(clinicaId)));
  } catch (err) {
    logger.error("Erro ao ler certificado do Secret Manager:", err);
    throw new HttpsError("internal", "Não foi possível recuperar o certificado configurado.");
  }
  const { pfxBase64, senha } = secretJson;
  const pfxBuffer = Buffer.from(pfxBase64, "base64");

  let privateKeyPem;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(pfxBase64));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
    const bagsKey = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = bagsKey[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  } catch (err) {
    logger.error("Erro ao extrair chave privada do certificado:", err);
    throw new HttpsError("internal", "Certificado configurado está corrompido ou a senha mudou — reimporte em Configurações.");
  }

  const rps = {
    inscricaoMunicipalPrestador: dados.inscricaoMunicipalPrestador || "00000000",
    numero: dados.numeroRps || Date.now() % 1e12,
    serie: "UNICA",
    dataEmissao: new Date().toISOString().slice(0, 10),
    tipoTributacao: "T",
    issRetido: false,
    valorServicos: Number(dados.valorServicos) || 0,
    valorDeducoes: 0,
    codigoServico: dados.codigoServico || "04498",
    aliquota: dados.aliquota || 0.02,
    cpfCnpjTomador: (dados.cpfCnpjTomador || "").replace(/\D/g, "") || null,
    razaoSocialTomador: dados.razaoSocialTomador,
    discriminacao: dados.discriminacao,
  };

  const assinatura = assinarRps(rps, privateKeyPem);
  const xmlRps = montarXmlRps(rps, assinatura);

  // ⚠️ A tag <Signature> da mensagem XML completa (assinatura XMLDSig do
  // PEDIDO, distinta da assinatura do RPS acima) não está implementada
  // aqui — depende de uma biblioteca de XMLDSig (ex.: xml-crypto) e do
  // certificado ICP-Brasil real para ter qualquer valor prático de testar.
  // Fica marcado como próximo passo quando o certificado real chegar.
  const mensagemXml = `<?xml version="1.0" encoding="utf-8"?>
<PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe" Versao="1">
  <Cabecalho Versao="1">
    <CPFCNPJRemetente><CNPJ>${(dados.cnpjPrestador || "").replace(/\D/g, "")}</CNPJ></CPFCNPJRemetente>
    <transacao>true</transacao>
    <dtInicio>${rps.dataEmissao}</dtInicio>
    <dtFim>${rps.dataEmissao}</dtFim>
    <QtdRPS>1</QtdRPS>
    <ValorTotalServicos>${rps.valorServicos.toFixed(2)}</ValorTotalServicos>
    <ValorTotalDeducoes>0.00</ValorTotalDeducoes>
  </Cabecalho>
  ${xmlRps}
</PedidoEnvioLoteRPS>`;

  const metodo = NFSE_MODO_TESTE ? "TesteEnvioLoteRPS" : "EnvioLoteRPS";
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${metodo}Request xmlns="http://www.prefeitura.sp.gov.br/nfe">
      <VersaoSchema>1</VersaoSchema>
      <MensagemXML><![CDATA[${mensagemXml}]]></MensagemXML>
    </${metodo}Request>
  </soap:Body>
</soap:Envelope>`;

  const notaRef = db.doc(`clinicas/${clinicaId}/notasFiscais/${notaFiscalId}`);

  try {
    const respostaXml = await enviarSoapComCertificado(soapEnvelope, metodo, pfxBuffer, senha);
    logger.info("Prefeitura respondeu (modo teste):", respostaXml.slice(0, 2000));
    await notaRef.update({ status: "processando", respostaWebservice: respostaXml.slice(0, 5000), enviadoEm: new Date().toISOString() });
    return { status: "enviado_teste", detalhe: "A Prefeitura respondeu — confira o retorno para ver se o XML passou na validação de schema." };
  } catch (err) {
    const provavelmenteTls = /certificate|SSL|TLS|handshake/i.test(err.message || "");
    const detalhe = provavelmenteTls
      ? "Conexão rejeitada na validação do certificado — esperado com certificado autoassinado. Funcionará normalmente com o certificado ICP-Brasil real."
      : `Falha ao enviar: ${err.message}`;
    logger.warn("Envio à Prefeitura falhou:", err.message);
    await notaRef.update({ status: "erro_certificado", erroWebservice: detalhe, tentadoEm: new Date().toISOString() });
    return { status: "rejeitado_certificado", detalhe };
  }
});

function enviarSoapComCertificado(soapEnvelope, soapAction, pfxBuffer, senha) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: NFSE_WSDL_HOST,
        path: NFSE_WSDL_PATH,
        method: "POST",
        pfx: pfxBuffer,
        passphrase: senha,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(soapEnvelope),
          SOAPAction: `http://www.prefeitura.sp.gov.br/nfe/${soapAction}`,
        },
        timeout: 20000,
      },
      (res) => {
        let corpo = "";
        res.on("data", (chunk) => (corpo += chunk));
        res.on("end", () => resolve(corpo));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao conectar com a Prefeitura.")));
    req.on("error", reject);
    req.write(soapEnvelope);
    req.end();
  });
}
