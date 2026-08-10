import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // IDs das clínicas em que o usuário tem vínculo, lidos do custom claim do
  // token (definido pelo seed / futuramente por uma Cloud Function ao criar
  // um vínculo em `membros`) — evita depender de uma query Firestore
  // (collectionGroup) logo na primeira tela após o login.
  const [clinicaIds, setClinicaIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Perfil estendido (papel, clínica, especialidade) vive em /usuarios/{uid}
          // — ver modelagem de dados do Firestore no próximo passo do projeto.
          const snap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } catch {
          setProfile(null);
        }
        try {
          // force refresh na primeira leitura pós-login evita ficar preso a um
          // token em cache que ainda não tem o claim mais recente (ex: logo
          // depois de rodar o seed e ganhar acesso a uma clínica nova).
          const token = await firebaseUser.getIdTokenResult(true);
          setClinicaIds(token.claims?.clinicas || []);
        } catch (err) {
          console.error("Erro ao ler custom claims:", err);
          setClinicaIds([]);
        }
      } else {
        setProfile(null);
        setClinicaIds([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(email, password, remember) {
    if (!firebaseConfigured) {
      throw new Error(
        "Firebase ainda não configurado. Preencha o arquivo .env com as credenciais do seu projeto (veja .env.example)."
      );
    }
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    if (!firebaseConfigured) return Promise.resolve();
    return firebaseSignOut(auth);
  }

  function resetPassword(email) {
    if (!firebaseConfigured) return Promise.resolve();
    return sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider value={{ user, profile, clinicaIds, loading, login, logout, resetPassword, firebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return ctx;
}
