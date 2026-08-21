import { useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import {
  ChevronLeft, ChevronRight, Users, PieChart, XCircle, Clock, Armchair, Lock,
  Stethoscope, UserCheck, CalendarCheck, RefreshCw, Settings2, Loader2, X, Search,
} from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreDoc, useFirestoreCollection } from "../../lib/firestore";
import { useFirestoreQuery, where, criarDocumento, atualizarDocumento } from "../../lib/firestore";
import { useNavigate } from "react-router-dom";

const diasSemanaChave = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function minutos(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function paraHHMM(min) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }

function gerarSlots(horarioDia) {
  if (!horarioDia || !horarioDia.ativo) return [];
  const inicio = minutos(horarioDia.primeiraConsulta);
  const fim = minutos(horarioDia.ultimaConsulta);
  const passo = minutos(horarioDia.tempoConsulta || "00:30");
  const intInicio = horarioDia.inicioIntervalo && horarioDia.inicioIntervalo !== "--:--" ? minutos(horarioDia.inicioIntervalo) : null;
  const intFim = horarioDia.fimIntervalo && horarioDia.fimIntervalo !== "--:--" ? minutos(horarioDia.fimIntervalo) : null;
  const slots = [];
  for (let t = inicio; t < fim; t += passo || 30) {
    if (intInicio !== null && t >= intInicio && t < intFim) continue;
    slots.push(paraHHMM(t));
  }
  return slots;
}

export default function AgendaGrid({ onOpenHorarios }) {
  const { clinicaId, profissionalId } = useTenant();
  const navigate = useNavigate();
  const [dateISO, setDateISO] = useState(hojeISO());
  const [modalSlot, setModalSlot] = useState(null);

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

  const linhas = slots.map((hora) => {
    const ag = agendamentos.find((a) => {
      const d = a.dataHora?.toDate?.();
      if (!d) return false;
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` === hora;
    });
    return { hora, agendamento: ag };
  });

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
                  <tr key={hora} onClick={() => setModalSlot({ hora, agendamento })} className={`border-t border-black/5 ${s.rowTone} hover:bg-brand-50/50 cursor-pointer transition-colors`}>
                    <Td className="font-semibold text-brand-700 whitespace-nowrap">{hora}</Td>
                    <Td className="font-medium text-ink-900">{agendamento?.pacienteNome || ""}</Td>
                    <Td>{agendamento?.convenioNome || ""}</Td>
                    <Td>{agendamento?.tipoAtendimento || ""}</Td>
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
        <SlotModal
          slot={modalSlot}
          dateISO={dateISO}
          clinicaId={clinicaId}
          profissionalId={profissionalId}
          pacientes={pacientes}
          onClose={() => setModalSlot(null)}
          onIrParaAtendimento={(pacienteId) => navigate(`/atendimento/${pacienteId}`)}
        />
      )}
    </div>
  );
}

function SlotModal({ slot, dateISO, clinicaId, profissionalId, pacientes, onClose, onIrParaAtendimento }) {
  const [busca, setBusca] = useState("");
  const [pacienteSel, setPacienteSel] = useState(null);
  const [tipo, setTipo] = useState("CONSULTA");
  const [salvando, setSalvando] = useState(false);

  const filtrados = pacientes.filter((p) => p.nome?.toLowerCase().includes(busca.toLowerCase()));

  async function agendar() {
    if (!pacienteSel) return;
    setSalvando(true);
    try {
      const [h, m] = slot.hora.split(":").map(Number);
      const d = new Date(`${dateISO}T00:00:00`);
      d.setHours(h, m, 0, 0);
      await criarDocumento(`clinicas/${clinicaId}/agendamentos`, {
        profissionalId,
        pacienteId: pacienteSel.id,
        pacienteNome: pacienteSel.nome,
        pacienteTelefone: pacienteSel.telefone || null,
        convenioId: pacienteSel.convenioId || null,
        convenioNome: pacienteSel.convenioId || "Particular",
        dataHora: Timestamp.fromDate(d),
        duracaoMinutos: 30,
        status: "agendado",
        tipoAtendimento: tipo,
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(novoStatus) {
    await atualizarDocumento(`clinicas/${clinicaId}/agendamentos`, slot.agendamento.id, { status: novoStatus });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold">{slot.hora} · {dateISO.split("-").reverse().join("/")}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        {!slot.agendamento ? (
          <div className="p-5 space-y-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input value={busca} onChange={(e) => { setBusca(e.target.value); setPacienteSel(null); }} placeholder="Buscar paciente…" className="w-full text-sm border border-black/10 rounded-lg pl-8 pr-3 py-2 focus-ring" />
            </div>
            {busca && !pacienteSel && (
              <div className="max-h-40 overflow-y-auto border border-black/10 rounded-lg divide-y divide-black/5">
                {filtrados.length === 0 && <p className="text-xs text-ink-500 p-3">Nenhum paciente encontrado.</p>}
                {filtrados.map((p) => (
                  <button key={p.id} onClick={() => { setPacienteSel(p); setBusca(p.nome); }} className="w-full text-left text-xs px-3 py-2 hover:bg-brand-50 focus-ring">
                    {p.nome}
                  </button>
                ))}
              </div>
            )}
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Tipo de atendimento</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                <option>CONSULTA</option><option>RETORNO</option><option>PROCEDIMENTO</option>
              </select>
            </label>
            <button onClick={agendar} disabled={!pacienteSel || salvando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {salvando && <Loader2 size={15} className="animate-spin" />} Agendar
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-900">{slot.agendamento.pacienteNome}</div>
            <div className="text-xs text-ink-500">{slot.agendamento.tipoAtendimento} · {slot.agendamento.convenioNome}</div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {["confirmado", "presente", "atendendo", "faltou", "cancelado"].map((s) => (
                <button key={s} onClick={() => mudarStatus(s)} className="text-xs font-semibold border border-black/10 hover:bg-brand-50 rounded-lg py-2 capitalize focus-ring">
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => onIrParaAtendimento(slot.agendamento.pacienteId)} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring mt-2">
              Ir para o atendimento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px] tracking-wide whitespace-nowrap">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2.5 text-ink-700 ${className}`}>{children}</td>; }
