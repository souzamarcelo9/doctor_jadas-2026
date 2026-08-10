import { useState } from "react";
import { Loader2 } from "lucide-react";
import { condutaFavorites } from "../../data/mockData";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento } from "../../lib/firestore";

export default function Conduta() {
  const { clinicaId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: entries, loading } = useFirestoreCollection(`${pacientePath}/condutas`);
  const [text, setText] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!text.trim() || !firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/condutas`, { texto: text, ativo: true, atendimentoId, profissionalId });
      if (atendimentoId) {
        await atualizarDocumento(`clinicas/${clinicaId}/atendimentos`, atendimentoId, { condutaResumo: text });
      }
      setText("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex flex-wrap gap-2">
          {condutaFavorites.map((c) => (
            <button key={c} onClick={() => setText((t) => (t ? `${t} ${c}.` : `${c}.`))} className="text-xs border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full px-3.5 py-1.5 focus-ring">
              {c}
            </button>
          ))}
        </div>
        <div className="card p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Descreva a conduta clínica adotada para este atendimento…"
            className="w-full text-sm resize-none outline-none placeholder:text-ink-500/60"
          />
          <div className="flex justify-end pt-2 border-t border-black/5 mt-2">
            <button onClick={salvar} disabled={salvando || !firebaseConfigured} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg focus-ring">
              {salvando && <Loader2 size={12} className="animate-spin" />} Salvar conduta
            </button>
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="text-xs font-semibold text-ink-500 px-1 pb-2 mb-1 border-b border-black/5">Histórico de condutas</div>
        <div className="max-h-96 overflow-y-auto divide-y divide-black/5">
          {loading && <div className="text-xs text-ink-500 py-4 text-center"><Loader2 size={14} className="animate-spin inline" /> Carregando…</div>}
          {!loading && entries.length === 0 && <p className="text-xs text-ink-500 py-4 text-center">Nenhuma conduta registrada ainda.</p>}
          {entries.map((e) => (
            <div key={e.id} className="py-2.5 px-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> {formatarData(e.criadoEm)}
              </div>
              <p className="text-xs text-ink-700 mt-1 leading-relaxed">{e.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatarData(ts) {
  if (!ts?.toDate) return "agora";
  const d = ts.toDate();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
