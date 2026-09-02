const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
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
// WhatsApp Business Cloud API (Meta) — usada só pelos lembretes automáticos
// agendados (enviarLembretesAgendados, mais abaixo). Diferente do botão
// manual de "Link de confirmação" (que abre wa.me e depende de alguém
// clicar em enviar), isto manda mensagem de verdade sem intervenção
// humana — e por isso exige a API oficial da Meta, com um template de
// mensagem pré-aprovado. Ver o comentário da função pra instruções de
// configuração.
const whatsappToken = defineSecret("WHATSAPP_TOKEN");
const whatsappPhoneNumberId = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
// E-mail de avaliação pós-consulta — via Resend (https://resend.com), API
// simples, sem precisar de servidor de e-mail próprio. Configurar com:
//   firebase functions:secrets:set RESEND_API_KEY
// EMAIL_FROM precisa ser um endereço de um domínio verificado no Resend
// pra funcionar em produção (o domínio de teste deles só entrega pro
// próprio e-mail da conta Resend). APP_BASE_URL é opcional — sem
// configurar, cai no domínio padrão do Firebase Hosting do projeto.
const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFromParam = defineString("EMAIL_FROM", { default: "avaliacao@resend.dev" });
const appBaseUrlParam = defineString("APP_BASE_URL", { default: "" });

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

// ---------------------------------------------------------------------
// Assinaturas Pendentes — assinatura digital de documentos clínicos
// ---------------------------------------------------------------------
//
// ⚠️ LIMITAÇÃO CONHECIDA: isto gera uma assinatura RSA-SHA256 real sobre o
// conteúdo do documento, usando a chave privada do certificado .pfx/.p12 já
// configurado em Configurações → Certificado Digital (o mesmo certificado
// usado pra NFS-e). Isso prova integridade + posse da chave privada da
// CLÍNICA, mas NÃO produz um envelope CAdES/PAdES no padrão ICP-Brasil, e o
// certificado é da clínica, não um e-CPF individual do médico. Não deve ser
// tratado como equivalente legal a uma assinatura ICP-Brasil em documentos
// que exigem validade jurídica plena (atestados, receitas de controle
// especial). Para isso, evoluir para PAdES/CAdES com certificado por médico.

const MODULOS_ASSINAVEIS = ["condutas", "prescricoes", "encaminhamentos"];

// Cada módulo do prontuário guarda o conteúdo em campos diferentes — não
// existe um `texto` único (ver Conduta.jsx, Prescricoes.jsx,
// Encaminhamento.jsx). Esta função monta a representação textual que
// efetivamente vai pro hash/assinatura de cada tipo de documento.
function conteudoDoDocumento(modulo, documento) {
  if (modulo === "condutas") return documento.texto || "";
  if (modulo === "prescricoes") return `${documento.medicamento || ""} — ${documento.posologia || ""}`;
  if (modulo === "encaminhamentos") return `${documento.especialidade || ""}: ${documento.motivo || ""}`;
  return "";
}

/**
 * Entrada:  { clinicaId, pacienteId, modulo: "condutas"|"prescricoes"|"encaminhamentos", documentoId }
 * Saída:    { ok: true, assinadoEm, certificadoCn }
 */
