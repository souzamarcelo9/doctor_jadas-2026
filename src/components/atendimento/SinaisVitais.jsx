import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Activity, Loader2, Save } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useAuth } from "../../context/AuthContext";
import { useFirestoreCollection, criarDocumento } from "../../lib/firestore";
import { registrarHistoricoClinico } from "../../lib/historicoClinico";
import HistoricoClinicoLista from "./HistoricoClinicoLista";

// Sinais vitais "de verdade" — os parâmetros fisiológicos clássicos
// aferidos numa consulta. Medidas antropométricas (peso, altura, IMC,
// circunferências) ficam na aba separada "Medidas" (Antropometria.jsx) —
// são conceitos clínicos distintos, mesmo que antes estivessem juntos
// aqui. Registros de peso/altura anteriores a essa separação continuam
// salvos na coleção antiga (sinaisVitais) e não migram sozinhos.
const camposNumericos = [
  { key: "paSistolica", label: "PA Sistólica", unit: "mmHg" },
  { key: "paDiastolica", label: "PA Diastólica", unit: "mmHg" },
  { key: "frequenciaCardiaca", label: "Frequência Cardíaca", unit: "bpm" },
  { key: "frequenciaRespiratoria", label: "Frequência Respiratória", unit: "irpm" },
  { key: "temperatura", label: "Temperatura", unit: "°C" },
  { key: "saturacao", label: "Saturação de O₂", unit: "%" },
];

export default function SinaisVitais() {
  const { clinicaId, pacienteId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { user } = useAuth();
  const { data: historico, loading } = useFirestoreCollection(`${pacientePath}/sinaisVitais`, "criadoEm", "asc");
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/sinaisVitais`, {
        ...form,
        atendimentoId,
        profissionalId,
        ativo: true,
      });
      const resumo = camposNumericos
        .filter((f) => form[f.key])
        .map((f) => `${f.label} ${form[f.key]} ${f.unit}`)
        .join(", ");
      if (resumo) {
        registrarHistoricoClinico(clinicaId, pacienteId, {
          tipo: "sinaisVitais", acao: "registrou", resumo,
          uid: user?.uid, nomeUsuario: user?.displayName || user?.email, atendimentoId,
        });
      }
      setForm({});
    } finally {
      setSalvando(false);
    }
  }

  const chartData = historico
    .filter((h) => h.paSistolica || h.paDiastolica)
    .map((h) => ({
      date: h.criadoEm?.toDate ? h.criadoEm.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "",
      sistolica: h.paSistolica ? Number(h.paSistolica) : null,
      diastolica: h.paDiastolica ? Number(h.paDiastolica) : null,
    }));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="card p-4 grid grid-cols-2 gap-x-4 gap-y-4">
          {camposNumericos.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-ink-900 mb-1 block">{f.label}:</label>
              <input
                value={form[f.key] || ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
              />
              <div className="text-[10px] text-ink-500 mt-0.5">{f.unit}</div>
            </div>
          ))}
        </div>
        <button onClick={salvar} disabled={salvando || !firebaseConfigured} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Registrar sinais vitais
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-brand-500" />
          <span className="text-sm font-display font-semibold text-ink-900">Evolução da pressão arterial</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-ink-500 text-xs gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-ink-500 text-xs">Ainda sem registros suficientes para o gráfico.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#5a7683" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5eeee" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" name="Sistólica" dataKey="sistolica" stroke="#178a8c" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" name="Diastólica" dataKey="diastolica" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <HistoricoClinicoLista tipo="sinaisVitais" className="lg:col-span-2" />
    </div>
  );
}
