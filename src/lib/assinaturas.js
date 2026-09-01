import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

/** Assina digitalmente um documento clínico (conduta, prescrição ou
 * encaminhamento) com o certificado digital configurado na clínica. Veja o
 * aviso de limitação (não é um envelope CAdES/PAdES ICP-Brasil) no
 * comentário da própria Cloud Function, em functions/index.js. */
export async function assinarDocumento(clinicaId, pacienteId, modulo, documentoId) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "assinarDocumento");
  const { data } = await chamar({ clinicaId, pacienteId, modulo, documentoId });
  return data; // { ok, assinadoEm, certificadoCn }
}
