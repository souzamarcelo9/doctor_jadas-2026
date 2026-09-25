import { criarDocumento } from "./firestore";

/** Registra uma alteração em dado clínico (sinais vitais, medidas,
 * doenças pré-existentes/vícios etc.) formando uma trilha de auditoria
 * visível na própria aba — complementar ao logsAcesso.js, que só registra
 * QUEM ABRIU o prontuário, nunca O QUE foi alterado dentro dele. Cada
 * registro clínico já é imutável por natureza (cada "salvar" cria um
 * documento novo, nunca sobrescreve o anterior), mas isso sozinho não
 * aparecia em lugar nenhum da UI — daí esse log específico, com um resumo
 * pronto pra exibir numa lista.
 * Silencioso em caso de falha, mesma lógica do logsAcesso: um erro aqui
 * não deve travar o atendimento por causa de um log. */
export async function registrarHistoricoClinico(clinicaId, pacienteId, { tipo, acao, resumo, uid, nomeUsuario, atendimentoId }) {
  if (!clinicaId || !pacienteId) return;
  try {
    await criarDocumento(`clinicas/${clinicaId}/pacientes/${pacienteId}/historicoClinico`, {
      tipo, // "sinaisVitais" | "medidas" | "problemas"
      acao, // "registrou" | "editou" | "inativou"
      resumo,
      uid: uid || null,
      nomeUsuario: nomeUsuario || "—",
      atendimentoId: atendimentoId || null,
    });
  } catch (err) {
    console.error("Erro ao registrar histórico clínico:", err);
  }
}

export const TIPO_LABEL = {
  sinaisVitais: "Sinais Vitais",
  medidas: "Medidas",
  problemas: "Doenças Pré-existentes / Vícios",
};
