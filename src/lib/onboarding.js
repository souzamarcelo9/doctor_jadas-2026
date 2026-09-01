import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

/** Cria uma clínica nova e vincula o usuário logado como admin dela.
 * Depois de chamar isso, é preciso rechamar `refrescarClaims()` (do
 * AuthContext) antes de navegar — a Cloud Function já atualiza o custom
 * claim no servidor, mas o token em cache no navegador só reflete isso
 * depois de um refresh explícito. */
export async function criarClinica(nomeClinica) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "criarClinica");
  const { data } = await chamar({ nomeClinica });
  return data; // { ok, clinicaId }
}
