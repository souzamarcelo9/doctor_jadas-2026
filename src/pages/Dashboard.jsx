import { useEffect, useMemo, useState } from "react";
import { Timestamp, collection, query, getDocs } from "firebase/firestore";
import Topbar from "../components/Topbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import { CalendarClock, MessageCircleMore, Stethoscope, FileCheck2, Loader2 } from "lucide-react";
import { db } from "../firebase";
import { useTenant } from "../context/TenantContext";
import { useFirestoreQuery, where } from "../lib/firestore";

const statusLabel = { agendado: "Agendado", confirmado: "Confirmado", presente: "Presente", atendendo: "Atendendo", faltou: "Faltou", cancelado: "Cancelado" };
const statusColor = { agendado: "#3b82f6", confirmado: "#f59e0b", presente: "#a855f7", atendendo: "#178a8c", faltou: "#ef4444", cancelado: "#94a3b8" };
const nomesMes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function inicioFimDia(d = new Date()) {
  const ini = new Date(d); ini.setHours(0, 0, 0, 0);
  const fim = new Date(d); fim.setHours(23, 59, 59, 999);
  return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
}
function inicioFimMes(offsetMeses = 0) {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth() + offsetMeses, 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + offsetMeses + 1, 1);
  return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
}

export default function Dashboard() {
  const { clinicaId, profissionalId } = useTenant();
  const [inicioHoje, fimHoje] = useMemo(() => inicioFimDia(), []);
  const [inicioMes, fimMes] = useMemo(() => inicioFimMes(0), []);

  const { data: agendamentosHoje, loading: loadingHoje } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("profissionalId", "==", profissionalId), where("dataHora", ">=", inicioHoje), where("dataHora", "<", fimHoje)],
    [profissionalId, inicioHoje, fimHoje]
  );

  const { data: agendamentosMes } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("dataHora", ">=", inicioMes), where("dataHora", "<", fimMes)],
    [inicioMes, fimMes]
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

  const semestre = useSemestreAtendimentos(clinicaId);

  const confirmadasHoje = agendamentosHoje.filter((a) => a.status === "confirmado" || a.status === "presente").length;

  const agendaPorStatus = useMemo(() => {
    const contagem = {};
    agendamentosMes.forEach((a) => { contagem[a.status] = (contagem[a.status] || 0) + 1; });
    return Object.entries(contagem)
      .filter(([status]) => status !== "livre")
      .map(([status, value]) => ({ name: statusLabel[status] || status, value, color: statusColor[status] || "#c8dedd" }));
  }, [agendamentosMes]);

  const kpis = [
    { label: "Consultas hoje (você)", value: loadingHoje ? "…" : agendamentosHoje.length, icon: CalendarClock, tone: "bg-brand-50 text-brand-600" },
    { label: "Confirmadas via WhatsApp", value: loadingHoje ? "…" : confirmadasHoje, icon: MessageCircleMore, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Atendimentos finalizados no mês", value: loadingAtend ? "…" : atendimentosMes.length, icon: Stethoscope, tone: "bg-amber-50 text-amber-600" },
    { label: "NFS-e emitidas no mês", value: notasMes.length, icon: FileCheck2, tone: "bg-indigo-50 text-indigo-600" },
  ];

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

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-display font-semibold text-ink-900">Agenda por status — este mês</span>
                </div>
                {agendaPorStatus.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-xs text-ink-500">Sem agendamentos registrados este mês ainda.</div>
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
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-display font-semibold text-ink-900">Atendimentos finalizados por mês</span>
                </div>
                {semestre.loading ? (
                  <div className="h-[260px] flex items-center justify-center text-xs text-ink-500"><Loader2 size={16} className="animate-spin" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={semestre.data} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="total" fill="#178a8c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
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
            const [ini, fim] = inicioFimMes(offset);
            const q = query(collection(db, `clinicas/${clinicaId}/atendimentos`), where("status", "==", "finalizado"), where("dataHora", ">=", ini), where("dataHora", "<", fim));
            const snap = await getDocs(q);
            const d = new Date(); d.setMonth(d.getMonth() + offset);
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
