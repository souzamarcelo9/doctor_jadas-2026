import { criarDocumento } from "./firestore";

/** Registra que um profissional abriu o prontuário de um paciente — trilha
 * de auditoria exigida como boa prática pra dado de saúde (LGPD art. 46).
 * Silencioso em caso de falha: um erro aqui não deve travar o atendimento
 * em si, só perder aquele registro específico de log (raro, e não crítico
 * o bastante pra interromper o trabalho de quem está atendendo). */
export async function registrarAcessoPaciente(clinicaId, { uid, nomeUsuario, pacienteId, pacienteNome }) {
  try {
    await criarDocumento(`clinicas/${clinicaId}/logsAcesso`, {
      uid,
      nomeUsuario: nomeUsuario || "—",
      pacienteId,
      pacienteNome: pacienteNome || "—",
      acao: "abriu_prontuario",
    });
  } catch (err) {
    console.error("Erro ao registrar acesso (log LGPD):", err);
  }
}
