import { useState } from "react";
import { X, Users, UserPlus, Loader2, CheckCircle2, AlertTriangle, Power, RefreshCcw } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { useFirestoreCollection, atualizarDocumento } from "../lib/firestore";
import { convidarMembro, recalcularTodosOsClaims } from "../lib/equipe";

const PAPEIS = [
  { valor: "medico", label: "Médico" },
  { valor: "secretaria", label: "Secretária(o)" },
  { valor: "financeiro", label: "Financeiro" },
  { valor: "admin", label: "Administrador" },
];
const papelLabel = Object.fromEntries(PAPEIS.map((p) => [p.valor, p.label]));

export default function EquipeModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const { resetPassword } = useAuth();
  const { data: membros, loading } = useFirestoreCollection(open && clinicaId ? `clinicas/${clinicaId}/membros` : null, "nome", "asc");

  const [form, setForm] = useState({ nome: "", email: "", papel: "secretaria" });
  const [convidando, setConvidando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [recalculando, setRecalculando] = useState(false);
  const [msgRecalculo, setMsgRecalculo] = useState("");

  async function handleRecalcular() {
    setRecalculando(true);
    setMsgRecalculo("");
    try {
      const resultado = await recalcularTodosOsClaims();
      setMsgRecalculo(`Pronto — ${resultado.usuariosAtualizados} usuário(s) com o acesso recalculado. Peça pra pessoa afetada sair e entrar de novo.`);
    } catch (err) {
      console.error("Erro ao recalcular claims:", err);
      setMsgRecalculo(err.message || "Não foi possível recalcular. Tente novamente.");
    } finally {
      setRecalculando(false);
    }
  }

  if (!open) return null;

  async function handleConvidar(e) {
    e.preventDefault();
    setErro(""); setSucesso("");
    if (!form.email.trim()) { setErro("Informe o e-mail da pessoa."); return; }
    setConvidando(true);
    try {
      const resultado = await convidarMembro(clinicaId, form);
      await resetPassword(form.email.trim());
      setSucesso(
        resultado.jaExistiaConta
          ? `${form.nome || form.email} já tinha conta — agora tem acesso a esta clínica também. Um e-mail foi enviado pra confirmar o acesso.`
          : `Convite enviado! ${form.nome || form.email} vai receber um e-mail pra definir a senha e entrar.`
      );
      setForm({ nome: "", email: "", papel: "secretaria" });
    } catch (err) {
      console.error("Erro ao convidar membro:", err);
      setErro(mapErro(err));
    } finally {
      setConvidando(false);
    }
  }

  async function alternarAtivo(membro) {
    await atualizarDocumento(`clinicas/${clinicaId}/membros`, membro.id, { ativo: !membro.ativo });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><Users size={18} /> Equipe</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
            {!loading && membros.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border border-black/5 rounded-lg p-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {(m.nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{m.nome}</div>
                  <div className="text-[11px] text-ink-500 truncate">{m.email}</div>
                </div>
                <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full shrink-0">{papelLabel[m.papel] || m.papel}</span>
                <button
                  onClick={() => alternarAtivo(m)}
                  title={m.ativo ? "Desativar acesso" : "Reativar acesso"}
                  className={`p-1.5 rounded-lg shrink-0 focus-ring ${m.ativo ? "text-emerald-600 hover:bg-emerald-50" : "text-ink-500 hover:bg-gray-100"}`}
                >
                  <Power size={14} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleConvidar} className="space-y-3 pt-3 border-t border-black/5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-700"><UserPlus size={14} /> Convidar alguém novo</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-ink-500 font-medium">Nome</span>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
              </label>
              <label className="block text-xs">
                <span className="text-ink-500 font-medium">Papel</span>
                <select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                  {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">E-mail</span>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pessoa@email.com" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>

            {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}
            {sucesso && <div className="flex items-start gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {sucesso}</div>}

            <button type="submit" disabled={convidando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {convidando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Convidar
            </button>
          </form>

          <div className="pt-3 border-t border-black/5 space-y-2">
            <button onClick={handleRecalcular} disabled={recalculando} className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500 hover:text-ink-900 disabled:opacity-60 focus-ring">
              {recalculando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />} Alguém logado não está enxergando a clínica? Recalcular acessos
            </button>
            {msgRecalculo && <p className="text-[11px] text-ink-500">{msgRecalculo}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function mapErro(err) {
  const code = err?.code || "";
  if (code.includes("already-exists")) return "Essa pessoa já faz parte desta clínica.";
  if (code.includes("permission-denied")) return "Só administradores podem convidar novos membros.";
  return err?.message || "Não foi possível enviar o convite. Tente novamente.";
}
