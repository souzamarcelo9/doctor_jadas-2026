import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

/** Convida alguém pra fazer parte da clínica (cria/reaproveita a conta no
 * Firebase Auth + vínculo em membros). Não dispara e-mail nenhum — depois
 * de chamar isso com sucesso, o chamador deve chamar `resetPassword(email)`
 * (do AuthContext) pra mandar o e-mail de "definir senha" pra pessoa. */
export async function convidarMembro(clinicaId, { email, nome, papel }) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "convidarMembro");
  const { data } = await chamar({ clinicaId, email, nome, papel });
  return data; // { ok, uid, jaExistiaConta }
}
