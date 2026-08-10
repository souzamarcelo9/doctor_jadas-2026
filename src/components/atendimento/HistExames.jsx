import { useState } from "react";
import { Search, ArrowUpDown, MoreVertical, Upload, FileText, LineChart, Plus, Loader2 } from "lucide-react";
import { examFavorites } from "../../data/mockData";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento, alternarAtivo, atualizarDocumento } from "../../lib/firestore";

export default function HistExames() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/examesSolicitados`);
  const [novoExame, setNovoExame] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function solicitar(nomeExame) {
    const nome = nomeExame || novoExame;
    if (!nome.trim() || !firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/examesSolicitados`, {
        exame: nome, qtd: 1, valor: 0, resultado: "", ativo: true, atendimentoId, profissionalId,
      });
      setNovoExame("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" className="rounded accent-brand-600" /> Exibir inativos
        </label>
        <div className="flex-1" />
        <select className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"><option>Favoritos...</option></select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input placeholder="Pesquisar" className="text-xs border border-black/10 rounded-lg pl-7 pr-2.5 py-1.5 focus-ring" />
        </div>
        <button className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><ArrowUpDown size={14} /></button>
        <button className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><MoreVertical size={14} /></button>
      </div>

      <div className="flex flex-wrap gap-2">
        {examFavorites.map((c) => (
          <button key={c} onClick={() => solicitar(c)} disabled={salvando} className="text-xs border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full px-3.5 py-1.5 focus-ring max-w-[220px] truncate" title={c}>
            {c}
          </button>
        ))}
      </div>

      <div className="card p-3 flex gap-2">
        <input
          value={novoExame}
          onChange={(e) => setNovoExame(e.target.value)}
          placeholder="Nome do exame a solicitar…"
          className="flex-1 text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
        />
        <button onClick={() => solicitar()} disabled={salvando || !firebaseConfigured} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg focus-ring">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Solicitar
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-brand-700 text-white text-left">
              <Th>Data</Th><Th className="min-w-[260px]">Exame</Th><Th>Qtd.</Th><Th>Valor</Th><Th>Realizado</Th><Th>Resultado</Th><Th>Laudo</Th><Th>Info</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-ink-500">Nenhum exame solicitado.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t border-black/5 ${i % 2 ? "bg-brand-50/30" : ""}`}>
                <Td className="whitespace-nowrap">{formatarData(r.criadoEm)}</Td>
                <Td>{r.exame}</Td>
                <Td><input defaultValue={r.qtd} className="w-10 text-xs border border-black/10 rounded px-1.5 py-1 text-center focus-ring" /></Td>
                <Td><input defaultValue={r.valor} className="w-12 text-xs border border-black/10 rounded px-1.5 py-1 text-center focus-ring" /></Td>
                <Td>
                  <input
                    type="date"
                    defaultValue={r.realizado || ""}
                    onBlur={(e) => e.target.value && atualizarDocumento(`${pacientePath}/examesSolicitados`, r.id, { realizado: e.target.value })}
                    className="w-32 text-xs border border-black/10 rounded px-1.5 py-1 focus-ring"
                  />
                </Td>
                <Td>
                  <input
                    defaultValue={r.resultado}
                    onBlur={(e) => e.target.value !== r.resultado && atualizarDocumento(`${pacientePath}/examesSolicitados`, r.id, { resultado: e.target.value })}
                    className="w-20 text-xs border border-black/10 rounded px-1.5 py-1 focus-ring"
                  />
                </Td>
                <Td><button title="Anexar laudo" className="p-1.5 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 focus-ring"><Upload size={13} /></button></Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <button title="Detalhes" className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 focus-ring"><FileText size={13} /></button>
                    <button title="Ver evolução" className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 focus-ring"><LineChart size={13} /></button>
                  </div>
                </Td>
                <Td>
                  <button onClick={() => alternarAtivo(`${pacientePath}/examesSolicitados`, r.id, false)} className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold px-3 py-1 rounded-md focus-ring whitespace-nowrap">
                    Inativar
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function Th({ children, className = "" }) { return <th className={`px-3 py-2.5 font-semibold text-[11px] tracking-wide ${className}`}>{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 align-middle ${className}`}>{children}</td>; }
