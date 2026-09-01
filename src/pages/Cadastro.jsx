import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Lock, Eye, EyeOff, UserPlus, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

const BG_IMAGE = "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?fm=jpg&q=80&w=1800&auto=format&fit=crop";

export default function Cadastro() {
  const { signup, user, firebaseConfigured } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/onboarding" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, nome);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: `url(${BG_IMAGE})` }} />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-900/80 to-brand-700/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(63,196,192,0.25),transparent_45%)]" />

      <div className="relative w-full max-w-4xl grid lg:grid-cols-5 rounded-xl2 overflow-hidden shadow-pop">
        <div className="hidden lg:flex lg:col-span-2 flex-col justify-between p-8 bg-white/5 backdrop-blur-md border-r border-white/10 text-white">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-brand-400 flex items-center justify-center font-display font-bold text-brand-950 text-sm">DP</div>
              <span className="font-display font-semibold tracking-wide">Doctor<span className="text-brand-300">PEP</span></span>
            </div>
            <h1 className="font-display font-semibold text-2xl leading-snug mt-10">Comece a usar em poucos minutos.</h1>
            <p className="text-sm text-white/70 mt-3 leading-relaxed">
              Crie sua conta, depois configure sua clínica — sem precisar de ninguém do suporte pra liberar o acesso.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60"><ShieldCheck size={15} /> Dados protegidos conforme a LGPD</div>
        </div>

        <div className="lg:col-span-3 bg-white p-8 sm:p-10 flex flex-col justify-center">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-display font-bold text-white text-sm">DP</div>
            <span className="font-display font-semibold tracking-wide text-ink-900">Doctor<span className="text-brand-500">PEP</span></span>
          </div>

          <h2 className="font-display font-semibold text-xl text-ink-900">Criar conta</h2>
          <p className="text-sm text-ink-500 mt-1 mb-6">O próximo passo é configurar sua clínica.</p>

          {!firebaseConfigured && (
            <div className="mb-5 flex items-start gap-2.5 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                Firebase ainda não configurado neste ambiente — preencha o arquivo <code className="font-mono">.env</code> com
                as credenciais do projeto (veja <code className="font-mono">.env.example</code>).
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-500">Seu nome</span>
              <div className="relative mt-1">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dra. Ana Souza" className="w-full text-sm border border-black/10 rounded-lg pl-9 pr-3 py-2.5 focus-ring" />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink-500">E-mail</span>
              <div className="relative mt-1">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@suaclinica.com.br" className="w-full text-sm border border-black/10 rounded-lg pl-9 pr-3 py-2.5 focus-ring" />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink-500">Senha</span>
              <div className="relative mt-1">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input type={showPw ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" className="w-full text-sm border border-black/10 rounded-lg pl-9 pr-9 py-2.5 focus-ring" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900" tabIndex={-1}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading ? "Criando conta…" : "Criar conta"}
            </button>
          </form>

          <p className="text-xs text-ink-500 mt-6 text-center">
            Já tem conta? <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function mapFirebaseError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "Já existe uma conta com esse e-mail — tente entrar em vez de criar uma nova.";
  if (code.includes("invalid-email")) return "E-mail inválido.";
  if (code.includes("weak-password")) return "Senha muito fraca — use pelo menos 6 caracteres.";
  if (code.includes("network-request-failed")) return "Falha de conexão. Verifique sua internet e tente novamente.";
  return err?.message || "Não foi possível criar a conta. Tente novamente.";
}
