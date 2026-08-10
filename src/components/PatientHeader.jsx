import { AlertTriangle, FileHeart, Sparkles, Loader2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc } from "../lib/firestore";

export default function PatientHeader({ onOpenPercepcoes }) {
  const { clinicaId, pacienteId } = useTenant();
  const { data: paciente, loading } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, pacienteId);

  if (loading || !paciente) {
    return (
      <div className="card px-4 lg:px-6 py-3 flex items-center gap-2 text-sm text-ink-500">
        <Loader2 size={15} className="animate-spin" /> Carregando paciente…
      </div>
    );
  }

  const idade = paciente.nascimento ? calcularIdade(paciente.nascimento) : "—";

  return (
    <div className="card px-4 lg:px-6 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center text-white font-display font-semibold">
          {paciente.nome?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div>
          <div className="font-display font-semibold text-ink-900 text-sm">{paciente.nome}</div>
          <div className="text-xs text-ink-500">{idade} anos</div>
        </div>
      </div>

      <Field label="Nascimento" value={formatarData(paciente.nascimento)} />
      <Field label="Sexo" value={paciente.sexo} />
      <Field label="CPF" value={paciente.cpf} />
      <Field label="Convênio" value={paciente.convenioId || "Particular"} />

      <div className="flex items-center gap-1 text-amber-500 text-xs font-medium">
        <AlertTriangle size={16} /> Alergias
      </div>
      <div className="flex items-center gap-1 text-brand-500 text-xs font-medium">
        <FileHeart size={16} /> Diagnósticos
      </div>

      <button
        onClick={onOpenPercepcoes}
        className="ml-auto flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 transition-colors text-white text-xs font-semibold px-4 py-2 rounded-full focus-ring"
      >
        <Sparkles size={14} /> Percepções da IA
      </button>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="text-xs">
      <div className="text-ink-500">{label}:</div>
      <div className="font-semibold text-brand-700">{value || "—"}</div>
    </div>
  );
}

function calcularIdade(nascimento) {
  const d = typeof nascimento === "string" ? new Date(nascimento) : nascimento?.toDate?.();
  if (!d || isNaN(d)) return "—";
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function formatarData(nascimento) {
  const d = typeof nascimento === "string" ? new Date(nascimento + "T00:00:00") : nascimento?.toDate?.();
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR");
}
