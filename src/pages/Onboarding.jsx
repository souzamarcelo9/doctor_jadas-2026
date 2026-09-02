import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { criarClinica } from "../lib/onboarding";
import { Building2, ArrowRight, AlertTriangle, Loader2, LogOut } from "lucide-react";
import logoNucleo from "../assets/logo-nucleo.png";

export default function Onboarding() {
  const { user, clinicaIds, loading: authLoading, logout, refrescarClaims, firebaseConfigured } = useAuth();
  const navigate = useNavigate();

  const [nomeClinica, setNomeClinica] = useState("");
  const [criando, setCriando] = useState(false);
  const [error, setError] = useState("");

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  // Já tem clínica vinculada — não tem o que fazer aqui, manda pro app.
  if (!authLoading && clinicaIds.length > 0) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nomeClinica.trim()) return;
    setError("");
    setCriando(true);
    try {
      await criarClinica(nomeClinica.trim());
      await refrescarClaims();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao criar clínica:", err);
      setError(err.message || "Não foi possível criar a clínica. Tente novamente.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f8f8] p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <img src={logoNucleo} alt="Núcleo" className="w-9 h-9 object-contain" />
          <span className="font-display font-semibold tracking-wide text-ink-900">Doctor<span className="text-brand-500">PEP</span></span>
        </div>

        <div className="card p-7">
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <Building2 size={20} />
          </div>
          <h1 className="font-display font-semibold text-lg text-ink-900">Vamos criar sua clínica</h1>
          <p className="text-sm text-ink-500 mt-1 mb-6">
            Sua conta ainda não tem nenhuma clínica vinculada. Dê um nome pra ela — dá pra ajustar os outros dados depois, em Configurações.
          </p>

          {!firebaseConfigured && (
            <div className="mb-5 flex items-start gap-2.5 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> Firebase ainda não configurado neste ambiente.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-500">Nome da clínica</span>
              <input
                required
                value={nomeClinica}
                onChange={(e) => setNomeClinica(e.target.value)}
                placeholder="Ex: Clínica Diniz"
                className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 focus-ring"
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={criando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {criando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {criando ? "Criando…" : "Criar clínica e continuar"}
            </button>
          </form>
        </div>

        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900 mx-auto mt-5 focus-ring">
          <LogOut size={13} /> Sair e entrar com outra conta
        </button>
      </div>
    </div>
  );
}
