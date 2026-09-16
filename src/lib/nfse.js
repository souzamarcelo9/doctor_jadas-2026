import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Envia o certificado (.pfx/.p12) + senha para ser guardado com segurança
 * no Secret Manager. Só administradores da clínica podem chamar isso (a
 * Cloud Function confere o papel do lado do servidor também). */
export async function nfseSalvarCertificado(clinicaId, arquivo, senha) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const arquivoBase64 = await blobParaBase64(arquivo);
  const chamar = httpsCallable(functionsInstance, "nfseSalvarCertificado");
  const { data } = await chamar({ clinicaId, arquivoBase64, senha, nomeArquivo: arquivo.name });
  return data; // { ok, nomeCertificado, validoAte }
}

/** Monta, assina e tenta enviar o RPS à Prefeitura (modo teste por padrão —
 * não gera NF-e real mesmo que o certificado seja aceito). */
export async function nfseEmitir(clinicaId, notaFiscalId, dados) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "nfseEmitir");
  const { data } = await chamar({ clinicaId, notaFiscalId, dados });
  return data; // { status, detalhe }
}

/** Relê a resposta já salva em cada nota fiscal e recalcula o status
 * (autorizada/rejeitada) — não faz nenhuma chamada nova à Prefeitura, só
 * corrige documentos antigos que ficaram presos como "processando". */
export async function nfseRecalcularStatus(clinicaId) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "nfseRecalcularStatus");
  const { data } = await chamar({ clinicaId });
  return data; // { ok, atualizadas, total }
}