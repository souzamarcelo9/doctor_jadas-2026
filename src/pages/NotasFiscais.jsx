import { useState } from "react";
import Topbar from "../components/Topbar";
import { Receipt, PlugZap, ShieldCheck, Send, Clock3, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../lib/firestore";

const statusTone = {
  autorizada: { label: "Autorizada", tone: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  processando: { label: "Processando", tone: "bg-amber-100 text-amber-700", icon: Clock3 },
  rejeitada: { label: "Rejeitada", tone: "bg-rose-100 text-rose-700", icon: AlertTriangle },
};

export default function NotasFiscais() {
  const { clinicaId, firebaseConfigured } = useTenant();
  const { data: historico, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/notasFiscais` : null);
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({ tomador: "", cpfCnpj: "", codigoServico: "04498 - Consulta médica", valor: "", aliquota: "2%", discriminacao: "Consulta médica" });

  async function emitir(e) {
    e.preventDefault();
    if (!form.tomador.trim() || !form.valor) return;
    setIssuing(true);
    try {
      // Simulação de protótipo: em produção, este passo chamaria o web
      // service SOAP da Prefeitura (envio do RPS assinado com certificado A1)
      // de forma assíncrona, começando em "processando" até a confirmação.
      await new Promise((r) => setTimeout(r, 1400));
      await criarDocumento(`clinicas/${clinicaId}/notasFiscais`, {
        tomador: form.tomador, cpfCnpj: form.cpfCnpj, codigoServico: form.codigoServico,
        valor: Number(form.valor), aliquota: form.aliquota, discriminacao: form.discriminacao,
        status: "autorizada",
      });
      setForm({ tomador: "", cpfCnpj: "", codigoServico: "04498 - Consulta médica", valor: "", aliquota: "2%", discriminacao: "Consulta médica" });
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Notas Fiscais" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="card p-4 flex items-start gap-3 bg-brand-50/40 border-brand-100">
          <PlugZap size={18} className="text-brand-600 mt-0.5 shrink-0" />
          <div className="text-xs text-ink-700">
            <span className="font-semibold text-ink-900">Integração NFS-e Paulistana (Prefeitura de São Paulo).</span>{" "}
            A emissão abaixo já é persistida no Firestore de verdade — o que ainda é simulado é a chamada ao web service
            SOAP da Prefeitura (assinatura com certificado A1 e status assíncrono), que fica para a próxima etapa de integração.
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <form onSubmit={emitir} className="lg:col-span-2 card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={16} className="text-brand-600" />
              <span className="text-sm font-display font-semibold text-ink-900">Emitir NFS-e</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Tomador do serviço" value={form.tomador} onChange={(v) => setForm({ ...form, tomador: v })} />
              <Field label="CPF/CNPJ" value={form.cpfCnpj} onChange={(v) => setForm({ ...form, cpfCnpj: v })} />
              <Field label="Código de serviço" value={form.codigoServico} onChange={(v) => setForm({ ...form, codigoServico: v })} />
              <Field label="Valor do serviço (R$)" type="number" value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
              <Field label="Alíquota ISS" value={form.aliquota} onChange={(v) => setForm({ ...form, aliquota: v })} />
            </div>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Discriminação dos serviços</span>
              <textarea rows={3} value={form.discriminacao} onChange={(e) => setForm({ ...form, discriminacao: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none" />
            </label>

            <button disabled={issuing || !firebaseConfigured} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {issuing ? (<><Loader2 size={16} className="animate-spin" /> Enviando ao web service da Prefeitura…</>) : (<><Send size={15} /> Emitir Nota Fiscal</>)}
            </button>
          </form>

          <div className="card p-4">
            <div className="text-sm font-display font-semibold text-ink-900 mb-3">Status da integração</div>
            <ul className="space-y-2.5 text-xs text-ink-700">
              <StatusRow label="Persistência no Firestore" ok />
              <StatusRow label="Certificado digital A1" />
              <StatusRow label="Web service da Prefeitura (SOAP)" />
            </ul>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 text-sm font-display font-semibold text-ink-900">Notas emitidas</div>
          {loading ? (
            <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : historico.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">Nenhuma nota emitida ainda.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500 border-b border-black/5">
                  <Th>Tomador</Th><Th>Valor</Th><Th>Data</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {historico.map((n) => {
                  const S = statusTone[n.status] || statusTone.processando;
                  return (
                    <tr key={n.id} className="border-b border-black/5 last:border-0">
                      <Td>{n.tomador}</Td>
                      <Td>{(n.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                      <Td>{n.criadoEm?.toDate ? n.criadoEm.toDate().toLocaleDateString("pt-BR") : "—"}</Td>
                      <Td><span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${S.tone}`}><S.icon size={11} /> {S.label}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <input {...props} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}
function StatusRow({ label, ok }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-gray-300"}`} />
      {label}
      <span className="ml-auto text-[10px] text-ink-500">{ok ? "conectado" : "pendente"}</span>
    </li>
  );
}
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px]">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
