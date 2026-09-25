import { useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, CheckCircle2, Clock3, Plus, Loader2,
  Search, ChevronLeft, ChevronRight, Paperclip, Mail, MessageCircle, X, AlertTriangle,
} from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento } from "../lib/firestore";
import { enviarComprovantePagamento } from "../lib/storage";
import { enviarComprovanteFinanceiro } from "../lib/avaliacoes";
import { abrirLinkWhatsapp, montarMensagemComprovante } from "../lib/whatsapp";
import { emailValido } from "../lib/masks";

const ITENS_POR_PAGINA = 10;

export default function Financeiro() {
  const { clinicaId, firebaseConfigured } = useTenant();
  const [tab, setTab] = useState("receber");
  const [showForm, setShowForm] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [pagina, setPagina] = useState(1);

  const colName = tab === "receber" ? "contasReceber" : "contasPagar";
  const { data: rows, loading, error } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/${colName}` : null, "vencimento", "asc");

  const totalReceberAberto = useTotalAberto(clinicaId, "contasReceber");
  const totalPagarAberto = useTotalAberto(clinicaId, "contasPagar");

  const filtradas = useMemo(() => {
    const txt = filtroTexto.trim().toLowerCase();
    return rows.filter((r) => {
      if (txt && !`${r.descricao || ""} ${r.pacienteNome || ""}`.toLowerCase().includes(txt)) return false;
      if (filtroDe && (!r.vencimento || r.vencimento < filtroDe)) return false;
      if (filtroAte && (!r.vencimento || r.vencimento > filtroAte)) return false;
      return true;
    });
  }, [rows, filtroTexto, filtroDe, filtroAte]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginaRows = filtradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  function mudarTab(t) { setTab(t); setPagina(1); }
  function limparFiltros() { setFiltroTexto(""); setFiltroDe(""); setFiltroAte(""); setPagina(1); }

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
          <div className="flex items-center justify-between border-b border-black/5 flex-wrap gap-2">
            <div className="flex">
              <TabBtn active={tab === "receber"} onClick={() => mudarTab("receber")}>Contas a Receber</TabBtn>
              <TabBtn active={tab === "pagar"} onClick={() => mudarTab("pagar")}>Contas a Pagar</TabBtn>
            </div>
            <button onClick={() => setShowForm(true)} disabled={!firebaseConfigured} className="mr-3 flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring">
              <Plus size={14} /> Nova conta
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-black/5 bg-gray-50/50">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                value={filtroTexto}
                onChange={(e) => { setFiltroTexto(e.target.value); setPagina(1); }}
                placeholder="Buscar por descrição ou paciente…"
                className="w-full text-xs border border-black/10 rounded-lg pl-7 pr-2.5 py-1.5 focus-ring"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
              Vencimento de
              <input type="date" value={filtroDe} onChange={(e) => { setFiltroDe(e.target.value); setPagina(1); }} className="text-xs border border-black/10 rounded-lg px-2 py-1 focus-ring" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
              até
              <input type="date" value={filtroAte} onChange={(e) => { setFiltroAte(e.target.value); setPagina(1); }} className="text-xs border border-black/10 rounded-lg px-2 py-1 focus-ring" />
            </label>
            {(filtroTexto || filtroDe || filtroAte) && (
              <button onClick={limparFiltros} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 ml-auto">Limpar filtros</button>
            )}
          </div>

          {loading ? (
            <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : error?.code === "permission-denied" ? (
            <div className="p-8 text-center text-sm text-ink-500">
              Seu usuário não tem permissão para ver o financeiro desta clínica — é preciso papel <span className="font-semibold">admin</span> ou <span className="font-semibold">financeiro</span> em <code className="font-mono text-xs">membros</code>.
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">
              {rows.length === 0 ? "Nenhuma conta cadastrada." : "Nenhuma conta encontrada com esses filtros."}
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-500 border-b border-black/5">
                    <Th>Descrição</Th>
                    {tab === "receber" && <Th>Paciente</Th>}
                    <Th>Vencimento</Th>
                    <Th>Valor</Th>
                    {tab === "receber" && <Th>Convênio</Th>}
                    <Th>Status</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {paginaRows.map((r) => (
                    <tr key={r.id} className="border-b border-black/5 last:border-0">
                      <Td className="font-medium text-ink-900">{r.descricao}</Td>
                      {tab === "receber" && <Td>{r.pacienteNome || "—"}</Td>}
                      <Td>{formatarDataBR(r.vencimento)}</Td>
                      <Td>{formatarMoeda(r.valor)}</Td>
                      {tab === "receber" && (
                        <Td>
                          {r.convenioNome ? (
                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{r.convenioNome}{r.reembolsoConvenio ? " · reembolso" : ""}</span>
                          ) : (
                            <span className="text-ink-500">Particular</span>
                          )}
                        </Td>
                      )}
                      <Td>
                        {r.status === "pago" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> Pago</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Clock3 size={11} /> Pendente</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 justify-end">
                          {r.status !== "pago" && (
                            <button onClick={() => marcarPago(r.id)} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">Marcar como pago</button>
                          )}
                          {tab === "receber" && r.comprovanteUrl && (
                            <a href={r.comprovanteUrl} target="_blank" rel="noopener noreferrer" title="Ver comprovante" className="p-1 rounded text-ink-500 hover:text-brand-600 hover:bg-brand-50 focus-ring">
                              <Paperclip size={13} />
                            </a>
                          )}
                          {tab === "receber" && r.comprovanteUrl && (
                            <AcoesEnvio clinicaId={clinicaId} conta={r} />
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-black/5">
                  <span className="text-[11px] text-ink-500">Página {paginaAtual} de {totalPaginas} · {filtradas.length} conta(s)</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="p-1.5 rounded-lg border border-black/10 text-ink-500 disabled:opacity-40 focus-ring">
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="p-1.5 rounded-lg border border-black/10 text-ink-500 disabled:opacity-40 focus-ring">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showForm && (
        <NovaContaModal clinicaId={clinicaId} colName={colName} tab={tab} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

/** Botões de enviar o comprovante por e-mail (Cloud Function + Resend) ou
 * WhatsApp (link manual, mesma infra já usada nos lembretes de consulta) —
 * só aparecem quando já tem comprovante anexado. */
function AcoesEnvio({ clinicaId, conta }) {
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function enviarEmail() {
    if (!conta.pacienteEmail) { setFeedback("Sem e-mail cadastrado"); setTimeout(() => setFeedback(""), 2500); return; }
    setEnviando(true);
    setFeedback("");
    try {
      await enviarComprovanteFinanceiro(clinicaId, conta.id);
      setFeedback("Enviado!");
    } catch (err) {
      console.error("Erro ao enviar comprovante por e-mail:", err);
      setFeedback(err.message || "Falha ao enviar");
    } finally {
      setEnviando(false);
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  function enviarWhatsapp() {
    const ok = abrirLinkWhatsapp(conta.pacienteCelular, montarMensagemComprovante(conta.pacienteNome, conta.comprovanteUrl));
    if (!ok) { setFeedback("Sem celular cadastrado"); setTimeout(() => setFeedback(""), 2500); }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={enviarEmail} disabled={enviando} title="Enviar por e-mail" className="p-1 rounded text-ink-500 hover:text-brand-600 hover:bg-brand-50 focus-ring disabled:opacity-50">
        {enviando ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
      </button>
      <button onClick={enviarWhatsapp} title="Enviar por WhatsApp" className="p-1 rounded text-ink-500 hover:text-emerald-600 hover:bg-emerald-50 focus-ring">
        <MessageCircle size={13} />
      </button>
      {feedback && <span className="text-[10px] text-ink-500 whitespace-nowrap">{feedback}</span>}
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
function formatarDataBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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
  const ehReceber = tab === "receber";
  const { data: convenios } = useFirestoreCollection(ehReceber && clinicaId ? `clinicas/${clinicaId}/convenios` : null, "nome", "asc");
  const { data: pacientes } = useFirestoreCollection(ehReceber && clinicaId ? `clinicas/${clinicaId}/pacientes` : null, "nome", "asc");

  const [form, setForm] = useState({
    descricao: "", vencimento: "", valor: "",
    convenioId: "", convenioNome: "", reembolsoConvenio: false,
    dataProcedimento: "", horaProcedimento: "",
    pacienteId: "", pacienteNome: "", pacienteCelular: "", pacienteEmail: "", pacienteCpf: "",
  });
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const pacientesFiltrados = useMemo(() => {
    const q = buscaPaciente.trim().toLowerCase();
    if (q.length < 3) return [];
    return pacientes.filter((p) => p.nome?.toLowerCase().includes(q)).slice(0, 8);
  }, [buscaPaciente, pacientes]);

  function selecionarPaciente(p) {
    setForm((f) => ({ ...f, pacienteId: p.id, pacienteNome: p.nome, pacienteCelular: p.celular || p.telefone || "", pacienteEmail: p.email || "", pacienteCpf: p.cpf || "" }));
    setBuscaPaciente("");
  }
  function limparPaciente() {
    setForm((f) => ({ ...f, pacienteId: "", pacienteNome: "", pacienteCelular: "", pacienteEmail: "", pacienteCpf: "" }));
  }
  function selecionarConvenio(id) {
    const c = convenios.find((c) => c.id === id);
    // Ao escolher um convênio, já marca "reembolso" como padrão (é o caso
    // típico); ao voltar pra Particular, desmarca. Continua editável — a
    // clínica pode ter um convênio de pagamento direto sem reembolso.
    setForm((f) => ({ ...f, convenioId: id, convenioNome: c?.nome || "", reembolsoConvenio: Boolean(id) }));
  }

  async function salvar() {
    setErro("");
    if (!form.descricao.trim() || !form.valor) return;
    if (ehReceber && form.pacienteEmail && !emailValido(form.pacienteEmail)) { setErro("E-mail do paciente inválido."); return; }
    setSalvando(true);
    try {
      const dados = ehReceber
        ? {
            descricao: form.descricao, vencimento: form.vencimento, valor: Number(form.valor), status: "pendente",
            convenioId: form.convenioId || null, convenioNome: form.convenioNome || null, reembolsoConvenio: !!form.reembolsoConvenio,
            dataProcedimento: form.dataProcedimento || null, horaProcedimento: form.horaProcedimento || null,
            pacienteId: form.pacienteId || null, pacienteNome: form.pacienteNome || null,
            pacienteCelular: form.pacienteCelular || null, pacienteEmail: form.pacienteEmail || null,
            pacienteCpf: form.pacienteCpf || null,
          }
        : { descricao: form.descricao, vencimento: form.vencimento, valor: Number(form.valor), status: "pendente" };

      const ref = await criarDocumento(`clinicas/${clinicaId}/${colName}`, dados);

      if (ehReceber && !form.convenioId && comprovanteFile) {
        const url = await enviarComprovantePagamento(clinicaId, ref.id, comprovanteFile);
        await atualizarDocumento(`clinicas/${clinicaId}/${colName}`, ref.id, { comprovanteUrl: url });
      }
      onClose();
    } catch (err) {
      console.error("Erro ao criar conta:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="px-5 py-4 bg-brand-600 text-white font-display font-semibold shrink-0">
          Nova conta a {ehReceber ? "receber" : "pagar"}
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

          <Field label="Descrição" value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimento" type="date" value={form.vencimento} onChange={(v) => setForm({ ...form, vencimento: v })} />
            <Field label="Valor (R$)" type="number" value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
          </div>

          {ehReceber && (
            <>
              <div className="pt-1 border-t border-black/5" />

              {form.pacienteId ? (
                <div className="flex items-center gap-2 bg-brand-50/60 border border-brand-100 rounded-lg p-2.5">
                  <span className="flex-1 text-xs font-semibold text-ink-900">{form.pacienteNome}</span>
                  <button onClick={limparPaciente} className="p-1 rounded text-ink-500 hover:text-rose-600 focus-ring"><X size={13} /></button>
                </div>
              ) : (
                <div className="relative">
                  <label className="block text-xs">
                    <span className="text-ink-500 font-medium">Paciente (opcional)</span>
                    <input
                      value={buscaPaciente}
                      onChange={(e) => setBuscaPaciente(e.target.value)}
                      placeholder="Buscar por nome, mínimo 3 letras…"
                      className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
                    />
                  </label>
                  {pacientesFiltrados.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-black/10 rounded-lg shadow-pop max-h-40 overflow-y-auto">
                      {pacientesFiltrados.map((p) => (
                        <button key={p.id} onClick={() => selecionarPaciente(p)} className="w-full text-left text-xs px-3 py-2 hover:bg-brand-50">
                          {p.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Convênio" value={form.convenioId} onChange={selecionarConvenio} options={convenios.map((c) => c.id)} labels={Object.fromEntries(convenios.map((c) => [c.id, c.nome]))} placeholder="Particular" />
                <label className="flex items-center gap-2 text-xs mt-5">
                  <input type="checkbox" checked={form.reembolsoConvenio} onChange={(e) => setForm({ ...form, reembolsoConvenio: e.target.checked })} disabled={!form.convenioId} className="rounded accent-brand-600 disabled:opacity-40" />
                  <span className={form.convenioId ? "text-ink-700" : "text-ink-500"}>Reembolso pelo convênio</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data do procedimento" type="date" value={form.dataProcedimento} onChange={(v) => setForm({ ...form, dataProcedimento: v })} />
                <Field label="Horário" type="time" value={form.horaProcedimento} onChange={(v) => setForm({ ...form, horaProcedimento: v })} />
              </div>

              {!form.convenioId && (
                <label className="block text-xs">
                  <span className="text-ink-500 font-medium">Comprovante de pagamento (Particular)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setComprovanteFile(e.target.files?.[0] || null)}
                    className="mt-1 w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                </label>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2 shrink-0">
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
      <input {...props} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}
function SelectField({ label, value, onChange, options, labels, placeholder }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
        <option value="">{placeholder || "Selecione"}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{labels ? labels[opt] : opt}</option>
        ))}
      </select>
    </label>
  );
}
