import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { functionsInstance, firebaseConfigured, storage } from "../firebase";
import { criarDocumento } from "./firestore";

export function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    leitor.readAsDataURL(blob);
  });
}

/** Envia o PDF como anexo de e-mail ao paciente (função documentoEnviarPorEmail). */
export async function enviarDocumentoPorEmail({ clinicaId, pacienteId, email, titulo, nomeArquivo, blob }) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const pdfBase64 = await blobParaBase64(blob);
  const chamar = httpsCallable(functionsInstance, "documentoEnviarPorEmail");
  const { data } = await chamar({ clinicaId, pacienteId, email, titulo, nomeArquivo, pdfBase64 });
  return data;
}

/** Guarda uma cópia do PDF no Storage (pasta do paciente) e devolve o link
 * de download — usado pra mandar pelo WhatsApp, que não aceita anexo via link wa.me. */
export async function publicarDocumentoParaLink({ clinicaId, pacienteId, blob, nomeArquivo }) {
  const caminho = `clinicas/${clinicaId}/pacientes/${pacienteId}/documentos/${Date.now()}_${nomeArquivo}`;
  const arquivoRef = ref(storage, caminho);
  await uploadBytes(arquivoRef, blob, { contentType: "application/pdf" });
  return { url: await getDownloadURL(arquivoRef), storagePath: caminho };
}

/** Registro simples de quem enviou o quê e por qual canal (auditoria). */
export function registrarEnvioDocumento(pacientePath, dados) {
  return criarDocumento(`${pacientePath}/documentosEnviados`, dados);
}
