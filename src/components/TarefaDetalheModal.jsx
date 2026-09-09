import { useState } from "react";
import { X, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { atualizarDocumento, excluirDocumento } from "../lib/firestore";

const PRIORIDADES = [
  { valor: "baixa", label: "Baixa" },
  { valor: "media", label: "Média" },
  { valor: "alta", label: "Alta" },
];

export default function TarefaDetalheModal({ clinicaId, tarefa, colunas, membros, onClose }) {
  const [form, setForm] = useState({
    titulo: tarefa.titulo || "",
    descricao: tarefa.descricao || "",
    atribuidoA: tarefa.atribuidoA || "",
    prioridade: tarefa.prioridade || "media",
    prazo: tarefa.prazo || "",
    colunaId: tarefa.colunaId || colunas[0]?.id || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!form.titulo.trim()) { setErro("Dê um título pra tarefa."); return; }
    setErro("");
    setSalvando(true);
    try {
      const responsavel = membros.find((m) => m.id === form.atribuidoA);
      await atualizarDocumento(`clinicas/${clinicaId}/tarefas`, tarefa.id, {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        atribuidoA: form.atribuidoA || null,
        atribuidoNome: responsavel?.nome || "Você",
        prioridade: form.prioridade,
        prazo: form.prazo || null,
        colunaId: form.colunaId,
      });
      onClose();
    } catch (err) {
      console.error("Erro ao salvar tarefa:", err);
      setErro(err.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    await excluirDocumento(`clinicas/${clinicaId}/tarefas`, tarefa.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold">Detalhe da tarefa</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3.5">
          <label className="block text-xs">
            <span className="text-ink-500 font-medium">Título</span>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
          </label>

          <label className="block text-xs">
            <span className="text-ink-500 font-medium">Descrição</span>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring resize-none" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Atribuir a</span>
              <select value={form.atribuidoA} onChange={(e) => setForm({ ...form, atribuidoA: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                <option value="">Você</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Prioridade</span>
              <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                {PRIORIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Prazo</span>
              <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Coluna</span>
              <select value={form.colunaId} onChange={(e) => setForm({ ...form, colunaId: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          </div>

          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}
        </div>

        <div className="px-5 py-4 border-t border-black/5 flex items-center justify-between shrink-0">
          <button onClick={remover} className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg focus-ring">
            <Trash2 size={13} /> Excluir
          </button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
