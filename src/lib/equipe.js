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

/** Recalcula usuarios/{uid}.clinicaIds + o custom claim `clinicas` de
 * TODOS os usuários, direto dos vínculos reais em `membros` — útil como
 * "força atualização de permissões" quando alguém está logado mas não
 * enxerga uma clínica que deveria (ver comentário da função no
 * functions/index.js pra entender por que isso pode acontecer). */
export async function recalcularTodosOsClaims() {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "recalcularTodosOsClaims");
  const { data } = await chamar();
  return data; // { ok, usuariosAtualizados }
}
