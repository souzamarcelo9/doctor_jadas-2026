import { useState } from "react";
import { X, FileEdit, Plus, Trash2, Loader2, Power, AlertTriangle, GripVertical } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento, excluirDocumento } from "../lib/firestore";

const TIPOS_CAMPO = [
  { valor: "numero", label: "Número (soma direto no score)" },
  { valor: "opcoes", label: "Opções (cada uma com uma pontuação)" },
  { valor: "texto", label: "Texto livre (não pontua)" },
];

function campoVazio() {
  return { id: crypto.randomUUID(), label: "", tipo: "opcoes", opcoes: [{ label: "", valor: 0 }] };
}

export default function FormulariosTemplateModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const [aba, setAba] = useState("lista");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><FileEdit size={18} /> Formulários de Avaliação</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="flex border-b border-black/5 shrink-0">
          <TabBtn active={aba === "lista"} onClick={() => setAba("lista")}>Templates cadastrados</TabBtn>
          <TabBtn active={aba === "novo"} onClick={() => setAba("novo")}>Novo template</TabBtn>
        </div>

        <div className="overflow-y-auto p-5">
          {aba === "lista" ? <ListaTemplates clinicaId={clinicaId} /> : <NovoTemplate clinicaId={clinicaId} onCriado={() => setAba("lista")} />}
        </div>
      </div>
    </div>
  );
}

function ListaTemplates({ clinicaId }) {
  const { data: templates, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/formularios` : null, "nome", "asc");

  async function alternarAtivo(t) {
    await atualizarDocumento(`clinicas/${clinicaId}/formularios`, t.id, { ativo: !t.ativo });
  }
  async function remover(id) {
    await excluirDocumento(`clinicas/${clinicaId}/formularios`, id);
  }

  return (
    <div className="space-y-1.5">
      {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
      {!loading && templates.length === 0 && <p className="text-xs text-ink-500 text-center py-6">Nenhum template cadastrado ainda — crie um na aba "Novo template".</p>}
      {templates.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 border border-black/5 rounded-lg p-3 ${t.ativo === false ? "opacity-50" : ""}`}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-900">{t.nome}</div>
            <div className="text-[11px] text-ink-500 mt-0.5">{(t.campos || []).length} campo(s) configurado(s){t.pontuavel === false ? " · sem score" : ""}</div>
          </div>
          <button onClick={() => alternarAtivo(t)} title={t.ativo === false ? "Reativar" : "Desativar"} className={`p-1.5 rounded-lg focus-ring shrink-0 ${t.ativo === false ? "text-ink-500 hover:bg-gray-100" : "text-emerald-600 hover:bg-emerald-50"}`}>
            <Power size={14} />
          </button>
          <button onClick={() => remover(t.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring shrink-0"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function NovoTemplate({ clinicaId, onCriado }) {
  const [nome, setNome] = useState("");
  const [campos, setCampos] = useState([campoVazio()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function atualizarCampo(id, patch) {
    setCampos((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removerCampo(id) {
    setCampos((cs) => cs.filter((c) => c.id !== id));
  }
  function adicionarCampo() {
    setCampos((cs) => [...cs, campoVazio()]);
  }
  function atualizarOpcao(campoId, idx, patch) {
    setCampos((cs) => cs.map((c) => {
      if (c.id !== campoId) return c;
      const opcoes = c.opcoes.map((o, i) => (i === idx ? { ...o, ...patch } : o));
      return { ...c, opcoes };
    }));
  }
  function adicionarOpcao(campoId) {
    setCampos((cs) => cs.map((c) => (c.id === campoId ? { ...c, opcoes: [...c.opcoes, { label: "", valor: 0 }] } : c)));
  }
  function removerOpcao(campoId, idx) {
    setCampos((cs) => cs.map((c) => (c.id === campoId ? { ...c, opcoes: c.opcoes.filter((_, i) => i !== idx) } : c)));
  }

  async function salvar() {
    setErro("");
    if (!nome.trim()) { setErro("Dê um nome ao formulário."); return; }
    if (campos.length === 0 || campos.some((c) => !c.label.trim())) { setErro("Todo campo precisa de um rótulo."); return; }
    setSalvando(true);
    try {
      const camposLimpos = campos.map(({ id, label, tipo, opcoes }) => ({
        id, label: label.trim(), tipo,
        opcoes: tipo === "opcoes" ? opcoes.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), valor: Number(o.valor) || 0 })) : null,
      }));
      const pontuavel = camposLimpos.some((c) => c.tipo !== "texto");
      await criarDocumento(`clinicas/${clinicaId}/formularios`, { nome: nome.trim(), campos: camposLimpos, pontuavel, ativo: true });
      setNome("");
      setCampos([campoVazio()]);
      onCriado();
    } catch (err) {
      console.error("Erro ao criar template de formulário:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-xs">
        <span className="text-ink-500 font-medium">Nome do formulário</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: IVCF-20 — Triagem" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
      </label>

      <div className="space-y-3">
        {campos.map((campo, i) => (
          <div key={campo.id} className="border border-black/10 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-ink-400 shrink-0" />
              <input
                value={campo.label}
                onChange={(e) => atualizarCampo(campo.id, { label: e.target.value })}
                placeholder={`Pergunta / campo ${i + 1}`}
                className="flex-1 text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
              />
              <select value={campo.tipo} onChange={(e) => atualizarCampo(campo.id, { tipo: e.target.value, opcoes: e.target.value === "opcoes" ? [{ label: "", valor: 0 }] : campo.opcoes })} className="text-xs border border-black/10 rounded-lg px-2 py-1.5 focus-ring shrink-0">
                {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
              </select>
              {campos.length > 1 && (
                <button onClick={() => removerCampo(campo.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring shrink-0"><Trash2 size={13} /></button>
              )}
            </div>

            {campo.tipo === "opcoes" && (
              <div className="pl-5 space-y-1.5">
                {campo.opcoes.map((o, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input value={o.label} onChange={(e) => atualizarOpcao(campo.id, idx, { label: e.target.value })} placeholder={`Opção ${idx + 1}`} className="flex-1 text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
                    <input type="number" value={o.valor} onChange={(e) => atualizarOpcao(campo.id, idx, { valor: e.target.value })} placeholder="Pontos" className="w-20 text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
                    {campo.opcoes.length > 1 && (
                      <button onClick={() => removerOpcao(campo.id, idx)} className="p-1 rounded text-rose-500 hover:bg-rose-50 focus-ring shrink-0"><Trash2 size={12} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => adicionarOpcao(campo.id)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                  <Plus size={11} /> Adicionar opção
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={adicionarCampo} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
        <Plus size={13} /> Adicionar campo
      </button>

      {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

      <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
        {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Salvar template
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-3 text-sm font-medium focus-ring relative ${active ? "text-brand-700" : "text-ink-500 hover:text-ink-900"}`}>
      {children}
      {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
    </button>
  );
}
