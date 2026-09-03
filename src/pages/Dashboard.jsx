import { useEffect, useMemo, useState } from "react";
import { Timestamp, collection, query, getDocs } from "firebase/firestore";
import Topbar from "../components/Topbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import { CalendarClock, Stethoscope, FileCheck2, Loader2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { db } from "../firebase";
import { useTenant } from "../context/TenantContext";
import { useFirestoreQuery, useFirestoreCollection, useFirestoreDoc, where } from "../lib/firestore";
import { diasSemanaChave, gerarSlots } from "../lib/agendaSlots";

const statusLabel = { agendado: "Agendado", confirmado: "Confirmado", presente: "Presente", atendendo: "Atendendo", faltou: "Faltou", cancelado: "Cancelado" };
const statusColor = { agendado: "#3b82f6", confirmado: "#f59e0b", presente: "#a855f7", atendendo: "#178a8c", faltou: "#ef4444", cancelado: "#94a3b8" };
const nomesMes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PALETA_CONVENIOS = ["#178a8c", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#10b981", "#6366f1", "#ec4899", "#84cc16"];

function inicioFimDia(d = new Date()) {
  const ini = new Date(d); ini.setHours(0, 0, 0, 0);
  const fim = new Date(d); fim.setHours(23, 59, 59, 999);
  return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
}
function inicioFimMes(dataDoMes) {
  const ini = new Date(dataDoMes.getFullYear(), dataDoMes.getMonth(), 1);
  const fim = new Date(dataDoMes.getFullYear(), dataDoMes.getMonth() + 1, 1);
  return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
}
function isoDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function corPorIndice(i) {
  return PALETA_CONVENIOS[i % PALETA_CONVENIOS.length];
}

export default function Dashboard() {
  const { clinicaId, profissionalId } = useTenant();
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date());

  const [inicioHoje, fimHoje] = useMemo(() => inicioFimDia(), []);
  const [inicioMes, fimMes] = useMemo(() => inicioFimMes(mesSelecionado), [mesSelecionado]);
  const mesLabel = `${String(mesSelecionado.getMonth() + 1).padStart(2, "0")}/${mesSelecionado.getFullYear()}`;

  const { data: membro } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/membros` : null, profissionalId);
  const { data: pacientes } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, "nome", "asc");
  const { data: convenios } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/convenios` : null, "nome", "asc");

  const { data: agendamentosHoje, loading: loadingHoje } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("profissionalId", "==", profissionalId), where("dataHora", ">=", inicioHoje), where("dataHora", "<", fimHoje)],
    [profissionalId, inicioHoje, fimHoje]
  );

  // Alimenta tanto o KPI de "atendimentos pendentes" quanto os gráficos de
  // Agenda por Período e Total de Atendimentos por Convênio — clínica toda
  // (não só o profissional logado), pra dar a visão geral do consultório.
  const { data: agendamentosMes, loading: loadingAgendaMes } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("dataHora", ">=", inicioMes), where("dataHora", "<", fimMes)],
    [inicioMes, fimMes]
  );

  const { data: agendamentosFuturos, loading: loadingFuturos } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("profissionalId", "==", profissionalId), where("dataHora", ">=", Timestamp.now())],
    [profissionalId]
  );

  const { data: atendimentosMes, loading: loadingAtend } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/atendimentos` : null,
    [where("status", "==", "finalizado"), where("dataHora", ">=", inicioMes), where("dataHora", "<", fimMes)],
    [inicioMes, fimMes]
  );

  const { data: notasMes } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/notasFiscais` : null,
    [where("criadoEm", ">=", inicioMes), where("criadoEm", "<", fimMes), where("status", "==", "autorizada")],
    [inicioMes, fimMes]
  );

  // Faturamento por convênio soma o que foi lançado no financeiro (ver
  // AgendamentoModal, que cria a conta a receber automaticamente ao
  // vincular um serviço), independente de já ter sido pago — é "quanto foi
  // faturado", não "quanto já entrou no caixa".
  const inicioMesStr = isoDia(new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth(), 1));
  const fimMesStr = isoDia(new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth() + 1, 1));
  const { data: contasMes } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/contasReceber` : null,
    [where("vencimento", ">=", inicioMesStr), where("vencimento", "<", fimMesStr)],
    [inicioMesStr, fimMesStr]
  );

  const semestre = useSemestreAtendimentos(clinicaId);
  const ocupacaoPorSemana = useOcupacaoPorSemana(mesSelecionado, membro?.horariosTrabalho, agendamentosMes);

  const confirmadasHoje = agendamentosHoje.filter((a) => a.status === "confirmado" || a.status === "presente").length;
  const pendentesMes = agendamentosMes.filter((a) => a.status === "agendado" || a.status === "confirmado").length;

  const agendaPorStatus = useMemo(() => {
    const contagem = {};
    agendamentosMes.forEach((a) => { contagem[a.status] = (contagem[a.status] || 0) + 1; });
    return Object.entries(contagem)
      .filter(([status]) => status !== "livre")
      .map(([status, value]) => ({ name: statusLabel[status] || status, value, color: statusColor[status] || "#c8dedd" }));
  }, [agendamentosMes]);

  const atendimentosPorConvenio = useMemo(() => {
    const contagem = {};
    agendamentosMes.forEach((a) => {
      const nome = a.convenioNome || "Particular";
      contagem[nome] = (contagem[nome] || 0) + 1;
    });
    return Object.entries(contagem).map(([name, value], i) => ({ name, value, color: corPorIndice(i) }));
  }, [agendamentosMes]);

  const faturamentoPorConvenio = useMemo(() => {
    const somas = {};
    contasMes.forEach((c) => {
      const nome = convenios.find((cv) => cv.id === c.convenioId)?.nome || "Particular";
      somas[nome] = (somas[nome] || 0) + (Number(c.valor) || 0);
    });
    return Object.entries(somas).map(([name, value], i) => ({ name, value: Math.round(value * 100) / 100, color: corPorIndice(i) }));
  }, [contasMes, convenios]);

  const kpis = [
    { label: "Carteira de pacientes", value: pacientes.length, icon: Users, tone: "bg-sky-50 text-sky-600" },
    { label: "Atendimentos realizados no mês", value: loadingAtend ? "…" : atendimentosMes.length, icon: Stethoscope, tone: "bg-amber-50 text-amber-600" },
    { label: "Atendimentos pendentes no mês", value: loadingAgendaMes ? "…" : pendentesMes, icon: CalendarClock, tone: "bg-brand-50 text-brand-600" },
    { label: "Atendimentos futuros (você)", value: loadingFuturos ? "…" : agendamentosFuturos.length, icon: FileCheck2, tone: "bg-indigo-50 text-indigo-600" },
  ];

  function mudarMes(delta) {
    setMesSelecionado((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Página inicial" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        {!clinicaId && (
          <div className="card p-6 text-center text-sm text-ink-500">
            Nenhuma clínica ativa — verifique seu vínculo em <code className="font-mono text-xs">membros</code> ou configure o Firebase.
          </div>
        )}

        {clinicaId && (
          <>
            <div className="card p-3 flex items-center gap-2 w-fit">
              <button onClick={() => mudarMes(-1)} className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><ChevronLeft size={14} /></button>
              <span className="text-sm font-display font-semibold text-ink-900 px-2 min-w-[90px] text-center">{mesLabel}</span>
              <button onClick={() => mudarMes(1)} className="p-1.5 rounded-lg border border-black/10 text-ink-500 focus-ring"><ChevronRight size={14} /></button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {kpis.map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="card p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-lg font-display font-bold text-ink-900 leading-none">{value}</div>
                    <div className="text-[11px] text-ink-500 mt-1">{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-500 -mt-2">Confirmadas via WhatsApp hoje: <strong>{loadingHoje ? "…" : confirmadasHoje}</strong> · NFS-e emitidas no mês: <strong>{notasMes.length}</strong></p>

            <div className="grid lg:grid-cols-2 gap-4">
              <ChartCard titulo="Total de atendimentos por convênio">
                {atendimentosPorConvenio.length === 0 ? (
                  <SemDados />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={atendimentosPorConvenio} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5a7683" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {atendimentosPorConvenio.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard titulo="Faturamento por convênio (R$)">
                {faturamentoPorConvenio.length === 0 ? (
                  <SemDados texto="Sem valores lançados no financeiro este mês ainda." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={faturamentoPorConvenio} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5a7683" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`R$ ${v}`, "Faturamento"]} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {faturamentoPorConvenio.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard titulo="Agenda por período">
                {agendaPorStatus.length === 0 ? (
                  <SemDados texto="Sem agendamentos registrados este mês ainda." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={agendaPorStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100} paddingAngle={2}>
                        {agendaPorStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard titulo="Ocupação por semana (você)">
                {ocupacaoPorSemana.length === 0 ? (
                  <SemDados texto="Sem horário de trabalho cadastrado para calcular ocupação." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ocupacaoPorSemana} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="semana" tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`, "Ocupação"]} />
                      <Bar dataKey="ocupacao" fill="#178a8c" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard titulo="Atendimentos finalizados por mês" full>
                {semestre.loading ? (
                  <div className="h-[260px] flex items-center justify-center text-xs text-ink-500"><Loader2 size={16} className="animate-spin" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={semestre.data} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="total" fill="#178a8c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ChartCard({ titulo, children, full }) {
  return (
    <div className={`card p-4 ${full ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-display font-semibold text-ink-900">{titulo}</span>
      </div>
      {children}
    </div>
  );
}
function SemDados({ texto = "Sem dados neste período ainda." }) {
  return <div className="h-[260px] flex items-center justify-center text-xs text-ink-500 text-center px-6">{texto}</div>;
}

// Busca, mês a mês (últimos 5), a contagem de atendimentos finalizados — feito
// com getDocs pontual (não onSnapshot) porque são 5 queries avulsas, não
// precisa de tempo real aqui.
function useSemestreAtendimentos(clinicaId) {
  const meses = useMemo(() => Array.from({ length: 5 }, (_, i) => -4 + i), []);
  const [state, setState] = useState({ data: [], loading: true });

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!clinicaId) { setState({ data: [], loading: false }); return; }
      setState((s) => ({ ...s, loading: true }));
      try {
        const resultados = await Promise.all(
          meses.map(async (offset) => {
            const d = new Date(); d.setMonth(d.getMonth() + offset);
            const [ini, fim] = inicioFimMes(d);
            const q = query(collection(db, `clinicas/${clinicaId}/atendimentos`), where("status", "==", "finalizado"), where("dataHora", ">=", ini), where("dataHora", "<", fim));
            const snap = await getDocs(q);
            return { mes: nomesMes[d.getMonth()], total: snap.size };
          })
        );
        if (!cancelado) setState({ data: resultados, loading: false });
      } catch (err) {
        console.error("Erro ao carregar atendimentos por mês:", err);
        if (!cancelado) setState({ data: [], loading: false });
      }
    }
    carregar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  return state;
}

/** Ocupação por semana do mês selecionado: pra cada semana, soma o total de
 * slots possíveis (a partir de `horariosTrabalho` do profissional) e
 * compara com quantos agendamentos (não cancelados) caíram ali. */
function useOcupacaoPorSemana(mesSelecionado, horariosTrabalho, agendamentosMes) {
  return useMemo(() => {
    if (!horariosTrabalho) return [];
    const ano = mesSelecionado.getFullYear();
    const mes = mesSelecionado.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();

    // slots possíveis por dia da semana, calculados uma vez cada (0=domingo)
    const slotsPorDiaSemana = diasSemanaChave.map((chave) => {
      const horario = horariosTrabalho.find((h) => h.dia === chave);
      return gerarSlots(horario).length;
    });

    const semanas = {}; // { "Semana 1": { total: n, ocupados: n } }
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const d = new Date(ano, mes, dia);
      const totalSlotsDia = slotsPorDiaSemana[d.getDay()];
      if (totalSlotsDia === 0) continue; // dia sem expediente não conta pro cálculo
      const semanaIdx = Math.floor((dia - 1) / 7) + 1;
      const chaveSemana = `Semana ${semanaIdx}`;
      if (!semanas[chaveSemana]) semanas[chaveSemana] = { total: 0, ocupados: 0 };
      semanas[chaveSemana].total += totalSlotsDia;
    }

    agendamentosMes.forEach((a) => {
      const d = a.dataHora?.toDate?.();
      if (!d || a.status === "cancelado") return;
      const semanaIdx = Math.floor((d.getDate() - 1) / 7) + 1;
      const chaveSemana = `Semana ${semanaIdx}`;
      if (semanas[chaveSemana]) semanas[chaveSemana].ocupados += 1;
    });

    return Object.entries(semanas).map(([semana, { total, ocupados }]) => ({
      semana,
      ocupacao: total > 0 ? Math.min(100, Math.round((ocupados / total) * 100)) : 0,
    }));
  }, [mesSelecionado, horariosTrabalho, agendamentosMes]);
}
