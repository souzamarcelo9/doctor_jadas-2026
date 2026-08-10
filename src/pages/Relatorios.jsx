import { useEffect, useMemo, useState } from "react";
import { collection, query, getDocs, Timestamp } from "firebase/firestore";
import Topbar from "../components/Topbar";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Target, Star, Mail, TrendingUp, Loader2 } from "lucide-react";
import { db } from "../firebase";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, useFirestoreDoc, where } from "../lib/firestore";

const cores = ["#178a8c", "#3fc4c0", "#f59e0b", "#94a3b8", "#a855f7", "#0ea5b7"];

function inicioFimMes() {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
}

export default function Relatorios() {
  const { clinicaId } = useTenant();
  const { data: clinica } = useFirestoreDoc("clinicas", clinicaId);
  const { data: contasReceber, loading: loadingContas, error: erroContas } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/contasReceber` : null, "vencimento", "asc");
  const { data: avaliacoes } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/avaliacoes` : null, "criadoEm", "desc");
  const realizadoMes = useAtendimentosDoMes(clinicaId);

  const faturamentoPorConvenio = useMemo(() => {
    const contagem = {};
    contasReceber.filter((c) => c.status === "pago").forEach((c) => {
      const chave = c.convenioId || "Particular";
      contagem[chave] = (contagem[chave] || 0) + (Number(c.valor) || 0);
    });
    return Object.entries(contagem).map(([name, value]) => ({ name, value }));
  }, [contasReceber]);

  const meta = clinica?.configuracoes?.metaAtendimentoMensal || 100;
  const pct = Math.min(100, Math.round((realizadoMes / meta) * 100));
  const notaMedia = avaliacoes.length ? (avaliacoes.reduce((a, b) => a + (b.nota || 0), 0) / avaliacoes.length).toFixed(1) : "—";

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Relatórios" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-brand-600" />
              <span className="text-sm font-display font-semibold text-ink-900">Faturamento por convênio (contas recebidas)</span>
            </div>
            {loadingContas ? (
              <div className="h-[260px] flex items-center justify-center text-ink-500 text-xs gap-2"><Loader2 size={16} className="animate-spin" /></div>
            ) : erroContas?.code === "permission-denied" ? (
              <div className="h-[260px] flex items-center justify-center text-ink-500 text-xs text-center px-6">
                Seu usuário não tem permissão para ver dados financeiros — é preciso papel admin ou financeiro.
              </div>
            ) : faturamentoPorConvenio.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-ink-500 text-xs">Nenhuma conta recebida marcada como paga ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={faturamentoPorConvenio} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {faturamentoPorConvenio.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-brand-600" />
              <span className="text-sm font-display font-semibold text-ink-900">Meta de atendimento</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                  <path d="M18 2.5 a15.5 15.5 0 0 1 0 31 a15.5 15.5 0 0 1 0 -31" fill="none" stroke="#e5eeee" strokeWidth="3.5" />
                  <path d="M18 2.5 a15.5 15.5 0 0 1 0 31 a15.5 15.5 0 0 1 0 -31" fill="none" stroke="#178a8c" strokeWidth="3.5" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-display font-bold text-ink-900">{pct}%</span>
                </div>
              </div>
              <p className="text-xs text-ink-500 mt-3 text-center">{realizadoMes} de {meta} atendimentos no mês (clínica toda)</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              <span className="text-sm font-display font-semibold text-ink-900">Avaliação do paciente</span>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Média {notaMedia}</span>
            </div>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
              <Mail size={14} /> Enviar pesquisa por e-mail
            </button>
          </div>
          {avaliacoes.length === 0 ? (
            <p className="text-xs text-ink-500">Nenhuma avaliação registrada ainda.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {avaliacoes.slice(0, 4).map((a) => (
                <div key={a.id} className="bg-brand-50/50 rounded-lg p-3">
                  <div className="text-xs text-ink-700">{a.criterio}</div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-lg font-display font-bold text-ink-900">{a.nota}</span>
                    <Star size={13} className="text-amber-400 fill-amber-400" />
                  </div>
                  <div className="h-1 bg-black/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${(a.nota / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function useAtendimentosDoMes(clinicaId) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!clinicaId) return;
      const [ini, fim] = inicioFimMes();
      const q = query(collection(db, `clinicas/${clinicaId}/atendimentos`), where("status", "==", "finalizado"), where("dataHora", ">=", ini), where("dataHora", "<", fim));
      const snap = await getDocs(q);
      if (!cancelado) setTotal(snap.size);
    }
    carregar();
    return () => { cancelado = true; };
  }, [clinicaId]);
  return total;
}
