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

/** Limpa os tokens da Memed cacheados nos médicos da clínica — usar uma
 * vez depois de trocar de ambiente (teste → produção) ou de chaves. */
export async function memedLimparTokensCache(clinicaId) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "memedLimparTokensCache");
  const { data } = await chamar({ clinicaId });
  return data; // { ok, limpos }
}
