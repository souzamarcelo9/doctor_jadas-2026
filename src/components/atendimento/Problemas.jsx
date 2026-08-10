import { useState } from "react";
import { Search, ArrowUpDown, MoreVertical, Plus, Loader2 } from "lucide-react";
import { problemChips } from "../../data/mockData";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento, alternarAtivo, atualizarDocumento } from "../../lib/firestore";

const grauStyle = {
  LEVE: "badge-leve",
  MODERADA: "badge-moderada",
  SEVERA: "badge-severa",
  "SEM CLASSIFICAÇÃO": "bg-gray-100 text-gray-500 border border-gray-200",
};

export default function Problemas() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/problemas`);
  const [novo, setNovo] = useState({ cid: "", descricao: "", grau: "SEM CLASSIFICAÇÃO" });
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!novo.descricao.trim() || !firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/problemas`, {
        ...novo,
        observacao: "",
        ativo: true,
        atendimentoId,
        profissionalId,
      });
      setNovo({ cid: "", descricao: "", grau: "SEM CLASSIFICAÇÃO" });
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
        <select className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
          <option>Favoritos...</option>
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input placeholder="Pesquisar" className="text-xs border border-black/10 rounded-lg pl-7 pr-2.5 py-1.5 focus-ring" />
        </div>
        <button className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><ArrowUpDown size={14} /></button>
        <button className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><MoreVertical size={14} /></button>
      </div>

      <div className="flex flex-wrap gap-2">
        {problemChips.map((c) => (
          <button
            key={c}
            onClick={() => setNovo((n) => ({ ...n, descricao: c }))}
            className="text-xs border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full px-3.5 py-1.5 focus-ring"
          >
            {c}
          </button>
        ))}
      </div>

      <div className="card p-3 grid sm:grid-cols-4 gap-2">
        <input placeholder="CID" value={novo.cid} onChange={(e) => setNovo({ ...novo, cid: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
        <input placeholder="Descrição do problema" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring sm:col-span-2" />
        <select value={novo.grau} onChange={(e) => setNovo({ ...novo, grau: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
          <option>SEM CLASSIFICAÇÃO</option><option>LEVE</option><option>MODERADA</option><option>SEVERA</option>
        </select>
        <button onClick={adicionar} disabled={salvando || !firebaseConfigured} className="sm:col-span-4 flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold py-2 rounded-lg focus-ring">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar problema
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-700 text-white text-left">
              <Th>Data</Th><Th>CID</Th><Th>Descrição</Th><Th>Grau</Th><Th>Observação</Th><Th>Ativo</Th><Th>Ação</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-ink-500">Nenhum problema cadastrado.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t border-black/5 ${i % 2 ? "bg-brand-50/30" : ""}`}>
                <Td>{formatarData(r.criadoEm)}</Td>
                <Td>{r.cid}</Td>
                <Td>{r.descricao}</Td>
                <Td>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${grauStyle[r.grau] || grauStyle["SEM CLASSIFICAÇÃO"]}`}>{r.grau}</span>
                </Td>
                <Td>
                  <input
                    defaultValue={r.observacao}
                    onBlur={(e) => e.target.value !== r.observacao && atualizarDocumento(`${pacientePath}/problemas`, r.id, { observacao: e.target.value })}
                    className="w-full text-xs border border-black/10 rounded px-2 py-1 focus-ring"
                  />
                </Td>
                <Td>
                  <input type="checkbox" checked={r.ativo} onChange={() => alternarAtivo(`${pacientePath}/problemas`, r.id, !r.ativo)} className="rounded accent-brand-600" />
                </Td>
                <Td>
                  <button onClick={() => alternarAtivo(`${pacientePath}/problemas`, r.id, false)} className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold px-3 py-1 rounded-md focus-ring">
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

function formatarData(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("pt-BR");
}
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px] tracking-wide">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
