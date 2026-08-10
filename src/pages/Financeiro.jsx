import { useState } from "react";
import Topbar from "../components/Topbar";
import { ArrowDownCircle, ArrowUpCircle, Wallet, CheckCircle2, Clock3, Plus, Loader2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento } from "../lib/firestore";

export default function Financeiro() {
  const { clinicaId, firebaseConfigured } = useTenant();
  const [tab, setTab] = useState("receber");
  const [showForm, setShowForm] = useState(false);

  const colName = tab === "receber" ? "contasReceber" : "contasPagar";
  const { data: rows, loading, error } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/${colName}` : null, "vencimento", "asc");

  const totalReceberAberto = useTotalAberto(clinicaId, "contasReceber");
  const totalPagarAberto = useTotalAberto(clinicaId, "contasPagar");

  async function marcarPago(id) {
    await atualizarDocumento(`clinicas/${clinicaId}/${colName}`, id, { status: "pago" });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Financeiro" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Stat icon={ArrowDownCircle} label="A receber (em aberto)" value={totalReceberAberto} tone="bg-emerald-50 text-emerald-600" />
          <Stat icon={ArrowUpCircle} label="A pagar (em aberto)" value={totalPagarAberto} tone="bg-rose-50 text-rose-600" />
          <Stat icon={Wallet} label="Saldo projetado" value={formatarMoeda(totalReceberAberto.raw - totalPagarAberto.raw)} tone="bg-brand-50 text-brand-600" />
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5">
            <div className="flex">
              <TabBtn active={tab === "receber"} onClick={() => setTab("receber")}>Contas a Receber</TabBtn>
              <TabBtn active={tab === "pagar"} onClick={() => setTab("pagar")}>Contas a Pagar</TabBtn>
            </div>
            <button onClick={() => setShowForm(true)} disabled={!firebaseConfigured} className="mr-3 flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring">
              <Plus size={14} /> Nova conta
            </button>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : error?.code === "permission-denied" ? (
            <div className="p-8 text-center text-sm text-ink-500">
              Seu usuário não tem permissão para ver o financeiro desta clínica — é preciso papel <span className="font-semibold">admin</span> ou <span className="font-semibold">financeiro</span> em <code className="font-mono text-xs">membros</code>.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">Nenhuma conta cadastrada.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500 border-b border-black/5">
                  <Th>Descrição</Th><Th>Vencimento</Th><Th>Valor</Th><Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 last:border-0">
                    <Td className="font-medium text-ink-900">{r.descricao}</Td>
                    <Td>{r.vencimento}</Td>
                    <Td>{formatarMoeda(r.valor)}</Td>
                    <Td>
                      {r.status === "pago" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> Pago</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Clock3 size={11} /> Pendente</span>
                      )}
                    </Td>
                    <Td>
                      {r.status !== "pago" && (
                        <button onClick={() => marcarPago(r.id)} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">Marcar como pago</button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showForm && (
        <NovaContaModal clinicaId={clinicaId} colName={colName} tab={tab} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function useTotalAberto(clinicaId, colName) {
  const { data } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/${colName}` : null, "vencimento", "asc");
  const raw = data.filter((r) => r.status !== "pago").reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  return { raw, toString: () => formatarMoeda(raw) };
}

function formatarMoeda(v) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon size={18} /></div>
      <div>
        <div className="text-base font-display font-bold text-ink-900 leading-none">{typeof value === "object" ? value.toString() : value}</div>
        <div className="text-[11px] text-ink-500 mt-1">{label}</div>
      </div>
    </div>
  );
}
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-3 text-sm font-medium focus-ring relative ${active ? "text-brand-700" : "text-ink-500 hover:text-ink-900"}`}>
      {children}
      {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
    </button>
  );
}
function Th({ children }) { return <th className="px-4 py-2.5 font-semibold text-[11px]">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-4 py-2.5 text-ink-700 ${className}`}>{children}</td>; }

function NovaContaModal({ clinicaId, colName, tab, onClose }) {
  const [form, setForm] = useState({ descricao: "", vencimento: "", valor: "", convenioId: "" });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.descricao.trim() || !form.valor) return;
    setSalvando(true);
    try {
      await criarDocumento(`clinicas/${clinicaId}/${colName}`, {
        descricao: form.descricao, vencimento: form.vencimento, valor: Number(form.valor), convenioId: form.convenioId || null, status: "pendente",
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="px-5 py-4 bg-brand-600 text-white font-display font-semibold">
          Nova conta a {tab === "receber" ? "receber" : "pagar"}
        </div>
        <div className="p-5 space-y-3">
          <Field label="Descrição" value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimento" type="date" value={form.vencimento} onChange={(v) => setForm({ ...form, vencimento: v })} />
            <Field label="Valor (R$)" type="number" value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
          </div>
          {tab === "receber" && <Field label="Convênio (opcional)" value={form.convenioId} onChange={(v) => setForm({ ...form, convenioId: v })} />}
        </div>
        <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
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