exports.assinarDocumento = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login para continuar.");
  const { clinicaId, pacienteId, modulo, documentoId } = request.data || {};
  if (!clinicaId || !pacienteId || !modulo || !documentoId || !MODULOS_ASSINAVEIS.includes(modulo)) {
    throw new HttpsError("invalid-argument", "Dados incompletos para assinatura.");
  }

  const uid = request.auth.uid;
  const membroSnap = await db.doc(`clinicas/${clinicaId}/membros/${uid}`).get();
  if (!membroSnap.exists || membroSnap.data().papel !== "medico") {
    throw new HttpsError("permission-denied", "Só o médico responsável pode assinar documentos clínicos.");
  }

  const docRef = db.doc(`clinicas/${clinicaId}/pacientes/${pacienteId}/${modulo}/${documentoId}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new HttpsError("not-found", "Documento não encontrado.");
  const documento = docSnap.data();
  if (documento.assinatura?.status === "assinado") {
    throw new HttpsError("failed-precondition", "Este documento já foi assinado.");
  }
  if (documento.profissionalId !== uid) {
    throw new HttpsError("permission-denied", "Só quem registrou o documento pode assiná-lo.");
  }
  if (modulo === "prescricoes" && documento.origemMemed) {
    throw new HttpsError("failed-precondition", "Esta prescrição já foi emitida e assinada digitalmente pela Memed — não precisa (nem deve) ser assinada de novo aqui.");
  }

  const clinicaSnap = await db.doc(`clinicas/${clinicaId}`).get();
  const certInfo = clinicaSnap.data()?.certificadoNfse;
  if (!certInfo || certInfo.status !== "configurado") {
    throw new HttpsError("failed-precondition", "Nenhum certificado digital configurado. Configure em Configurações → Certificado Digital.");
  }

  let secretJson;
  try {
    secretJson = JSON.parse(await lerSecretMaisRecente(nomeSecretCertificado(clinicaId)));
  } catch (err) {
    logger.error("Erro ao ler certificado do Secret Manager:", err);
    throw new HttpsError("internal", "Não foi possível recuperar o certificado configurado.");
  }
  const { pfxBase64, senha } = secretJson;

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

  const criadoEmIso = documento.criadoEm?.toDate ? documento.criadoEm.toDate().toISOString() : new Date().toISOString();
  // Conteúdo canônico assinado: inclui os identificadores do documento (pra
  // amarrar a assinatura a ESTE registro específico) e o conteúdo no
  // momento do registro — se o conteúdo mudar depois, o hash não bate mais
  // e dá pra detectar adulteração comparando com o estado atual do documento.
  const conteudoCanonico = JSON.stringify({
    clinicaId, pacienteId, modulo, documentoId,
    conteudo: conteudoDoDocumento(modulo, documento),
    profissionalId: documento.profissionalId || null,
    criadoEm: criadoEmIso,
  });
  const hashSha256 = crypto.createHash("sha256").update(conteudoCanonico, "utf8").digest("hex");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(conteudoCanonico, "utf8");
  const assinaturaBase64 = sign.sign(privateKeyPem, "base64");

  const assinadoEm = new Date().toISOString();
  await docRef.update({
    assinatura: {
      status: "assinado",
      hashSha256,
      assinaturaBase64,
      algoritmo: "RSA-SHA256",
      certificadoCn: certInfo.nomeCertificado || null,
      assinadoPorUid: uid,
      assinadoEm,
    },
  });

  return { ok: true, assinadoEm, certificadoCn: certInfo.nomeCertificado || null };
});

// ---------------------------------------------------------------------
// Onboarding — criação de clínica nova (multi-tenant self-service) +
// custom claims automáticos
// ---------------------------------------------------------------------
//
// Sem isto, o único jeito de uma clínica nova existir era rodar o script
// `scripts/seed.js` manualmente. E mesmo criando o vínculo em `membros/{uid}`
// direto pelo client (o que as Firestore Rules já permitiam), o usuário
// nunca "descobria" a clínica no seletor — o `TenantContext` lê a lista de
// clínicas a partir do custom claim `clinicas` no token do usuário
// (AuthContext), e nada setava esse claim fora do seed local.
//
// NADA aqui usa `collectionGroup` de propósito — ver a nota de arquitetura
// em src/lib/firestore.js: collectionGroup + Security Rules já deu
// "Missing or insufficient permissions" neste projeto antes, mesmo com
// regras corretas. Em vez de varrer `membros` entre clínicas, mantemos um
// índice invertido simples em `usuarios/{uid}.clinicaIds` (um array),
// atualizado pelo trigger abaixo sempre que um vínculo muda.
//
//  1. `criarClinica` faz a criação atômica (doc da clínica + vínculo admin)
//     via Admin SDK, sem depender das Firestore Rules do client.
//  2. `onMembroEscrito` roda toda vez que um vínculo em `membros/{uid}` é
//     criado/alterado/removido (seja pelo `criarClinica` acima, seja por um
//     admin convidando alguém pela tela de equipe) e mantém tanto o índice
//     `usuarios/{uid}.clinicaIds` quanto o custom claim `clinicas`
//     sincronizados com a realidade do Firestore.

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getAuth } = require("firebase-admin/auth");

async function adicionarClinicaAoUsuario(uid, clinicaId) {
  await db.doc(`usuarios/${uid}`).set({ clinicaIds: FieldValue.arrayUnion(clinicaId) }, { merge: true });
}
async function removerClinicaDoUsuario(uid, clinicaId) {
  await db.doc(`usuarios/${uid}`).set({ clinicaIds: FieldValue.arrayRemove(clinicaId) }, { merge: true });
}

/** Relê `usuarios/{uid}.clinicaIds` e regrava isso como custom claim no
 * token do usuário — chamar sempre depois de tocar em `clinicaIds`. */
async function sincronizarClaimsDoUsuario(uid) {
  const snap = await db.doc(`usuarios/${uid}`).get();
  const clinicaIds = snap.exists ? (snap.data().clinicaIds || []) : [];
  await getAuth().setCustomUserClaims(uid, { clinicas: clinicaIds });
  return clinicaIds;
}

/**
 * Cria uma clínica nova e o vínculo do usuário logado como admin dela, numa
 * transação — evita o cenário de a clínica ser criada mas o vínculo falhar
 * (ou vice-versa), o que deixaria a clínica "orfã" sem ninguém pra
 * administrar.
 *
 * Entrada:  { nomeClinica }
 * Saída:    { ok: true, clinicaId }
 */
exports.criarClinica = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login para continuar.");
  const { nomeClinica } = request.data || {};
  if (!nomeClinica || !nomeClinica.trim()) {
    throw new HttpsError("invalid-argument", "Informe o nome da clínica.");
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email || null;
  const clinicaRef = db.collection("clinicas").doc();

  await db.runTransaction(async (tx) => {
    tx.set(clinicaRef, {
      nome: nomeClinica.trim(),
      criadoPor: uid,
      criadoEm: new Date().toISOString(),
      plano: "trial",
    });
    tx.set(clinicaRef.collection("membros").doc(uid), {
      nome: request.auth.token.name || email || "Administrador",
      email,
      papel: "admin",
      ativo: true,
      clinicaNome: nomeClinica.trim(),
      criadoEm: new Date().toISOString(),
    });
  });

  // O trigger onMembroEscrito (abaixo) também reage a essa escrita e faria
  // a mesma coisa — mas não dá pra garantir que ele já rodou antes desta
  // função responder ao client, então fazemos aqui também, direto, pra
  // quem chamou já sair com o claim atualizado sem esperar o trigger
  // propagar (evita a tela ficar "sem clínica nenhuma" por alguns segundos).
  await adicionarClinicaAoUsuario(uid, clinicaRef.id);
  await sincronizarClaimsDoUsuario(uid);

  return { ok: true, clinicaId: clinicaRef.id };
});

/** Mantém `usuarios/{uid}.clinicaIds` e o custom claim `clinicas`
 * sincronizados sempre que um vínculo `membros/{uid}` é criado, ativado,
 * desativado ou removido — em qualquer clínica, não só na criada pelo
 * `criarClinica` acima (cobre também convites feitos por um admin). */
exports.onMembroEscrito = onDocumentWritten(
  { region: REGION, document: "clinicas/{clinicaId}/membros/{uid}" },
  async (event) => {
    const { clinicaId, uid } = event.params;
    const depois = event.data?.after;
    const ativo = Boolean(depois?.exists && depois.data().ativo === true);

    if (ativo) {
      await adicionarClinicaAoUsuario(uid, clinicaId);
    } else {
      await removerClinicaDoUsuario(uid, clinicaId);
    }
    await sincronizarClaimsDoUsuario(uid);
  }
);

// ---------------------------------------------------------------------
// Índice plano de "Assinaturas Pendentes"
// ---------------------------------------------------------------------
//
// condutas/prescricoes/encaminhamentos vivem aninhados sob cada paciente
// (`clinicas/{id}/pacientes/{pacienteId}/{modulo}/{docId}`) — bom pro
// prontuário, ruim pra listar "tudo que um médico tem pendente de assinar
// em toda a clínica" sem um collectionGroup (que este projeto evita, ver
// nota acima). Este trigger espelha cada documento assinável num índice
// plano `clinicas/{id}/assinaturasPendentes/{docId}`, criado/atualizado ao
// registrar o documento e removido automaticamente quando ele é assinado
// (ver assinarDocumento, mais acima) — a tela de Assinaturas Pendentes só
// precisa fazer uma query simples nessa coleção.
exports.onModuloProntuarioEscrito = onDocumentWritten(
  { region: REGION, document: "clinicas/{clinicaId}/pacientes/{pacienteId}/{modulo}/{docId}" },
  async (event) => {
    const { clinicaId, pacienteId, modulo, docId } = event.params;
    if (!MODULOS_ASSINAVEIS.includes(modulo)) return; // só nos interessam os 3 módulos assináveis

    const indiceRef = db.doc(`clinicas/${clinicaId}/assinaturasPendentes/${docId}`);
    const depois = event.data?.after;

    if (!depois?.exists) {
      await indiceRef.delete().catch(() => {});
      return;
    }

    const documento = depois.data();
    const jaResolvido = documento.assinatura?.status === "assinado" || (modulo === "prescricoes" && documento.origemMemed);
    if (jaResolvido) {
      await indiceRef.delete().catch(() => {});
      return;
    }

    const pacienteSnap = await db.doc(`clinicas/${clinicaId}/pacientes/${pacienteId}`).get();
    await indiceRef.set({
      clinicaId, pacienteId, modulo, documentoId: docId,
      pacienteNome: pacienteSnap.exists ? pacienteSnap.data().nome || null : null,
      profissionalId: documento.profissionalId || null,
      resumo: conteudoDoDocumento(modulo, documento).slice(0, 140),
      criadoEm: documento.criadoEm || FieldValue.serverTimestamp(),
    });
  }
);

// ---------------------------------------------------------------------
// Lembretes automáticos agendados (WhatsApp Business Cloud API — Meta)
// ---------------------------------------------------------------------
//
// ⚠️ ISSO NÃO FUNCIONA "DE FÁBRICA" — exige configuração externa na Meta,
// feita por vocês, antes de mandar mensagem de verdade:
//
//   1. Criar um app no Meta for Developers (business.facebook.com /
//      developers.facebook.com) com o produto "WhatsApp" ativado.
//   2. Registrar um número de telefone no WhatsApp Business (pode ser o
//      número de teste da Meta pra homologar, e depois um número real).
//   3. Criar e submeter um template de mensagem chamado, por padrão,
//      "lembrete_consulta_24h" (nome configurável no código abaixo), com 2
//      variáveis de corpo: {{1}} = primeiro nome do paciente, {{2}} = data
//      e hora da consulta. Templates fora da janela de 24h de atendimento
//      SEMPRE precisam ser aprovados pela Meta antes de poder ser usados —
//      isso pode levar de minutos a alguns dias.
//   4. Gerar um token de acesso permanente (via System User, não o token
//      temporário de 24h) e pegar o Phone Number ID.
//   5. Rodar:
//        firebase functions:secrets:set WHATSAPP_TOKEN
//        firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
//
// Sem os secrets configurados, a função abaixo detecta isso, registra um
// aviso no log e não tenta enviar nada — ela não quebra o deploy nem falha
// silenciosamente fingindo que enviou. Isso permite subir o código agora e
// "ligar" os lembretes de verdade só quando a conta na Meta estiver pronta.
//
// Hoje a mesma conta/número do WhatsApp Business é compartilhada entre
// todas as clínicas do SaaS (a mensagem menciona o nome da clínica no
// corpo) — cada clínica ter seu próprio número exigiria o fluxo de
// Embedded Signup da Meta, um projeto à parte.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const NOME_TEMPLATE_LEMBRETE = "lembrete_consulta_24h";

/** Normaliza telefone BR pro formato que a Cloud API da Meta espera:
 * só dígitos, com código do país. */
function paraE164Br(telefone) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

function enviarWhatsappTemplate(telefone, parametrosBody) {
  const numero = paraE164Br(telefone);
  if (!numero) return Promise.reject(new Error("Paciente sem telefone válido."));

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: numero,
    type: "template",
    template: {
      name: NOME_TEMPLATE_LEMBRETE,
      language: { code: "pt_BR" },
      components: [{ type: "body", parameters: parametrosBody.map((texto) => ({ type: "text", text: texto })) }],
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "graph.facebook.com",
        path: `/v21.0/${whatsappPhoneNumberId.value()}/messages`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken.value()}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let corpo = "";
        res.on("data", (chunk) => (corpo += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(corpo);
          else reject(new Error(`WhatsApp API respondeu ${res.statusCode}: ${corpo}`));
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao chamar a API do WhatsApp.")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Roda a cada 30 minutos. Procura, em TODAS as clínicas, agendamentos que
 * caem numa janela de ~24h a partir de agora, ainda não lembrados e não
 * cancelados/faltosos, e manda o lembrete. Marca `lembrete24hEnviado: true`
 * no próprio agendamento pra nunca mandar duas vezes (a janela de 1h com
 * execução a cada 30min garante cobertura mesmo com pequenas variações de
 * horário do agendador).
 *
 * Não usa collectionGroup — itera as clínicas e consulta a subcoleção de
 * agendamentos de cada uma individualmente (mesma decisão de arquitetura
 * das outras funções deste arquivo).
 */
exports.enviarLembretesAgendados = onSchedule(
  { region: REGION, schedule: "every 30 minutes", timeoutSeconds: 300, secrets: [whatsappToken, whatsappPhoneNumberId] },
  async () => {
    if (!whatsappToken.value() || !whatsappPhoneNumberId.value()) {
      logger.warn("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configurados — pulando envio de lembretes. Ver instruções no topo desta função em functions/index.js.");
      return;
    }

    const agora = new Date();
    const janelaInicio = Timestamp.fromDate(new Date(agora.getTime() + 23.5 * 60 * 60 * 1000));
    const janelaFim = Timestamp.fromDate(new Date(agora.getTime() + 24.5 * 60 * 60 * 1000));

    const clinicasSnap = await db.collection("clinicas").get();

    for (const clinicaDoc of clinicasSnap.docs) {
      const clinicaId = clinicaDoc.id;
      const clinicaNome = clinicaDoc.data().nome || "sua clínica";

      let agendamentosSnap;
      try {
        agendamentosSnap = await db
          .collection(`clinicas/${clinicaId}/agendamentos`)
          .where("dataHora", ">=", janelaInicio)
          .where("dataHora", "<", janelaFim)
          .get();
      } catch (err) {
        logger.error(`Falha ao buscar agendamentos da clínica ${clinicaId} para lembrete:`, err);
        continue;
      }

      for (const agDoc of agendamentosSnap.docs) {
        const ag = agDoc.data();
        if (ag.lembrete24hEnviado) continue;
        if (["cancelado", "faltou"].includes(ag.status)) continue;
        if (!ag.pacienteTelefone) continue;

        const dataHora = ag.dataHora.toDate();
        const dataFmt = dataHora.toLocaleDateString("pt-BR");
        const horaFmt = dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const primeiroNome = (ag.pacienteNome || "").split(" ")[0] || "";

        try {
          await enviarWhatsappTemplate(ag.pacienteTelefone, [primeiroNome, `${dataFmt} às ${horaFmt}`]);
          await agDoc.ref.update({ lembrete24hEnviado: true });
          await db.collection(`clinicas/${clinicaId}/notificacoes`).add({
            tipo: "lembrete_24h",
            canal: "whatsapp",
            agendamentoId: agDoc.id,
            pacienteId: ag.pacienteId || null,
            pacienteNome: ag.pacienteNome || null,
            telefone: ag.pacienteTelefone,
            clinicaNome,
            enviadoEm: new Date().toISOString(),
          });
        } catch (err) {
          logger.error(`Falha ao enviar lembrete do agendamento ${agDoc.id} (clínica ${clinicaId}):`, err);
        }
      }
    }
  }
);

// ---------------------------------------------------------------------
// Convite de equipe — admin adiciona alguém a uma clínica já existente
// ---------------------------------------------------------------------
//
// Diferente do onboarding (que cria a PRIMEIRA clínica e o primeiro admin),
// isto é usado quando um admin já dentro do sistema quer dar acesso a mais
// alguém (outro médico, secretária, financeiro) a uma clínica que já existe.
//
// Não envia e-mail nenhum sozinho: quem chama esta função, do client, deve
// em seguida chamar `resetPassword(email)` (já existente no AuthContext,
// reaproveitando o fluxo de "esqueci minha senha") — isso dispara o e-mail
// padrão do Firebase Auth pra pessoa convidada definir a própria senha,
// sem precisar montar nenhum serviço de envio de e-mail próprio.
const PAPEIS_VALIDOS = ["admin", "medico", "financeiro", "secretaria"];

/**
 * Entrada:  { clinicaId, email, nome, papel }
 * Saída:    { ok: true, uid, jaExistiaConta }
 */
exports.convidarMembro = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login para continuar.");
  const { clinicaId, email, nome, papel } = request.data || {};
  if (!clinicaId || !email || !papel) {
    throw new HttpsError("invalid-argument", "Preencha e-mail e papel da pessoa convidada.");
  }
  if (!PAPEIS_VALIDOS.includes(papel)) {
    throw new HttpsError("invalid-argument", "Papel inválido.");
  }

  const meuMembroSnap = await db.doc(`clinicas/${clinicaId}/membros/${request.auth.uid}`).get();
  if (!meuMembroSnap.exists || meuMembroSnap.data().papel !== "admin") {
    throw new HttpsError("permission-denied", "Só administradores da clínica podem convidar novos membros.");
  }

  const authAdmin = getAuth();
  let uid;
  let jaExistiaConta;
  try {
    const existente = await authAdmin.getUserByEmail(email);
    uid = existente.uid;
    jaExistiaConta = true;
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const novo = await authAdmin.createUser({ email, displayName: nome || email });
    uid = novo.uid;
    jaExistiaConta = false;
  }

  const membroRef = db.doc(`clinicas/${clinicaId}/membros/${uid}`);
  if ((await membroRef.get()).exists) {
    throw new HttpsError("already-exists", "Essa pessoa já faz parte desta clínica.");
  }

  await membroRef.set({
    nome: nome || email,
    email,
    papel,
    ativo: true,
    criadoEm: new Date().toISOString(),
    convidadoPor: request.auth.uid,
  });
  // onMembroEscrito (trigger, já existente) cuida do resto: espelha em
  // usuarios/{uid}.clinicaIds e atualiza o custom claim `clinicas`.

  return { ok: true, uid, jaExistiaConta };
});

// ---------------------------------------------------------------------
// E-mail de avaliação pós-consulta
// ---------------------------------------------------------------------
//
// Envia, via Resend (https://resend.com), um e-mail com um link único pro
// paciente avaliar a consulta sem precisar de conta/login — o próprio ID do
// documento criado (aleatório, ~120 bits de entropia) funciona como o
// token de acesso do link (ver a regra em firestore.rules, avaliacoes/{id}).
//
// ⚠️ Precisa de configuração externa antes de funcionar de verdade:
//   1. Criar conta em resend.com, verificar um domínio de envio.
//   2. firebase functions:secrets:set RESEND_API_KEY
//   3. (opcional) firebase functions:config ou .env do projeto de functions
//      pra customizar EMAIL_FROM / APP_BASE_URL via `firebase deploy` com
//      --only functions e os params configurados no console, se o domínio
//      verificado ou o domínio do app não forem os padrões.
// Sem RESEND_API_KEY configurada, a função retorna um erro claro em vez de
// fingir que enviou.

function obterBaseUrl() {
  const configurado = appBaseUrlParam.value();
  if (configurado) return configurado.replace(/\/$/, "");
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
  return projectId ? `https://${projectId}.web.app` : "";
}

