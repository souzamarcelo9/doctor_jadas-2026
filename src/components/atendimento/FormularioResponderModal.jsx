import { useMemo, useState } from "react";
import { X, ClipboardCheck, Loader2, AlertTriangle } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { criarDocumento } from "../../lib/firestore";

export default function FormularioResponderModal({ template, onClose }) {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const [valores, setValores] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const campos = useMemo(() => template.campos || [], [template.campos]);

  const scoreTotal = useMemo(() => {
    let total = 0;
    for (const campo of campos) {
      const v = valores[campo.id];
      if (campo.tipo === "numero") total += Number(v) || 0;
      if (campo.tipo === "opcoes") {
        const opcao = (campo.opcoes || []).find((o) => o.label === v);
        total += opcao?.valor || 0;
      }
    }
    return total;
  }, [valores, campos]);

  async function salvar() {
    setErro("");
    const faltando = campos.filter((c) => c.tipo !== "texto" && (valores[c.id] === undefined || valores[c.id] === ""));
    if (faltando.length > 0) { setErro("Responda todos os campos pontuáveis antes de salvar."); return; }
    setSalvando(true);
    try {
      const respostas = campos.map((c) => {
        const v = valores[c.id] ?? "";
        const pontos = c.tipo === "numero" ? (Number(v) || 0) : c.tipo === "opcoes" ? ((c.opcoes || []).find((o) => o.label === v)?.valor || 0) : 0;
        return { campoId: c.id, label: c.label, tipo: c.tipo, valor: v, pontos };
      });
      await criarDocumento(`${pacientePath}/formulariosRespondidos`, {
        formularioId: template.id,
        formularioNome: template.nome,
        respostas,
        scoreTotal: template.pontuavel === false ? null : scoreTotal,
        atendimentoId,
        profissionalId,
        ativo: true,
      });
      onClose();
    } catch (err) {
      console.error("Erro ao salvar resposta do formulário:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold">{template.nome}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {campos.map((campo) => (
            <div key={campo.id} className="space-y-1.5">
              <span className="text-xs font-medium text-ink-700">{campo.label}</span>
              {campo.tipo === "numero" && (
                <input
                  type="number"
                  value={valores[campo.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                  className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
                />
              )}
              {campo.tipo === "texto" && (
                <textarea
                  value={valores[campo.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none"
                />
              )}
              {campo.tipo === "opcoes" && (
                <div className="flex flex-wrap gap-2">
                  {(campo.opcoes || []).map((o) => (
                    <button
                      key={o.label}
                      onClick={() => setValores((v) => ({ ...v, [campo.id]: o.label }))}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border focus-ring ${valores[campo.id] === o.label ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-700 border-black/10 hover:bg-gray-50"}`}
                    >
                      {o.label} <span className="opacity-70">({o.valor} pt)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {template.pontuavel !== false && (
            <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
              <span className="text-xs font-semibold text-brand-700">Score total</span>
              <span className="text-lg font-display font-bold text-brand-700">{scoreTotal}</span>
            </div>
          )}

          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}
        </div>

        <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !firebaseConfigured} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />} Salvar resposta
          </button>
        </div>
      </div>
    </div>
  );
}
