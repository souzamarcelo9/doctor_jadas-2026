import { useState } from "react";
import Topbar from "../components/Topbar";
import { ListTodo, Plus, Loader2, Trash2, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento, excluirDocumento } from "../lib/firestore";

const prioridadeInfo = {
  alta: { label: "Alta", tone: "bg-rose-50 text-rose-700" },
  media: { label: "Média", tone: "bg-amber-50 text-amber-700" },
  baixa: { label: "Baixa", tone: "bg-emerald-50 text-emerald-700" },
};

function formularioVazio() {
  return { titulo: "", descricao: "", atribuidoA: "", prioridade: "media", prazo: "" };
}

export default function Tarefas() {
  const { clinicaId, profissionalId } = useTenant();
  const { data: tarefas, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/tarefas` : null, "criadoEm", "desc");
  const { data: membros } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/membros` : null, "nome", "asc");

  const [filtro, setFiltro] = useState("minhas"); // "minhas" | "todas" | "concluidas"
  const [form, setForm] = useState(formularioVazio());
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const visiveis = tarefas.filter((t) => {
    if (filtro === "concluidas") return t.status === "concluida";
    if (t.status === "concluida") return false;
    if (filtro === "minhas") return t.atribuidoA === profissionalId;
    return true;
  });

  async function criar(e) {
    e.preventDefault();
    setErro("");
    if (!form.titulo.trim()) { setErro("Dê um título pra tarefa."); return; }
    setCriando(true);
    try {
      const responsavel = membros.find((m) => m.id === form.atribuidoA);
      await criarDocumento(`clinicas/${clinicaId}/tarefas`, {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        atribuidoA: form.atribuidoA || profissionalId,
        atribuidoNome: responsavel?.nome || "Você",
        prioridade: form.prioridade,
        prazo: form.prazo || null,
        status: "pendente",
        criadoPor: profissionalId,
      });
      setForm(formularioVazio());
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      setErro(err.message || "Não foi possível criar a tarefa.");
    } finally {
      setCriando(false);
    }
  }

  async function alternarConcluida(tarefa) {
    await atualizarDocumento(`clinicas/${clinicaId}/tarefas`, tarefa.id, {
      status: tarefa.status === "concluida" ? "pendente" : "concluida",
    });
  }

  async function remover(id) {
    await excluirDocumento(`clinicas/${clinicaId}/tarefas`, id);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Lista de Tarefas" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <form onSubmit={criar} className="card p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-700"><Plus size={14} /> Nova tarefa</div>
          <input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="O que precisa ser feito?"
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring"
          />
          <div className="grid sm:grid-cols-3 gap-3">
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
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Prazo</span>
              <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
          </div>
          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}
          <button type="submit" disabled={criando} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg focus-ring">
            {criando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
          </button>
        </form>

        <div className="flex items-center gap-2">
          {[{ v: "minhas", label: "Minhas tarefas" }, { v: "todas", label: "Todas" }, { v: "concluidas", label: "Concluídas" }].map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg focus-ring ${filtro === f.v ? "bg-brand-600 text-white" : "bg-white border border-black/10 text-ink-700 hover:bg-gray-50"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

        {!loading && visiveis.length === 0 && (
          <div className="card p-8 text-center">
            <ListTodo size={26} className="mx-auto text-ink-400 mb-2" />
            <p className="text-sm text-ink-500">Nenhuma tarefa por aqui.</p>
          </div>
        )}

        <div className="space-y-2">
          {visiveis.map((t) => {
            const p = prioridadeInfo[t.prioridade] || prioridadeInfo.media;
            const concluida = t.status === "concluida";
            return (
              <div key={t.id} className={`card p-3.5 flex items-start gap-3 ${concluida ? "opacity-60" : ""}`}>
                <button onClick={() => alternarConcluida(t)} className="mt-0.5 text-brand-600 hover:text-brand-700 focus-ring shrink-0">
                  {concluida ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold text-ink-900 ${concluida ? "line-through" : ""}`}>{t.titulo}</div>
                  {t.descricao && <p className="text-xs text-ink-500 mt-0.5">{t.descricao}</p>}
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.tone}`}>{p.label}</span>
                    <span className="text-[11px] text-ink-500">{t.atribuidoNome}</span>
                    {t.prazo && <span className="text-[11px] text-ink-500">· prazo {t.prazo.split("-").reverse().join("/")}</span>}
                  </div>
                </div>
                <button onClick={() => remover(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
