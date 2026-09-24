import { useState } from "react";
import { X, ShieldCheck, Loader2, Search } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection } from "../lib/firestore";

function formatarData(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function LogAcessoModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const { data: logs, loading } = useFirestoreCollection(open && clinicaId ? `clinicas/${clinicaId}/logsAcesso` : null, "criadoEm", "desc");
  const [busca, setBusca] = useState("");

  if (!open) return null;

  const filtrados = logs.filter((l) =>
    !busca.trim() ||
    l.pacienteNome?.toLowerCase().includes(busca.toLowerCase()) ||
    l.nomeUsuario?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><ShieldCheck size={18} /> Log de acesso a prontuário</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="p-4 border-b border-black/5 shrink-0">
          <p className="text-xs text-ink-500 mb-3">
            Registro de quem abriu o prontuário de cada paciente, e quando — trilha de auditoria pra atender a LGPD (art. 46). Não pode ser editado nem apagado, nem por admin.
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por paciente ou profissional…"
              className="w-full text-sm border border-black/10 rounded-lg pl-9 pr-3 py-2 focus-ring"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando…</div>}
          {!loading && filtrados.length === 0 && <div className="p-8 text-center text-sm text-ink-500">Nenhum acesso registrado ainda.</div>}
          {!loading && filtrados.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-ink-500 border-b border-black/5">
                  <th className="px-4 py-2.5 font-semibold">Quando</th>
                  <th className="px-4 py-2.5 font-semibold">Quem acessou</th>
                  <th className="px-4 py-2.5 font-semibold">Paciente</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 200).map((l) => (
                  <tr key={l.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-2 text-ink-500 whitespace-nowrap">{formatarData(l.criadoEm)}</td>
                    <td className="px-4 py-2 text-ink-900 font-medium">{l.nomeUsuario}</td>
                    <td className="px-4 py-2 text-ink-700">{l.pacienteNome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
