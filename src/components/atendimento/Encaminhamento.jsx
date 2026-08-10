import { useState } from "react";
import { Send, ArrowRight, Loader2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../../lib/firestore";

export default function Encaminhamento() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/encaminhamentos`);
  const [especialidade, setEspecialidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function encaminhar() {
    if (!especialidade.trim() || !firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/encaminhamentos`, {
        especialidade, motivo, status: "Agendado", ativo: true, atendimentoId, profissionalId,
      });
      setEspecialidade("");
      setMotivo("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-4 space-y-3">
        <div className="text-sm font-display font-semibold text-ink-900 flex items-center gap-2">
          <ArrowRight size={16} className="text-brand-600" /> Novo encaminhamento
        </div>
        <label className="block text-xs">
          <span className="text-ink-500 font-medium">Especialidade</span>
          <input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex: Cardiologia"
            className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
        </label>
        <label className="block text-xs">
          <span className="text-ink-500 font-medium">Motivo</span>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo do encaminhamento…"
            className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none" />
        </label>
        <button onClick={encaminhar} disabled={salvando || !firebaseConfigured} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Encaminhar paciente
        </button>
      </div>

      <div className="lg:col-span-2 card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-500 border-b border-black/5">
              <Th>Data</Th><Th>Especialidade</Th><Th>Motivo</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-ink-500">Nenhum encaminhamento ainda.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0">
                <Td className="whitespace-nowrap">{formatarData(r.criadoEm)}</Td>
                <Td className="font-medium text-ink-900">{r.especialidade}</Td>
                <Td>{r.motivo}</Td>
                <Td><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{r.status}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleDateString("pt-BR") : "—"; }
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px]">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
