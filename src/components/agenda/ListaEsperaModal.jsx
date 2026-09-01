import { useMemo, useState } from "react";
import { X, Search, Loader2, CalendarPlus, Trash2 } from "lucide-react";
import { useFirestoreCollection, criarDocumento, atualizarDocumento, excluirDocumento } from "../../lib/firestore";
import { diasSemanaChave, paraISO } from "../../lib/agendaSlots";

const diasLabel = { segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira", quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado", domingo: "Domingo" };
const diasLabelCurto = { segunda: "Seg", terca: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sabado: "Sáb", domingo: "Dom" };
const diasUteis = ["segunda", "terca", "quarta", "quinta", "sexta"];
const periodos = [{ chave: "manha", label: "Manhã" }, { chave: "tarde", label: "Tarde" }, { chave: "noite", label: "Noite" }];

function hojeISO() { return paraISO(new Date()); }
function somarDias(iso, n) { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return paraISO(d); }
function formularioVazio(profissionalId, nomeMedico) {
  return {
    pacienteId: "", nome: "", convenioId: "", celular: "",
    diasPreferencia: diasUteis, dataInicial: hojeISO(), dataFinal: somarDias(hojeISO(), 30),
    periodos: ["manha", "tarde", "noite"], profissionalId, nomeMedico,
  };
}

