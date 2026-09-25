import { useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreQuery, where, orderBy } from "../../lib/firestore";

const PERIODOS = [
  { label: "Últimos 7 dias", dias: 7 },
  { label: "Últimos 30 dias", dias: 30 },
  { label: "Últimos 90 dias", dias: 90 },
  { label: "Tudo", dias: null },
];

/** Lista de alterações clínicas (quem, quando, o quê) com filtro por
 * período — usada dentro das abas de Sinais Vitais, Medidas e Doenças
 * Pré-existentes / Vícios pra dar visibilidade rápida das mudanças ao
 * longo do tempo, sem precisar abrir cada registro um a um. */
export default function HistoricoClinicoLista({ tipo, className = "" }) {
  const { clinicaId, pacienteId } = useTenant();
  const { data: registros, loading } = useFirestoreQuery(
    clinicaId && pacienteId ? `clinicas/${clinicaId}/pacientes/${pacienteId}/historicoClinico` : null,
    [where("tipo", "==", tipo), orderBy("criadoEm", "desc")],
    [clinicaId, pacienteId, tipo]
  );
  const [periodo, setPeriodo] = useState(PERIODOS[1]);
  // Data de corte calculada só quando o período muda (não a cada render) —
  // evita chamar Date.now() dentro do useMemo de filtragem.
  const [limite, setLimite] = useState(() => Date.now() - PERIODOS[1].dias * 24 * 60 * 60 * 1000);

  function selecionarPeriodo(p) {
    setPeriodo(p);
    setLimite(p.dias ? Date.now() - p.dias * 24 * 60 * 60 * 1000 : null);
  }

  const filtrados = useMemo(() => {
    if (!limite) return registros;
    return registros.filter((r) => r.criadoEm?.toDate && r.criadoEm.toDate().getTime() >= limite);
  }, [registros, limite]);

  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <History size={15} className="text-brand-500" />
        <span className="text-sm font-display font-semibold text-ink-900">Histórico de alterações</span>
        <select
          value={periodo.label}
          onChange={(e) => selecionarPeriodo(PERIODOS.find((p) => p.label === e.target.value) || PERIODOS[1])}
          className="ml-auto text-xs border border-black/10 rounded-lg px-2 py-1 focus-ring"
        >
          {PERIODOS.map((p) => <option key={p.label}>{p.label}</option>)}
        </select>
      </div>
      {loading && (
        <div className="text-xs text-ink-500 flex items-center gap-2 py-4 justify-center"><Loader2 size={13} className="animate-spin" /> Carregando…</div>
      )}
      {!loading && filtrados.length === 0 && (
        <p className="text-xs text-ink-500 py-4 text-center">Nenhuma alteração registrada nesse período.</p>
      )}
      {!loading && filtrados.length > 0 && (
        <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {filtrados.map((r) => (
            <li key={r.id} className="text-xs border-l-2 border-brand-200 pl-2.5 py-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-ink-900">{formatarData(r.criadoEm)}</span>
                <span className="text-ink-500">· {r.nomeUsuario}</span>
              </div>
              <div className="text-ink-700 mt-0.5">{r.resumo}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatarData(ts) {
  if (!ts?.toDate) return "agora";
  const d = ts.toDate();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
