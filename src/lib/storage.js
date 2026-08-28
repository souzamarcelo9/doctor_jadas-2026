import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

/** Envia a foto de um paciente para o Storage e devolve a URL pública.
 * Mesmo padrão de path usado pelo upload de imagens do prontuário
 * (`clinicas/{clinicaId}/pacientes/{pacienteId}/...`), só que numa
 * subpasta própria pra não misturar com anexos clínicos. */
export async function enviarFotoPaciente(clinicaId, pacienteId, file) {
  const path = `clinicas/${clinicaId}/pacientes/${pacienteId}/perfil/foto_${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/** Envia a foto de perfil de um profissional (mostrada na Topbar, ao lado
 * do nome) para o Storage e devolve a URL pública. */
export async function enviarFotoProfissional(clinicaId, profissionalId, file) {
  const path = `clinicas/${clinicaId}/membros/${profissionalId}/perfil/foto_${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
