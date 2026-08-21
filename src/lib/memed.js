import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

/** Pede (ou reaproveita) o token de acesso do médico na Memed.
 * Lança um erro com `.code === "functions/failed-precondition"` e
 * `.details.camposFaltando` (array) quando o cadastro do médico ainda não
 * tem os dados obrigatórios exigidos pela Memed. */
export async function memedObterToken(clinicaId, forcarNovoLogin = false) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "memedObterToken");
  const { data } = await chamar({ clinicaId, forcarNovoLogin });
  return data.token;
}
