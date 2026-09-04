import { useState } from "react";
import { Bell, HelpCircle, ThumbsUp, Maximize2, Minimize2, LogOut, ChevronDown, FileSignature, MessageSquarePlus, X, Send, CheckCircle2, Loader2 } from "lucide-react";

// TODO: trocar pelo link real da central de ajuda quando existir — por
// enquanto aponta pro site institucional como placeholder.
const URL_CENTRAL_AJUDA = "https://jads-apps.com.br/ajuda";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc, useFirestoreCollection, useFirestoreQuery, where, orderBy, criarDocumento } from "../lib/firestore";
import ClinicSwitcher from "./ClinicSwitcher";
import { currentUser as demoUser } from "../data/mockData";

export default function Topbar({ title, timer }) {
  const { user, profile, logout, firebaseConfigured } = useAuth();
  const { clinicaId, profissionalId } = useTenant();
  const { data: membro } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/membros` : null, profissionalId);
  const { data: notificacoes } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/notificacoes` : null, "enviadoEm", "desc");
  const { data: assinaturasPendentes } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/assinaturasPendentes` : null,
    [where("profissionalId", "==", profissionalId), orderBy("criadoEm", "desc")],
    [profissionalId]
  );
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const displayName = membro?.nome || profile?.nome || user?.displayName || user?.email || demoUser.name;
  const displayStatus = firebaseConfigured ? (profile?.status || "Disponível") : `${demoUser.status} (modo demo)`;
  const fotoUrl = membro?.fotoUrl || "";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const notificacoesRecentes = notificacoes.slice(0, 15);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function alternarTelaCheia() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setTelaCheia(true);
    } else {
      document.exitFullscreen?.();
      setTelaCheia(false);
    }
  }

  function formatarNotifData(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="font-display font-semibold text-ink-900 text-base lg:text-lg truncate">{title}</h1>
        {timer && (
          <span className="hidden sm:inline text-xs text-ink-500 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
            Tempo de atendimento: <span className="font-semibold text-brand-700">{timer}</span>
          </span>
        )}
        <ClinicSwitcher />
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <button onClick={() => navigate("/assinaturas")} className="hidden sm:flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900 px-2.5 py-1.5 rounded-lg hover:bg-black/5 focus-ring">
          <FileSignature size={14} />
          Assinaturas
          {assinaturasPendentes.length > 0 && (
            <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">{assinaturasPendentes.length}</span>
          )}
        </button>
        <button onClick={alternarTelaCheia} title={telaCheia ? "Sair da tela cheia" : "Tela cheia"} className="p-2 rounded-lg hover:bg-black/5 text-ink-500 focus-ring">
          {telaCheia ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>

        <div className="relative">
          <button onClick={() => setNotifOpen((o) => !o)} className="p-2 rounded-lg hover:bg-black/5 text-ink-500 relative focus-ring">
            <Bell size={17} />
            {notificacoesRecentes.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-pop border border-black/5 py-1.5 z-20">
                <div className="px-3.5 py-1.5 text-[11px] font-semibold text-ink-500 uppercase tracking-wide">Notificações</div>
                {notificacoesRecentes.length === 0 && <p className="px-3.5 py-4 text-xs text-ink-500">Nenhuma notificação ainda.</p>}
                {notificacoesRecentes.map((n) => (
                  <div key={n.id} className="px-3.5 py-2 text-xs border-t border-black/5 first:border-t-0">
                    <div className="text-ink-900">
                      {n.tipo === "lembrete_24h" ? `Lembrete de consulta enviado pra ${n.pacienteNome || "paciente"}` : n.tipo || "Notificação"}
                    </div>
                    <div className="text-[10px] text-ink-500 mt-0.5">{formatarNotifData(n.enviadoEm)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <a href={URL_CENTRAL_AJUDA} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-black/5 text-ink-500 focus-ring"><HelpCircle size={17} /></a>
        <button onClick={() => setFeedbackOpen(true)} title="Enviar feedback" className="p-2 rounded-lg hover:bg-black/5 text-ink-500 focus-ring"><ThumbsUp size={17} /></button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-black/10 focus-ring rounded-lg"
          >
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
              {fotoUrl ? <img src={fotoUrl} alt="" className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <div className="text-xs font-semibold text-ink-900 max-w-[140px] truncate">{displayName}</div>
              <div className="text-[11px] text-emerald-600">{displayStatus}</div>
            </div>
            <ChevronDown size={14} className="hidden sm:block text-ink-500" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-pop border border-black/5 py-1.5 z-20">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 focus-ring"
                >
                  <LogOut size={14} /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {feedbackOpen && (
        <FeedbackModal clinicaId={clinicaId} profissionalId={profissionalId} onClose={() => setFeedbackOpen(false)} />
      )}
    </header>
  );
}

function FeedbackModal({ clinicaId, profissionalId, onClose }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    if (!texto.trim()) return;
    setErro("");
    setEnviando(true);
    try {
      await criarDocumento(`clinicas/${clinicaId}/feedback`, {
        texto: texto.trim(),
        profissionalId,
        pagina: window.location.pathname,
      });
      setEnviado(true);
    } catch (err) {
      console.error("Erro ao enviar feedback:", err);
      setErro(err.message || "Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><MessageSquarePlus size={18} /> Enviar feedback</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {enviado ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <CheckCircle2 size={16} /> Obrigado! Seu feedback foi enviado.
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-500">O que você achou do sistema, ou o que poderia melhorar? Sua mensagem vai direto pra equipe.</p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                placeholder="Conte pra gente…"
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 focus-ring resize-none"
              />
              {erro && <p className="text-xs text-rose-600">{erro}</p>}
              <button onClick={enviar} disabled={enviando || !texto.trim()} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
