import { httpsCallable } from "firebase/functions";
import { functionsInstance, firebaseConfigured } from "../firebase";

/** Converte um Blob de áudio (gravado no navegador) para base64, formato que
 * o Cloud Function `transcreverAudio` espera receber. */
function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Transcreve um áudio de consulta via Groq (Whisper), através da Cloud Function. */
export async function transcreverAudio(audioBlob, idioma = "pt") {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const audioBase64 = await blobParaBase64(audioBlob);
  const chamar = httpsCallable(functionsInstance, "transcreverAudio");
  const { data } = await chamar({ audioBase64, idioma });
  return data.texto;
}

/** Gera o resumo da queixa + sugestões clínicas a partir de uma transcrição,
 * via Groq (Llama), através da Cloud Function. */
export async function sumarizarConsulta(transcricao) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado.");
  const chamar = httpsCallable(functionsInstance, "sumarizarConsulta");
  const { data } = await chamar({ transcricao });
  return data; // { queixaResumo, sugestoes }
}