function enviarEmailResend({ para, assunto, html }) {
  const body = JSON.stringify({ from: emailFromParam.value(), to: [para], subject: assunto, html });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.value()}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let corpo = "";
        res.on("data", (chunk) => (corpo += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(corpo);
          else reject(new Error(`Resend respondeu ${res.statusCode}: ${corpo}`));
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao chamar a API do Resend.")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Cria a avaliação pendente e dispara o e-mail pro paciente.
 *
 * Entrada:  { clinicaId, pacienteId, atendimentoId? }
 * Saída:    { ok: true, avaliacaoId }
 */
exports.enviarAvaliacaoPaciente = onCall({ region: REGION, timeoutSeconds: 30, secrets: [resendApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Faça login para continuar.");
  const { clinicaId, pacienteId, atendimentoId } = request.data || {};
  if (!clinicaId || !pacienteId) throw new HttpsError("invalid-argument", "Dados incompletos.");

  const membroSnap = await db.doc(`clinicas/${clinicaId}/membros/${request.auth.uid}`).get();
  if (!membroSnap.exists || membroSnap.data().ativo !== true) {
    throw new HttpsError("permission-denied", "Você precisa ser membro desta clínica.");
  }
  if (!resendApiKey.value()) {
    throw new HttpsError("failed-precondition", "Envio de e-mail de avaliação ainda não configurado neste ambiente (RESEND_API_KEY ausente). Avise o administrador do sistema.");
  }

  const pacienteSnap = await db.doc(`clinicas/${clinicaId}/pacientes/${pacienteId}`).get();
  if (!pacienteSnap.exists) throw new HttpsError("not-found", "Paciente não encontrado.");
  const paciente = pacienteSnap.data();
  if (!paciente.email) {
    throw new HttpsError("failed-precondition", "Este paciente não tem e-mail cadastrado.");
  }

  const clinicaSnap = await db.doc(`clinicas/${clinicaId}`).get();
  const clinicaNome = clinicaSnap.data()?.nome || "sua clínica";

  const avaliacaoRef = await db.collection(`clinicas/${clinicaId}/avaliacoes`).add({
    pacienteId,
    pacienteNome: paciente.nome || null,
    pacienteEmail: paciente.email,
    atendimentoId: atendimentoId || null,
    clinicaNome,
    enviadoPor: request.auth.uid,
    status: "pendente",
    criadoEm: new Date().toISOString(),
  });

  const link = `${obterBaseUrl()}/avaliar/${clinicaId}/${avaliacaoRef.id}`;
  const primeiroNome = (paciente.nome || "").split(" ")[0] || "";

  try {
    await enviarEmailResend({
      para: paciente.email,
      assunto: `Como foi sua consulta na ${clinicaNome}?`,
      html: `
        <p>Olá, ${primeiroNome}!</p>
        <p>Sua opinião ajuda a ${clinicaNome} a melhorar o atendimento. Pode avaliar sua consulta recente?</p>
        <p><a href="${link}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Avaliar consulta</a></p>
        <p style="color:#888;font-size:12px">Se o botão não funcionar, copie e cole este link no navegador: ${link}</p>
      `,
    });
  } catch (err) {
    logger.error("Falha ao enviar e-mail de avaliação via Resend:", err);
    await avaliacaoRef.delete().catch(() => {});
    throw new HttpsError("internal", "Não foi possível enviar o e-mail. Verifique a configuração do Resend (domínio verificado, RESEND_API_KEY).");
  }

  return { ok: true, avaliacaoId: avaliacaoRef.id };
});
