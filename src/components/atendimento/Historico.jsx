import { useState } from "react";
import { Search, Stethoscope, Loader2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreQuery, where, orderBy } from "../../lib/firestore";

export default function Historico() {
  const { clinicaId, pacienteId } = useTenant();
  const { data: atendimentos, loading } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/atendimentos` : null,
    [where("pacienteId", "==", pacienteId), orderBy("dataHora", "desc")],
    [pacienteId]
  );
  const [query, setQuery] = useState("");

  const filtered = atendimentos.filter((h) => {
    const alvo = `${h.queixaResumo || ""} ${h.condutaResumo || ""}`.toLowerCase();
    return alvo.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no histórico do paciente…"
            className="w-full text-xs border border-black/10 rounded-lg pl-7 pr-2.5 py-1.5 focus-ring" />
        </div>
        <span className="text-xs text-ink-500 ml-auto">{filtered.length} atendimento(s)</span>
      </div>

      {loading && <div className="text-xs text-ink-500 flex items-center gap-2 py-6 justify-center"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
      {!loading && filtered.length === 0 && <p className="text-xs text-ink-500 py-6 text-center">Nenhum atendimento no histórico ainda.</p>}

      {!loading && filtered.length > 0 && (
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-brand-100" />
          <div className="space-y-5">
            {filtered.map((h) => (
              <div key={h.id} className="relative">
                <div className="absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full bg-white border-2 border-brand-400 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                </div>
                <div className="card p-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600">
                      <Stethoscope size={11} /> {h.status === "em_andamento" ? "Em andamento" : "Consulta"}
                    </span>
                    <span className="text-xs font-semibold text-ink-900">{formatarData(h.dataHora)}</span>
                  </div>
                  {h.queixaResumo && (
                    <p className="text-xs text-ink-700 mt-2"><span className="font-semibold text-ink-900">Queixa: </span>{h.queixaResumo}</p>
                  )}
                  {h.condutaResumo && (
                    <p className="text-xs text-ink-700 mt-1"><span className="font-semibold text-ink-900">Conduta: </span>{h.condutaResumo}</p>
                  )}
                  {!h.queixaResumo && !h.condutaResumo && (
                    <p className="text-xs text-ink-500 mt-2">Atendimento ainda sem queixa ou conduta registradas.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatarData(ts) {
  if (!ts?.toDate) return "agora";
  const d = ts.toDate();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
