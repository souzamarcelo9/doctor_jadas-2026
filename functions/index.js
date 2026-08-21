const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

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
const GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

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
