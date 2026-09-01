import { useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { X, Search, Loader2, CalendarPlus } from "lucide-react";
import { useFirestoreQuery, where } from "../../lib/firestore";
import { diasSemanaChave, gerarSlots, periodoDoHorario, paraISO } from "../../lib/agendaSlots";

const diasLabel = { segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira", quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado", domingo: "Domingo" };
const diasUteis = ["segunda", "terca", "quarta", "quinta", "sexta"];
const periodos = [{ chave: "manha", label: "Manhã" }, { chave: "tarde", label: "Tarde" }, { chave: "noite", label: "Noite" }];

function hojeISO() { return paraISO(new Date()); }
function somarDias(iso, n) { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return paraISO(d); }

export default function BuscaHorariosModal({ clinicaId, profissionalId, membro, clinicaNome, onClose, onAgendar }) {
  const [diasSelecionados, setDiasSelecionados] = useState(diasUteis);
  const [dataInicial, setDataInicial] = useState(hojeISO());
  const [dataFinal, setDataFinal] = useState(somarDias(hojeISO(), 14));
  const [periodosSelecionados, setPeriodosSelecionados] = useState(["manha", "tarde", "noite"]);
  const [pesquisado, setPesquisado] = useState(false);

  const [inicioRange, fimRange] = useMemo(() => {
    const ini = new Date(`${dataInicial}T00:00:00`);
    const fim = new Date(`${dataFinal}T23:59:59`);
    return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
  }, [dataInicial, dataFinal]);

  const { data: agendamentos, loading } = useFirestoreQuery(
    pesquisado && clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("profissionalId", "==", profissionalId), where("dataHora", ">=", inicioRange), where("dataHora", "<", fimRange)],
    [profissionalId, inicioRange, fimRange, pesquisado]
  );

  const resultados = useMemo(() => {
    if (!pesquisado) return [];
    const ocupados = new Set(agendamentos.map((a) => {
      const d = a.dataHora?.toDate?.();
      return d ? `${paraISO(d)}_${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;
    }));

    const linhas = [];
    let cursor = dataInicial;
    let protecaoLoop = 0;
    while (cursor <= dataFinal && protecaoLoop < 400) {
      protecaoLoop += 1;
      const diaSemana = diasSemanaChave[new Date(`${cursor}T00:00:00`).getDay()];
      if (diasSelecionados.includes(diaSemana)) {
        const horarioDia = membro?.horariosTrabalho?.find((h) => h.dia === diaSemana);
        for (const hora of gerarSlots(horarioDia)) {
          if (!periodosSelecionados.includes(periodoDoHorario(hora))) continue;
          if (ocupados.has(`${cursor}_${hora}`)) continue;
          linhas.push({ data: cursor, diaSemana, hora });
        }
      }
      cursor = somarDias(cursor, 1);
    }
    return linhas.slice(0, 200);
  }, [pesquisado, agendamentos, dataInicial, dataFinal, diasSelecionados, periodosSelecionados, membro]);

  function alternarDia(dia) {
    setDiasSelecionados((atual) => (atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia]));
  }
  function alternarPeriodo(chave) {
    setPeriodosSelecionados((atual) => (atual.includes(chave) ? atual.filter((p) => p !== chave) : [...atual, chave]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-3xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold">Busca avançada de horários</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs text-ink-500 font-medium">Selecionar dias úteis</span>
            <div className="flex flex-wrap gap-3">
              {diasSemanaChave.filter((d) => d !== "domingo" || true).map((dia) => (
                <label key={dia} className="flex items-center gap-1.5 text-xs text-ink-700">
                  <input type="checkbox" checked={diasSelecionados.includes(dia)} onChange={() => alternarDia(dia)} className="rounded focus-ring" />
                  {diasLabel[dia]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Clínica" value={clinicaNome || "Clínica atual"} disabled />
            <Field label="Data inicial" type="date" value={dataInicial} onChange={setDataInicial} />
            <Field label="Data final" type="date" value={dataFinal} onChange={setDataFinal} />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-ink-500 font-medium">Período</span>
            <div className="flex flex-wrap gap-3">
              {periodos.map(({ chave, label }) => (
                <label key={chave} className="flex items-center gap-1.5 text-xs text-ink-700">
                  <input type="checkbox" checked={periodosSelecionados.includes(chave)} onChange={() => alternarPeriodo(chave)} className="rounded focus-ring" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button onClick={() => setPesquisado(true)} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg focus-ring">
            <Search size={14} /> Pesquisar
          </button>

          {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Buscando horários…</div>}

          {pesquisado && !loading && (
            <div className="border border-black/10 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-700 text-white text-left">
                    <th className="px-3 py-2 font-semibold text-[11px]">Dia da semana</th>
                    <th className="px-3 py-2 font-semibold text-[11px]">Data</th>
                    <th className="px-3 py-2 font-semibold text-[11px]">Horário</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {resultados.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-ink-500">Nenhum horário livre encontrado com esses filtros.</td></tr>
                  )}
                  {resultados.map((r) => (
                    <tr key={`${r.data}_${r.hora}`} className="border-t border-black/5">
                      <td className="px-3 py-2 uppercase text-ink-700">{diasLabel[r.diaSemana]}</td>
                      <td className="px-3 py-2 text-ink-700">{r.data.split("-").reverse().join("/")}</td>
                      <td className="px-3 py-2 font-semibold text-brand-700">{r.hora}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => onAgendar(r.data, r.hora)} className="flex items-center gap-1 ml-auto text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg focus-ring">
                          <CalendarPlus size={12} /> Agendar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
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
