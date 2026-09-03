import { useState } from "react";
import { X, Ban, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useFirestoreQuery, where, criarDocumento, excluirDocumento } from "../../lib/firestore";
import { diasSemanaChave, paraISO } from "../../lib/agendaSlots";

const diasLabel = { segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira", quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado", domingo: "Domingo" };
const diasLabelCurto = { segunda: "Seg", terca: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sabado: "Sáb", domingo: "Dom" };
const diasUteis = ["segunda", "terca", "quarta", "quinta", "sexta"];
const periodos = [{ chave: "manha", label: "Manhã" }, { chave: "tarde", label: "Tarde" }, { chave: "noite", label: "Noite" }];

function hojeISO() { return paraISO(new Date()); }
function somarDias(iso, n) { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return paraISO(d); }
function formularioVazio() {
  return { diasSemana: diasUteis, dataInicial: hojeISO(), dataFinal: somarDias(hojeISO(), 7), periodos: ["manha", "tarde", "noite"], motivo: "" };
}

export default function AlteracaoEmBlocoModal({ clinicaId, profissionalId, nomeMedico, onClose, abaInicial = "bloquear" }) {
  const [aba, setAba] = useState(abaInicial);
  const [form, setForm] = useState(formularioVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const { data: bloqueios, loading } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/bloqueiosAgenda` : null,
    [where("profissionalId", "==", profissionalId)],
    [profissionalId]
  );
  const bloqueiosOrdenados = [...bloqueios].sort((a, b) => (a.dataInicial || "").localeCompare(b.dataInicial || ""));

  function alternarDia(dia) {
    setForm((f) => ({ ...f, diasSemana: f.diasSemana.includes(dia) ? f.diasSemana.filter((d) => d !== dia) : [...f.diasSemana, dia] }));
  }
  function alternarPeriodo(chave) {
    setForm((f) => ({ ...f, periodos: f.periodos.includes(chave) ? f.periodos.filter((p) => p !== chave) : [...f.periodos, chave] }));
  }

  async function bloquear(e) {
    e.preventDefault();
    setErro("");
    if (form.diasSemana.length === 0) { setErro("Selecione ao menos um dia da semana."); return; }
    if (form.periodos.length === 0) { setErro("Selecione ao menos um período."); return; }
    if (form.dataFinal < form.dataInicial) { setErro("A data final não pode ser antes da data inicial."); return; }
    setSalvando(true);
    try {
      await criarDocumento(`clinicas/${clinicaId}/bloqueiosAgenda`, {
        profissionalId, nomeMedico,
        diasSemana: form.diasSemana,
        dataInicial: form.dataInicial,
        dataFinal: form.dataFinal,
        periodos: form.periodos,
        motivo: form.motivo.trim() || null,
      });
      setForm(formularioVazio());
      setAba("ativos");
    } catch (err) {
      console.error("Erro ao criar bloqueio:", err);
      setErro(err.message || "Não foi possível bloquear os horários. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function desbloquear(id) {
    await excluirDocumento(`clinicas/${clinicaId}/bloqueiosAgenda`, id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><Ban size={18} /> Alteração em Bloco</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="flex border-b border-black/5 shrink-0">
          <TabBtn active={aba === "bloquear"} onClick={() => setAba("bloquear")}>Bloquear horários</TabBtn>
          <TabBtn active={aba === "ativos"} onClick={() => setAba("ativos")}>Bloqueios ativos {bloqueiosOrdenados.length > 0 && `(${bloqueiosOrdenados.length})`}</TabBtn>
        </div>

        {aba === "bloquear" ? (
          <form onSubmit={bloquear} className="overflow-y-auto p-5 space-y-4">
            <p className="text-xs text-ink-500">
              Bloqueia esses horários pra novos agendamentos (ex: férias, congresso). Consultas já marcadas dentro do período não são canceladas — só fica impedido marcar horário novo ali.
            </p>

            <div className="space-y-1.5">
              <span className="text-xs text-ink-500 font-medium">Dias da semana</span>
              <div className="flex flex-wrap gap-3">
                {diasSemanaChave.map((dia) => (
                  <label key={dia} className="flex items-center gap-1.5 text-xs text-ink-700">
                    <input type="checkbox" checked={form.diasSemana.includes(dia)} onChange={() => alternarDia(dia)} className="rounded focus-ring" />
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

            <Field label="Motivo (opcional)" value={form.motivo} onChange={(v) => setForm({ ...form, motivo: v })} placeholder="Ex: Férias, congresso…" />

            {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
              <button type="submit" disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Bloquear horários
              </button>
            </div>
          </form>
        ) : (
          <div className="overflow-y-auto p-5 space-y-2">
            {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
            {!loading && bloqueiosOrdenados.length === 0 && <p className="text-xs text-ink-500 text-center py-6">Nenhum horário bloqueado no momento.</p>}
            {bloqueiosOrdenados.map((b) => (
              <div key={b.id} className="card p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Ban size={14} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900">{b.motivo || "Sem motivo informado"}</div>
                  <div className="text-[11px] text-ink-500">
                    {b.dataInicial?.split("-").reverse().join("/")} a {b.dataFinal?.split("-").reverse().join("/")} · {(b.diasSemana || []).map((d) => diasLabelCurto[d]).join(", ")} · {(b.periodos || []).map((p) => periodos.find((pp) => pp.chave === p)?.label).join(", ")}
                  </div>
                </div>
                <button onClick={() => desbloquear(b.id)} className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg focus-ring shrink-0">
                  <Trash2 size={12} /> Desbloquear
                </button>
              </div>
            ))}
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
function Field({ label, ...props }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <input {...props} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}
