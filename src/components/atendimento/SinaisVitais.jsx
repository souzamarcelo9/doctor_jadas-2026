import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Loader2, Save } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../../lib/firestore";

const camposNumericos = [
  { key: "sistolica", label: "Sistólica", unit: "mm de mercúrio" },
  { key: "diastolica", label: "Diastólica", unit: "mm de mercúrio" },
  { key: "peso", label: "Peso", unit: "Kg" },
  { key: "altura", label: "Altura", unit: "Metro" },
  { key: "pulso", label: "Pulso", unit: "Minuto" },
  { key: "temperatura", label: "Temperatura", unit: "Celsius" },
  { key: "quadril", label: "Quadril", unit: "Centímetro" },
  { key: "cintura", label: "Cintura", unit: "Centímetro" },
  { key: "abdomen", label: "Abdômen", unit: "Centímetro" },
  { key: "braco", label: "Braço", unit: "Centímetro" },
  { key: "saturacao", label: "Saturação", unit: "%" },
];

export default function SinaisVitais() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: historico, loading } = useFirestoreCollection(`${pacientePath}/sinaisVitais`, "criadoEm", "asc");
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  const peso = parseFloat(form.peso);
  const altura = parseFloat(form.altura);
  const imc = peso && altura ? (peso / (altura * altura)).toFixed(2) : "";

  async function salvar() {
    if (!firebaseConfigured) return;
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/sinaisVitais`, {
        ...form,
        imc: imc ? Number(imc) : null,
        atendimentoId,
        profissionalId,
        ativo: true,
      });
      setForm({});
    } finally {
      setSalvando(false);
    }
  }

  const chartData = historico
    .filter((h) => h.imc)
    .map((h) => ({ date: h.criadoEm?.toDate ? h.criadoEm.toDate().toLocaleDateString("pt-BR", { month: "short" }) : "", imc: h.imc }));

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
          <div>
            <label className="text-xs font-medium text-ink-900 mb-1 block">IMC:</label>
            <input readOnly value={imc} className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 bg-brand-50/60 text-brand-700 font-semibold focus-ring" />
            <div className="text-[10px] text-ink-500 mt-0.5">Kg/m2 (calculado)</div>
          </div>
        </div>
        <button onClick={salvar} disabled={salvando || !firebaseConfigured} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Registrar sinais vitais
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-brand-500" />
          <span className="text-sm font-display font-semibold text-ink-900">Evolução do IMC</span>
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
              <Line type="monotone" dataKey="imc" stroke="#178a8c" strokeWidth={2.5} dot={{ r: 4, fill: "#178a8c" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
