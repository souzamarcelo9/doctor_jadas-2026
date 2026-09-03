import { useState } from "react";
import { X, Handshake, Stethoscope, Plus, Trash2, Loader2, Power, AlertTriangle } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento, excluirDocumento } from "../lib/firestore";

export default function ConveniosServicosModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const [aba, setAba] = useState("convenios");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><Handshake size={18} /> Convênios e Serviços</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="flex border-b border-black/5 shrink-0">
          <TabBtn active={aba === "convenios"} onClick={() => setAba("convenios")} icon={Handshake}>Convênios</TabBtn>
          <TabBtn active={aba === "servicos"} onClick={() => setAba("servicos")} icon={Stethoscope}>Serviços</TabBtn>
        </div>

        <div className="overflow-y-auto p-5">
          {aba === "convenios" ? <ListaConvenios clinicaId={clinicaId} /> : <ListaServicos clinicaId={clinicaId} />}
        </div>
      </div>
    </div>
  );
}

function ListaConvenios({ clinicaId }) {
  const { data: convenios, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/convenios` : null, "nome", "asc");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function adicionar(e) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await criarDocumento(`clinicas/${clinicaId}/convenios`, { nome: nome.trim(), ativo: true });
      setNome("");
    } catch (err) {
      console.error("Erro ao criar convênio:", err);
      setErro(err.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(c) {
    await atualizarDocumento(`clinicas/${clinicaId}/convenios`, c.id, { ativo: !c.ativo });
  }
  async function remover(id) {
    await excluirDocumento(`clinicas/${clinicaId}/convenios`, id);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">Cadastre aqui os convênios aceitos pela clínica — eles aparecem no agendamento e nos relatórios financeiros. "Particular" já é o padrão quando nenhum convênio é selecionado, não precisa cadastrar.</p>

      <form onSubmit={adicionar} className="flex gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do convênio" className="flex-1 text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
        <button type="submit" disabled={salvando} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring shrink-0">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
        </button>
      </form>
      {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

      <div className="space-y-1.5">
        {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
        {!loading && convenios.length === 0 && <p className="text-xs text-ink-500 text-center py-4">Nenhum convênio cadastrado ainda.</p>}
        {convenios.map((c) => (
          <div key={c.id} className={`flex items-center gap-2 border border-black/5 rounded-lg p-2.5 ${c.ativo === false ? "opacity-50" : ""}`}>
            <span className="flex-1 text-sm text-ink-900">{c.nome}</span>
            <button onClick={() => alternarAtivo(c)} title={c.ativo === false ? "Reativar" : "Desativar"} className={`p-1.5 rounded-lg focus-ring ${c.ativo === false ? "text-ink-500 hover:bg-gray-100" : "text-emerald-600 hover:bg-emerald-50"}`}>
              <Power size={13} />
            </button>
            <button onClick={() => remover(c.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListaServicos({ clinicaId }) {
  const { data: servicos, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/servicos` : null, "nome", "asc");
  const [form, setForm] = useState({ nome: "", valor: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function adicionar(e) {
    e.preventDefault();
    setErro("");
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await criarDocumento(`clinicas/${clinicaId}/servicos`, { nome: form.nome.trim(), valor: Number(form.valor) || 0, ativo: true });
      setForm({ nome: "", valor: "" });
    } catch (err) {
      console.error("Erro ao criar serviço:", err);
      setErro(err.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(s) {
    await atualizarDocumento(`clinicas/${clinicaId}/servicos`, s.id, { ativo: !s.ativo });
  }
  async function remover(id) {
    await excluirDocumento(`clinicas/${clinicaId}/servicos`, id);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">Cadastre aqui os tipos de consulta/procedimento e seus valores — ao selecionar um serviço no agendamento, o valor é preenchido sozinho e vai automaticamente pro financeiro.</p>

      <form onSubmit={adicionar} className="flex gap-2">
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do serviço" className="flex-1 text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
        <input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Valor (R$)" className="w-28 text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
        <button type="submit" disabled={salvando} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring shrink-0">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
        </button>
      </form>
      {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

      <div className="space-y-1.5">
        {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
        {!loading && servicos.length === 0 && <p className="text-xs text-ink-500 text-center py-4">Nenhum serviço cadastrado ainda.</p>}
        {servicos.map((s) => (
          <div key={s.id} className={`flex items-center gap-2 border border-black/5 rounded-lg p-2.5 ${s.ativo === false ? "opacity-50" : ""}`}>
            <span className="flex-1 text-sm text-ink-900">{s.nome}</span>
            <span className="text-xs font-semibold text-ink-500">R$ {Number(s.valor || 0).toFixed(2)}</span>
            <button onClick={() => alternarAtivo(s)} title={s.ativo === false ? "Reativar" : "Desativar"} className={`p-1.5 rounded-lg focus-ring ${s.ativo === false ? "text-ink-500 hover:bg-gray-100" : "text-emerald-600 hover:bg-emerald-50"}`}>
              <Power size={13} />
            </button>
            <button onClick={() => remover(s.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium focus-ring relative ${active ? "text-brand-700" : "text-ink-500 hover:text-ink-900"}`}>
      <Icon size={14} /> {children}
      {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
    </button>
  );
}
