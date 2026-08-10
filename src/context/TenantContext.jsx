import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  collection, doc, getDoc, addDoc, updateDoc,
  query, where, limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { useAuth } from "./AuthContext";

const TenantContext = createContext(null);
const STORAGE_KEY = "doctorpep:clinicaAtiva";

export function TenantProvider({ children }) {
  const { user, clinicaIds, firebaseConfigured: fbReady } = useAuth();
  const profissionalId = user?.uid || null;

  const [clinicasDisponiveis, setClinicasDisponiveis] = useState([]);
  const [loadingClinicas, setLoadingClinicas] = useState(true);
  const [clinicaId, setClinicaIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  const [pacienteId, setPacienteIdState] = useState(null);
  const [atendimentoId, setAtendimentoId] = useState(null);
  const [loadingAtendimento, setLoadingAtendimento] = useState(false);

  // Os IDs das clínicas vêm do custom claim do token (AuthContext). Aqui só
  // buscamos o documento de vínculo (`membros/{uid}`) de cada uma — um `get()`
  // direto por clínica, não uma query — para pegar papel/nome de exibição.
  useEffect(() => {
    let cancelado = false;
    async function carregarClinicas() {
      if (!firebaseConfigured || !profissionalId || clinicaIds.length === 0) {
        setClinicasDisponiveis([]);
        setLoadingClinicas(false);
        return;
      }
      setLoadingClinicas(true);
      try {
        const docs = await Promise.all(
          clinicaIds.map((cid) => getDoc(doc(db, `clinicas/${cid}/membros`, profissionalId)))
        );
        if (cancelado) return;
        const lista = docs
          .filter((d) => d.exists() && d.data().ativo)
          .map((d) => ({ clinicaId: d.ref.parent.parent.id, papel: d.data().papel, nome: d.data().clinicaNome || d.ref.parent.parent.id }));
        setClinicasDisponiveis(lista);
        setClinicaIdState((atual) => {
          if (atual && lista.some((c) => c.clinicaId === atual)) return atual;
          return lista[0]?.clinicaId || null;
        });
      } catch (err) {
        console.error("Erro ao carregar clínicas do usuário:", err);
      } finally {
        if (!cancelado) setLoadingClinicas(false);
      }
    }
    carregarClinicas();
    return () => { cancelado = true; };
  }, [profissionalId, clinicaIds]);

  const trocarClinica = useCallback((id) => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    setClinicaIdState(id);
    setPacienteIdState(null);
    setAtendimentoId(null);
  }, []);

  const selecionarPaciente = useCallback((id) => {
    setPacienteIdState(id);
    setAtendimentoId(null);
  }, []);

  // Garante um atendimento "em_andamento" assim que um paciente é selecionado.
  useEffect(() => {
    let cancelado = false;
    async function garantirAtendimentoDoDia() {
      if (!firebaseConfigured || !profissionalId || !clinicaId || !pacienteId) return;
      setLoadingAtendimento(true);
      try {
        const atendimentosRef = collection(db, `clinicas/${clinicaId}/atendimentos`);
        const q = query(atendimentosRef, where("pacienteId", "==", pacienteId), where("status", "==", "em_andamento"), where("profissionalId", "==", profissionalId), limit(1));
        const snap = await getDocs(q);
        if (!cancelado && !snap.empty) {
          setAtendimentoId(snap.docs[0].id);
        } else if (!cancelado) {
          const novo = await addDoc(atendimentosRef, {
            clinicaId, pacienteId, profissionalId, dataHora: serverTimestamp(), status: "em_andamento", origem: "presencial",
          });
          if (!cancelado) setAtendimentoId(novo.id);
        }
      } catch (err) {
        console.error("Erro ao garantir atendimento do dia:", err);
      } finally {
        if (!cancelado) setLoadingAtendimento(false);
      }
    }
    garantirAtendimentoDoDia();
    return () => { cancelado = true; };
  }, [clinicaId, pacienteId, profissionalId]);

  async function finalizarAtendimento() {
    if (!firebaseConfigured || !atendimentoId || !clinicaId || !pacienteId) return;
    await updateDoc(doc(db, `clinicas/${clinicaId}/atendimentos`, atendimentoId), { status: "finalizado" });
  }

  const pacientePath = clinicaId && pacienteId ? `clinicas/${clinicaId}/pacientes/${pacienteId}` : null;

  return (
    <TenantContext.Provider
      value={{
        clinicaId,
        clinicasDisponiveis,
        loadingClinicas,
        trocarClinica,
        pacienteId,
        selecionarPaciente,
        atendimentoId,
        profissionalId,
        loadingAtendimento,
        pacientePath,
        finalizarAtendimento,
        firebaseConfigured: fbReady,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de um TenantProvider");
  return ctx;
}