export default function ListaEsperaModal({ clinicaId, profissionalId, nomeMedico, pacientes, onClose, onAgendar }) {
  const [aba, setAba] = useState("formulario");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(() => formularioVazio(profissionalId, nomeMedico));
  const [novoPaciente, setNovoPaciente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const { data: convenios } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/convenios` : null, "nome", "asc");
  const { data: lista, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/listaEspera` : null, "criadoEm", "desc");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 3) return [];
    return pacientes.filter((p) => p.nome?.toLowerCase().includes(q));
  }, [busca, pacientes]);

  const aguardando = useMemo(() => lista.filter((l) => l.status !== "cancelado" && l.status !== "atendido"), [lista]);

  function selecionarPaciente(p) {
    setForm((f) => ({ ...f, pacienteId: p.id, nome: p.nome, celular: p.celular || p.telefone || "", convenioId: p.convenioId || "" }));
    setBusca(p.nome);
  }

  function alternarDia(dia) {
    setForm((f) => ({ ...f, diasPreferencia: f.diasPreferencia.includes(dia) ? f.diasPreferencia.filter((d) => d !== dia) : [...f.diasPreferencia, dia] }));
  }
  function alternarPeriodo(chave) {
    setForm((f) => ({ ...f, periodos: f.periodos.includes(chave) ? f.periodos.filter((p) => p !== chave) : [...f.periodos, chave] }));
  }

  async function salvar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Informe ou selecione o paciente."); return; }
    if (form.diasPreferencia.length === 0) { setErro("Selecione ao menos um dia de preferência."); return; }
    setSalvando(true);
    try {
      const convenioNome = convenios.find((c) => c.id === form.convenioId)?.nome || "Particular";
      await criarDocumento(`clinicas/${clinicaId}/listaEspera`, {
        pacienteId: form.pacienteId || null,
        pacienteNome: form.nome,
        celular: form.celular || null,
        convenioId: form.convenioId || null,
        convenioNome,
        profissionalId: form.profissionalId,
        nomeMedico: form.nomeMedico,
        diasPreferencia: form.diasPreferencia,
        dataInicial: form.dataInicial,
        dataFinal: form.dataFinal,
        periodos: form.periodos,
        status: "aguardando",
      });
      setForm(formularioVazio(profissionalId, nomeMedico));
      setBusca(""); setNovoPaciente(false);
      setAba("lista");
    } catch (err) {
      console.error("Erro ao salvar lista de espera:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcarAtendido(id) {
    await atualizarDocumento(`clinicas/${clinicaId}/listaEspera`, id, { status: "atendido" });
  }
  async function remover(id) {
    await excluirDocumento(`clinicas/${clinicaId}/listaEspera`, id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold">Lista de espera</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="flex border-b border-black/5 shrink-0">
          <TabBtn active={aba === "formulario"} onClick={() => setAba("formulario")}>Formulário de espera</TabBtn>
          <TabBtn active={aba === "lista"} onClick={() => setAba("lista")}>Lista de espera {aguardando.length > 0 && `(${aguardando.length})`}</TabBtn>
        </div>

        {aba === "formulario" ? (
          <div className="overflow-y-auto p-5 space-y-4">
            {erro && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>}

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  value={busca} disabled={novoPaciente}
                  onChange={(e) => { setBusca(e.target.value); setForm((f) => ({ ...f, pacienteId: "", nome: e.target.value })); }}
                  placeholder="Busca por nome, mínimo de 3 caracteres"
                  className="w-full text-sm border border-black/10 rounded-lg pl-8 pr-3 py-2 focus-ring disabled:bg-gray-50"
                />
                {filtrados.length > 0 && !form.pacienteId && (
                  <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-black/10 rounded-lg shadow-pop divide-y divide-black/5">
                    {filtrados.map((p) => (
                      <button key={p.id} onClick={() => selecionarPaciente(p)} className="w-full text-left text-xs px-3 py-2 hover:bg-brand-50 focus-ring">{p.nome}</button>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-700 shrink-0">
                <input type="checkbox" checked={novoPaciente} onChange={(e) => { setNovoPaciente(e.target.checked); setBusca(""); setForm((f) => ({ ...f, pacienteId: "", nome: "" })); }} className="rounded focus-ring" />
                Novo Paciente
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Convênio" value={form.convenioId} onChange={(v) => setForm({ ...form, convenioId: v })} options={convenios.map((c) => c.id)} labels={Object.fromEntries(convenios.map((c) => [c.id, c.nome]))} placeholder="Particular" />
              <Field label="Celular" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} placeholder="(00) 00000-0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Médico" value={nomeMedico} disabled />
              <Field label="Clínica" value="Clínica atual" disabled />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-ink-500 font-medium">Período de preferência — dias</span>
              <div className="flex flex-wrap gap-3">
                {diasSemanaChave.map((dia) => (
                  <label key={dia} className="flex items-center gap-1.5 text-xs text-ink-700">
                    <input type="checkbox" checked={form.diasPreferencia.includes(dia)} onChange={() => alternarDia(dia)} className="rounded focus-ring" />
                    {diasLabel[dia]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data inicial" type="date" value={form.dataInicial} onChange={(v) => setForm({ ...form, dataInicial: v })} />
              <Field label="Data final" type="date" value={form.dataFinal} onChange={(v) => setForm({ ...form, dataFinal: v })} />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-ink-500 font-medium">Período</span>
              <div className="flex flex-wrap gap-3">
                {periodos.map(({ chave, label }) => (
                  <label key={chave} className="flex items-center gap-1.5 text-xs text-ink-700">
                    <input type="checkbox" checked={form.periodos.includes(chave)} onChange={() => alternarPeriodo(chave)} className="rounded focus-ring" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-2">
            {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
            {!loading && aguardando.length === 0 && <p className="text-xs text-ink-500 text-center py-6">Ninguém na lista de espera no momento.</p>}
            {aguardando.map((item) => (
              <div key={item.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{item.pacienteNome}</div>
                  <div className="text-[11px] text-ink-500">
                    {item.convenioNome} · {(item.diasPreferencia || []).map((d) => diasLabelCurto[d]).join(", ")} · {item.dataInicial?.split("-").reverse().join("/")} a {item.dataFinal?.split("-").reverse().join("/")}
                  </div>
                </div>
                <button onClick={() => onAgendar(item)} className="flex items-center gap-1 text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg focus-ring shrink-0">
                  <CalendarPlus size={12} /> Agendar
                </button>
                <button onClick={() => marcarAtendido(item.id)} className="text-[11px] font-semibold text-ink-500 hover:text-ink-900 px-2 py-1.5 rounded-lg focus-ring shrink-0">Atendido</button>
                <button onClick={() => remover(item.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {aba === "formulario" && (
          <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2 shrink-0">
            <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
              {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        )}
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
function Field({ label, disabled, ...props }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <input {...props} disabled={disabled} value={props.value ?? ""} onChange={(e) => props.onChange?.(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring disabled:bg-gray-50 disabled:text-ink-500" />
    </label>
  );
}
function SelectField({ label, value, onChange, options, labels, placeholder }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
        <option value="">{placeholder || "Selecione"}</option>
        {options.map((opt) => (<option key={opt} value={opt}>{labels ? labels[opt] : opt}</option>))}
      </select>
    </label>
  );
}
