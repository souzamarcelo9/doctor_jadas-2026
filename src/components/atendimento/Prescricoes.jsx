import { useState } from "react";
import { Pill, ExternalLink, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../../lib/firestore";

export default function Prescricoes() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/prescricoes`);
  const [opening, setOpening] = useState(false);

  function novaReceita() {
    if (!firebaseConfigured) return;
    setOpening(true);
    setTimeout(async () => {
      await criarDocumento(`${pacientePath}/prescricoes`, {
        medicamento: "Nova prescrição via Memed",
        posologia: "Definida na receita digital",
        status: "Enviada ao paciente",
        atendimentoId,
        profissionalId,
        ativo: true,
      });
      setOpening(false);
    }, 1300);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Pill size={20} /></div>
        <div className="flex-1">
          <div className="font-display font-semibold text-sm">Receita Digital — integração Memed</div>
          <div className="text-xs text-white/80 mt-0.5">Prescreva com segurança digital e mantenha o histórico sincronizado com o prontuário.</div>
        </div>
        <button onClick={novaReceita} disabled={opening || !firebaseConfigured} className="shrink-0 flex items-center gap-2 bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-70 text-xs font-semibold px-4 py-2.5 rounded-lg focus-ring">
          {opening ? (<><Loader2 size={14} className="animate-spin" /> Abrindo Memed…</>) : (<><ExternalLink size={14} /> Nova receita</>)}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-500 border-b border-black/5">
              <Th>Data</Th><Th>Medicamento</Th><Th>Posologia</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-ink-500">Nenhuma prescrição ainda.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0">
                <Td className="whitespace-nowrap">{formatarData(r.criadoEm)}</Td>
                <Td className="font-medium text-ink-900">{r.medicamento}</Td>
                <Td>{r.posologia}</Td>
                <Td><span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> {r.status}</span></Td>
                <Td><button title="Reenviar" className="p-1.5 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 focus-ring"><Send size={13} /></button></Td>
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
