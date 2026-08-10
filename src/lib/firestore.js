import { useEffect, useState } from "react";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit as fbLimit,
  orderBy as fbOrderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

/**
 * Assina uma subcoleção em tempo real (onSnapshot) e devolve os documentos
 * já com `id`. Usado por todas as abas do prontuário (Queixa, Problemas,
 * Alergias, Conduta, Prescrições...) — é o mesmo padrão em todas.
 *
 * @param {string|null} path - ex: `clinicas/{clinicaId}/pacientes/{pacienteId}/queixas`
 * @param {string} orderByField - campo de ordenação, default "criadoEm"
 * @param {"asc"|"desc"} direction
 */
export function useFirestoreCollection(path, orderByField = "criadoEm", direction = "desc") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseConfigured || !path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, path), fbOrderBy(orderByField, direction));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(`Erro lendo ${path}:`, err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [path, orderByField, direction]);

  return { data, loading, error };
}

/**
 * Como useFirestoreCollection, mas aceita filtros/ordenação/limite arbitrários
 * (where, orderBy, limit) — usado quando a query não é só "tudo, mais recente
 * primeiro" (ex: agendamentos de um dia específico, notas do mês).
 *
 * @param {string|null} path
 * @param {Array} constraints - array de where(...)/orderBy(...)/limit(...) já construídos
 * @param {Array} deps - dependências que, ao mudar, devem refazer a assinatura
 */
export function useFirestoreQuery(path, constraints = [], deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseConfigured || !path) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(`Erro lendo ${path}:`, err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, loading, error };
}

// Nota de arquitetura: este projeto evita `collectionGroup` de propósito.
// Duas vezes seguidas (na consulta de vínculos do usuário e na de
// atendimentos do mês), consultas do tipo collectionGroup combinadas com
// nossas Security Rules devolveram "Missing or insufficient permissions"
// mesmo com regras corretas para leituras diretas (get) — então preferimos
// coleções diretas no nível da clínica (ex: `clinicas/{id}/atendimentos`
// com um campo `pacienteId`, em vez de aninhar sob cada paciente) sempre que
// for preciso agregar dados entre vários pacientes/profissionais.

export { where, fbLimit as limit, fbOrderBy as orderBy };

/** Cria um documento numa subcoleção, carimbando criadoEm automaticamente. */
export async function criarDocumento(path, dados) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado (modo demo).");
  return addDoc(collection(db, path), { ...dados, criadoEm: serverTimestamp() });
}

/** Atualiza campos de um documento existente. */
export async function atualizarDocumento(path, id, dados) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado (modo demo).");
  return updateDoc(doc(db, path, id), dados);
}

/** Alterna o campo `ativo` de um documento (usado pelos toggles "Inativar"). */
export async function alternarAtivo(path, id, ativo) {
  return atualizarDocumento(path, id, { ativo });
}

export async function excluirDocumento(path, id) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado (modo demo).");
  return deleteDoc(doc(db, path, id));
}

/** Cria/atualiza um documento com ID explícito (merge), usado quando o ID
 * precisa ser previsível — ex: um exame físico por atendimento. */
export async function salvarDocumentoComId(path, id, dados, carimbarCriacao = false) {
  if (!firebaseConfigured) throw new Error("Firebase não configurado (modo demo).");
  const payload = carimbarCriacao ? { ...dados, criadoEm: serverTimestamp() } : dados;
  return setDoc(doc(db, path, id), payload, { merge: true });
}

/** Lê um único documento (sem realtime) por ID — usado para o exame físico do atendimento atual. */
export function useFirestoreDoc(path, id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !path || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, path, id),
      (snap) => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro lendo documento ${path}/${id}:`, err);
        setLoading(false);
      }
    );
    return unsub;
  }, [path, id]);

  return { data, loading };
}
