import { useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import {
  ChevronLeft, ChevronRight, Users, PieChart, XCircle, Clock, Armchair, Lock,
  Stethoscope, UserCheck, CalendarCheck, RefreshCw, Settings2, Loader2,
  CalendarSearch, Users2, Puzzle,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreDoc, useFirestoreCollection } from "../../lib/firestore";
import { useFirestoreQuery, where } from "../../lib/firestore";
import { useNavigate } from "react-router-dom";
import AgendamentoModal from "./AgendamentoModal";
import ListaEsperaModal from "./ListaEsperaModal";
import BuscaHorariosModal from "./BuscaHorariosModal";
import { diasSemanaChave, gerarSlots, paraISO } from "../../lib/agendaSlots";

const situacaoStyle = {
  agendado: { label: "Agendado", rowTone: "bg-blue-50", tag: "bg-blue-100 text-blue-700", icon: CalendarCheck },
  confirmado: { label: "Confirmado", rowTone: "bg-amber-50", tag: "bg-amber-100 text-amber-700", icon: UserCheck },
  presente: { label: "Presente", rowTone: "bg-purple-50", tag: "bg-purple-100 text-purple-700", icon: UserCheck },
  atendendo: { label: "Atendendo", rowTone: "bg-amber-50", tag: "bg-amber-100 text-amber-700", icon: Stethoscope },
  faltou: { label: "Faltou", rowTone: "bg-violet-50/70", tag: "bg-violet-100 text-violet-700", icon: XCircle },
  cancelado: { label: "Cancelado", rowTone: "bg-gray-50", tag: "bg-gray-100 text-gray-500", icon: XCircle },
  livre: { label: "Livre", rowTone: "", tag: "bg-gray-100 text-gray-500", icon: Lock },
};

function hojeISO() {
  return paraISO(new Date());
}

export default function AgendaGrid({ onOpenHorarios }) {
  const { clinicaId, profissionalId } = useTenant();
  const navigate = useNavigate();
  const [dateISO, setDateISO] = useState(hojeISO());
  const [modalSlot, setModalSlot] = useState(null);
  const [modalExtras, setModalExtras] = useState({});
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [showBusca, setShowBusca] = useState(false);

  const { data: membro, loading: loadingMembro } = useFirestoreDoc(`clinicas/${clinicaId}/membros`, profissionalId);
  const { data: pacientes } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, "nome", "asc");

  const [inicioDia, fimDia] = useMemo(() => {
    const d = new Date(`${dateISO}T00:00:00`);
    const ini = new Date(d); ini.setHours(0, 0, 0, 0);
    const fim = new Date(d); fim.setHours(23, 59, 59, 999);
    return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
  }, [dateISO]);

  const { data: agendamentos, loading: loadingAgenda } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("profissionalId", "==", profissionalId), where("dataHora", ">=", inicioDia), where("dataHora", "<", fimDia)],
    [profissionalId, inicioDia, fimDia]
  );

  const diaSemana = diasSemanaChave[new Date(`${dateISO}T00:00:00`).getDay()];
  const horarioDoDia = membro?.horariosTrabalho?.find((h) => h.dia === diaSemana);
  const slots = useMemo(() => gerarSlots(horarioDoDia), [horarioDoDia]);

  const linhas = useMemo(() => {
    const porHora = slots.map((hora) => {
      const ag = agendamentos.find((a) => {
        const d = a.dataHora?.toDate?.();
        if (!d) return false;
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` === hora;
      });
      return { hora, agendamento: ag };
    });
    // Encaixes: agendamentos cujo horário não bate com nenhum slot padrão do
    // dia (ex: marcado às 09:15 num grid de 30 em 30 min) — mesclados aqui
    // em vez de exigirem uma segunda tabela.
    const encaixes = agendamentos
      .filter((a) => {
        const d = a.dataHora?.toDate?.();
        if (!d) return false;
        const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return !slots.includes(hora);
      })
      .map((a) => {
        const d = a.dataHora.toDate();
        return { hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, agendamento: a };
      });
    return [...porHora, ...encaixes].sort((a, b) => a.hora.localeCompare(b.hora));
  }, [slots, agendamentos]);

  const ocupados = linhas.filter((l) => l.agendamento).length;
  const faltas = agendamentos.filter((a) => a.status === "faltou").length;
  const presentes = agendamentos.filter((a) => a.status === "presente").length;
  const ultimoOcupado = [...linhas].reverse().find((l) => l.agendamento);

  const kpis = [
    { icon: Users, label: "Paciente(s)", value: ocupados, tone: "bg-sky-50 text-sky-600" },
    { icon: PieChart, label: "Ocupação", value: slots.length ? `${Math.round((ocupados / slots.length) * 100)}%` : "—", tone: "bg-amber-50 text-amber-600" },
    { icon: XCircle, label: "Faltas", value: faltas, tone: "bg-rose-50 text-rose-600" },
    { icon: Clock, label: "Previsão de saída", value: ultimoOcupado?.hora || "—", tone: "bg-brand-50 text-brand-600" },
    { icon: Armchair, label: "Sala de espera", value: presentes, tone: "bg-emerald-50 text-emerald-600" },
  ];

  function horaArredondada() {
    const d = new Date();
    const min = d.getMinutes() < 30 ? 30 : 0;
    if (min === 0) d.setHours(d.getHours() + 1);
    d.setMinutes(min);
    return `${String(d.getHours()).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  function abrirNovoAgendamento({ data = dateISO, hora = horaArredondada(), ...extras } = {}) {
    if (data !== dateISO) setDateISO(data);
    setModalExtras(extras);
    setModalSlot({ hora, agendamento: null });
  }

  function mudarDia(delta) {
    const d = new Date(`${dateISO}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDateISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-display font-semibold text-ink-900">Agenda</div>
        <button onClick={onOpenHorarios} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 border border-brand-200 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg focus-ring">
          <Settings2 size={13} /> Cadastrar horários
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="card p-3.5 flex flex-col items-center text-center gap-1.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><Icon size={17} /></div>
            <div className="text-base font-display font-bold text-ink-900 leading-none">{value}</div>
            <div className="text-[10px] text-ink-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <button onClick={() => mudarDia(-1)} className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><ChevronLeft size={14} /></button>
        <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
        <button onClick={() => mudarDia(1)} className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><ChevronRight size={14} /></button>

        <button onClick={() => abrirNovoAgendamento({ forcarEncaixe: true })} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-700 bg-white hover:bg-gray-50 border border-black/10 px-3 py-1.5 rounded-lg focus-ring">
          <Puzzle size={13} /> Encaixe
        </button>
        <button onClick={() => setShowListaEspera(true)} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-700 bg-white hover:bg-gray-50 border border-black/10 px-3 py-1.5 rounded-lg focus-ring">
          <Users2 size={13} /> Lista de Espera
        </button>
        <button onClick={() => setShowBusca(true)} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-700 bg-white hover:bg-gray-50 border border-black/10 px-3 py-1.5 rounded-lg focus-ring">
          <CalendarSearch size={13} /> Localizar horários
        </button>

        <div className="flex-1" />
        <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-lg focus-ring">
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      <div className="card overflow-hidden">
        {(loadingMembro || loadingAgenda) && (
          <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando agenda…</div>
        )}
        {!loadingMembro && !horarioDoDia && (
          <div className="p-8 text-center text-sm text-ink-500">
            Sem horário de trabalho cadastrado para {diaSemana}. Configure em "Cadastrar horários".
          </div>
        )}
        {!loadingMembro && horarioDoDia && (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-700 text-white text-left">
                <Th>Hora</Th><Th>Nome</Th><Th>Convênio</Th><Th>Tipo atendimento</Th><Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ hora, agendamento }) => {
                const s = situacaoStyle[agendamento?.status || "livre"];
                const Icon = s.icon;
                return (
                  <tr key={hora} onClick={() => { setModalExtras({}); setModalSlot({ hora, agendamento }); }} className={`border-t border-black/5 ${s.rowTone} hover:bg-brand-50/50 cursor-pointer transition-colors`}>
                    <Td className="font-semibold text-brand-700 whitespace-nowrap">{hora}</Td>
                    <Td className="font-medium text-ink-900">{agendamento?.pacienteNome || ""}</Td>
                    <Td>{agendamento?.convenioNome || ""}</Td>
                    <Td>{agendamento?.tipoAtendimento || ""} {agendamento?.encaixe && <span className="ml-1 text-[9px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full align-middle">Encaixe</span>}</Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.tag}`}>
                        <Icon size={11} /> {s.label}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalSlot && (
        <AgendamentoModal
          slot={modalSlot}
          dateISO={dateISO}
          clinicaId={clinicaId}
          profissionalId={profissionalId}
          pacientes={pacientes}
          onClose={() => { setModalSlot(null); setModalExtras({}); }}
          onIrParaAtendimento={(pacienteId) => navigate(`/atendimento/${pacienteId}`)}
          {...modalExtras}
        />
      )}

      {showListaEspera && (
        <ListaEsperaModal
          clinicaId={clinicaId}
          profissionalId={profissionalId}
          nomeMedico={membro?.nome || ""}
          pacientes={pacientes}
          onClose={() => setShowListaEspera(false)}
          onAgendar={(item) => {
            setShowListaEspera(false);
            abrirNovoAgendamento({
              pacientePreSelecionado: item,
              listaEsperaId: item.id,
            });
          }}
        />
      )}

      {showBusca && (
        <BuscaHorariosModal
          clinicaId={clinicaId}
          profissionalId={profissionalId}
          membro={membro}
          onClose={() => setShowBusca(false)}
          onAgendar={(data, hora) => {
            setShowBusca(false);
            abrirNovoAgendamento({ data, hora });
          }}
        />
      )}
    </div>
  );
}

function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px] tracking-wide whitespace-nowrap">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2.5 text-ink-700 ${className}`}>{children}</td>; }
