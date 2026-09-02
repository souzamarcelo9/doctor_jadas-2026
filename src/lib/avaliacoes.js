import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

/** Cria a avaliação pendente e dispara o e-mail pro paciente avaliar a
 * consulta, com um link que não exige login (ver AvaliarConsulta.jsx). */
export async function enviarAvaliacaoPaciente(clinicaId, pacienteId, atendimentoId) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "enviarAvaliacaoPaciente");
  const { data } = await chamar({ clinicaId, pacienteId, atendimentoId: atendimentoId || null });
  return data; // { ok, avaliacaoId }
}
