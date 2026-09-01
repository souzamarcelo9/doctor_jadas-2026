import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { user, loading, firebaseConfigured, clinicaIds } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f8f8]">
        <div className="flex flex-col items-center gap-3 text-ink-500">
          <Loader2 size={28} className="animate-spin text-brand-500" />
          <span className="text-sm">Verificando sessão…</span>
        </div>
      </div>
    );
  }

  // Sem Firebase configurado ainda, deixamos navegar livremente pelo protótipo
  // (modo demo) em vez de travar numa tela de login que não tem como autenticar.
  if (!firebaseConfigured) return children;

  if (!user) return <Navigate to="/login" replace />;

  // Autenticado, mas sem nenhuma clínica vinculada ainda (conta nova, ou
  // custom claim que ainda não propagou) — manda pro onboarding criar a
  // primeira clínica, em vez de deixar o app tentar renderizar sem
  // clinicaId nenhum.
  if (clinicaIds.length === 0 && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
