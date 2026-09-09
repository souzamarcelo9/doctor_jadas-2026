/**
 * Cria (ou promove) um usuário administrador para uma clínica já existente.
 * Serve para o caso de "ovo e galinha": uma clínica criada pelo seed.js ou
 * por qualquer outro caminho que não passou pelo onboarding (que cria o
 * primeiro admin sozinho) fica sem ninguém com papel "admin" — e sem um
 * admin, ninguém consegue usar a tela de Equipe pra convidar mais gente
 * (convidarMembro exige que quem chama já seja admin).
 *
 * Diferente do seed.js, este script não mexe em nenhum outro dado — só
 * garante a conta no Firebase Auth e o vínculo admin nesta clínica. É
 * seguro rodar mais de uma vez (idempotente): se o e-mail já existe,
 * reaproveita a conta; se o vínculo já existe, só atualiza o papel.
 *
 * Como rodar:
 *   1. Ajuste ADMIN_EMAIL, ADMIN_SENHA e ADMIN_NOME abaixo.
 *   2. Garanta que `serviceAccountKey.json` está na raiz do projeto (mesmo
 *      arquivo usado pelo seed.js — ver instruções lá).
 *   3. node scripts/criarAdmin.js
 *
 * Depois de rodar, é só entrar em /login com o e-mail e senha definidos
 * aqui — o custom claim é sincronizado automaticamente pelo gatilho
 * onMembroEscrito (Cloud Functions), então não precisa de nenhum passo
 * manual extra.
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const CLINICA_ID = "teste-clinica-diniz";
const CLINICA_NOME = "Teste Clínica Diniz";

const ADMIN_EMAIL = "admin@testeclinicadiniz.com.br";
const ADMIN_SENHA = "Admin123!";
const ADMIN_NOME = "Administrador Teste";

async function garantirUsuarioAuth() {
  try {
    const existente = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`Usuário já existia no Auth: ${existente.uid}`);
    return existente.uid;
  } catch {
    const novo = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_SENHA,
      displayName: ADMIN_NOME,
    });
    console.log(`Usuário criado no Auth: ${novo.uid}`);
    return novo.uid;
  }
}

async function main() {
  const uid = await garantirUsuarioAuth();

  await db.doc(`usuarios/${uid}`).set(
    {
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      criadoEm: new Date().toISOString(),
    },
    { merge: true }
  );

  await db.doc(`clinicas/${CLINICA_ID}/membros/${uid}`).set(
    {
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      clinicaNome: CLINICA_NOME,
      papel: "admin",
      ativo: true,
      criadoEm: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(`\nPronto! Vínculo admin criado em clinicas/${CLINICA_ID}/membros/${uid}.`);
  console.log(`A escrita acima já disparou o gatilho onMembroEscrito, que sincroniza`);
  console.log(`o custom claim automaticamente — pode entrar direto em /login com:`);
  console.log(`  e-mail: ${ADMIN_EMAIL}`);
  console.log(`  senha:  ${ADMIN_SENHA}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro ao criar admin:", err);
    process.exit(1);
  });
