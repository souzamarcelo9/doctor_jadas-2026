import { useState } from "react";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento, alternarAtivo } from "../../lib/firestore";

const grauStyle = {
  LEVE: "badge-leve",
  MODERADA: "badge-moderada",
  SEVERA: "badge-severa",
  "SEM CLASSIFICAÇÃO": "bg-gray-100 text-gray-500 border border-gray-200",
};

export default function Alergias() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/alergias`);
  const [form, setForm] = useState({ tipo: "Medicamentosa", agente: "", reacao: "", grau: "LEVE" });
  const [salvando, setSalvando] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function adicionar() {
    if (!form.agente.trim() || !firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/alergias`, { ...form, ativo: true, atendimentoId, profissionalId });
      setForm({ tipo: "Medicamentosa", agente: "", reacao: "", grau: "LEVE" });
      setShowForm(false);
    } finally {
      setSalvando(false);
    }
  }

  const ativos = rows.filter((r) => r.ativo);

  return (
    <div className="space-y-4">
      {ativos.length > 0 && (
        <div className="card p-3.5 bg-rose-50/60 border-rose-100 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-700">
            <span className="font-semibold">Atenção:</span> paciente possui {ativos.length} alergia(s) ativa(s) — {ativos.map((a) => a.agente).join(", ")}.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" className="rounded accent-brand-600" /> Exibir inativos
        </label>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring">
          <Plus size={14} /> Nova alergia
        </button>
      </div>

      {showForm && (
        <div className="card p-3 grid sm:grid-cols-4 gap-2">
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
            <option>Medicamentosa</option><option>Alimentar</option><option>Ambiental</option>
          </select>
          <input placeholder="Agente" value={form.agente} onChange={(e) => setForm({ ...form, agente: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          <input placeholder="Reação" value={form.reacao} onChange={(e) => setForm({ ...form, reacao: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          <select value={form.grau} onChange={(e) => setForm({ ...form, grau: e.target.value })} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
            <option>LEVE</option><option>MODERADA</option><option>SEVERA</option>
          </select>
          <button onClick={adicionar} disabled={salvando || !firebaseConfigured} className="sm:col-span-4 flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold py-2 rounded-lg focus-ring">
            {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Salvar alergia
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-700 text-white text-left">
              <Th>Data</Th><Th>Tipo</Th><Th>Agente</Th><Th>Reação</Th><Th>Grau</Th><Th>Ativo</Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-ink-500">Nenhuma alergia cadastrada.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t border-black/5 ${i % 2 ? "bg-brand-50/30" : ""}`}>
                <Td>{formatarData(r.criadoEm)}</Td>
                <Td>{r.tipo}</Td>
                <Td className="font-medium text-ink-900">{r.agente}</Td>
                <Td>{r.reacao}</Td>
                <Td><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${grauStyle[r.grau] || grauStyle["SEM CLASSIFICAÇÃO"]}`}>{r.grau}</span></Td>
                <Td><input type="checkbox" checked={r.ativo} onChange={() => alternarAtivo(`${pacientePath}/alergias`, r.id, !r.ativo)} className="rounded accent-brand-600" /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleDateString("pt-BR") : "—"; }
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px] tracking-wide">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
