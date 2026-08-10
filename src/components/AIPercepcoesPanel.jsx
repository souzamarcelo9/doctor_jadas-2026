import { useState } from "react";
import { X, Sparkles, Plus, Check, ClipboardList, Pill, FlaskConical, AlertCircle, Loader2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc, criarDocumento } from "../lib/firestore";

const iconByType = { problema: ClipboardList, conduta: Pill, exame: FlaskConical, alerta: AlertCircle };
const colecaoPorTipo = { problema: "problemas", conduta: "condutas", exame: "examesSolicitados" };

export default function AIPercepcoesPanel({ open, onClose }) {
  const { clinicaId, pacientePath, atendimentoId, profissionalId } = useTenant();
  const { data: atendimento, loading } = useFirestoreDoc(open && clinicaId ? `clinicas/${clinicaId}/atendimentos` : null, atendimentoId);
  const [aplicando, setAplicando] = useState(null);
  const [aplicadas, setAplicadas] = useState(new Set());
  const [erro, setErro] = useState("");

  if (!open) return null;

  const sugestoes = atendimento?.sugestoesIA || [];

  async function aplicar(sugestao, i) {
    setErro("");
    const colecao = colecaoPorTipo[sugestao.tipo];
    if (!colecao) {
      // "alerta" não vira documento — é só um aviso pro profissional considerar.
      setAplicadas((s) => new Set(s).add(i));
      return;
    }
    setAplicando(i);
    try {
      const payload = { ativo: true, atendimentoId, profissionalId, origemIA: true };
      if (sugestao.tipo === "problema") Object.assign(payload, { descricao: sugestao.label, cid: "", grau: "SEM CLASSIFICAÇÃO", observacao: "Sugerido pela IA" });
      if (sugestao.tipo === "conduta") Object.assign(payload, { texto: sugestao.label });
      if (sugestao.tipo === "exame") Object.assign(payload, { exame: sugestao.label, qtd: 1, valor: 0, resultado: "" });

      await criarDocumento(`${pacientePath}/${colecao}`, payload);
      setAplicadas((s) => new Set(s).add(i));
    } catch (err) {
      console.error("Erro ao aplicar sugestão:", err);
      setErro(err.code === "permission-denied" ? "Seu papel não tem permissão para aplicar esse tipo de sugestão." : "Não foi possível aplicar a sugestão.");
    } finally {
      setAplicando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/30" onClick={onClose} />
      <aside className="relative w-full max-w-sm bg-white h-full shadow-pop flex flex-col animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 bg-gradient-to-r from-brand-600 to-brand-500 text-white">
          <div className="flex items-center gap-2 font-display font-semibold">
            <Sparkles size={18} /> Percepções da IA
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring">
            <X size={18} />
          </button>
        </div>
        <p className="px-5 pt-4 text-xs text-ink-500">
          Sugestões geradas a partir da transcrição desta consulta. Revise antes de aplicar — a decisão final é sempre do profissional.
        </p>

        {erro && <div className="mx-5 mt-3 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2.5">{erro}</div>}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-xs text-ink-500 py-8"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
          )}
          {!loading && sugestoes.length === 0 && (
            <div className="text-xs text-ink-500 text-center py-8 px-4">
              Nenhuma sugestão ainda. Grave a consulta na aba <span className="font-semibold">Queixa Paciente</span> (transcrição por IA) para gerar percepções aqui.
            </div>
          )}
          {sugestoes.map((s, i) => {
            const Icon = iconByType[s.tipo] || Sparkles;
            const jaAplicada = aplicadas.has(i);
            return (
              <div key={i} className="card p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900 leading-snug">{s.label}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: `${(s.confianca || 0) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-ink-500">{Math.round((s.confianca || 0) * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => aplicar(s, i)}
                  disabled={jaAplicada || aplicando === i}
                  title={jaAplicada ? "Aplicada" : "Aplicar sugestão"}
                  className={`shrink-0 p-1.5 rounded-lg focus-ring text-white ${jaAplicada ? "bg-emerald-500" : "bg-brand-600 hover:bg-brand-700"} disabled:opacity-70`}
                >
                  {aplicando === i ? <Loader2 size={14} className="animate-spin" /> : jaAplicada ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-black/5 text-[11px] text-ink-500">
          Gerado por IA (Groq · Llama 3.3) a partir da transcrição desta consulta.
        </div>
      </aside>
    </div>
  );
}
