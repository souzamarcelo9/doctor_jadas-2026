import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import PatientHeader from "../components/PatientHeader";
import Tabs from "../components/Tabs";
import AIPercepcoesPanel from "../components/AIPercepcoesPanel";
import QueixaPaciente from "../components/atendimento/QueixaPaciente";
import Historico from "../components/atendimento/Historico";
import ExameFisico from "../components/atendimento/ExameFisico";
import Problemas from "../components/atendimento/Problemas";
import Alergias from "../components/atendimento/Alergias";
import SinaisVitais from "../components/atendimento/SinaisVitais";
import HistExames from "../components/atendimento/HistExames";
import Imagens from "../components/atendimento/Imagens";
import Conduta from "../components/atendimento/Conduta";
import Prescricoes from "../components/atendimento/Prescricoes";
import Encaminhamento from "../components/atendimento/Encaminhamento";
import Formularios from "../components/atendimento/Formularios";
import { useTenant } from "../context/TenantContext";
import { enviarAvaliacaoPaciente } from "../lib/avaliacoes";
import { Trash2, CheckCircle2, Loader2, Star } from "lucide-react";

const tabs = [
  "Queixa Paciente", "Histórico", "Exame físico", "Problemas", "Alergias",
  "Hist. Exames", "Sinais Vitais", "Imagens", "Formulários", "Encaminhamento",
  "Conduta", "Prescrições",
];

export default function Atendimento() {
  const { pacienteId: pacienteIdRota } = useParams();
  const { pacienteId, selecionarPaciente, loadingAtendimento, finalizarAtendimento, firebaseConfigured, clinicaId } = useTenant();
  const navigate = useNavigate();
  const [active, setActive] = useState("Queixa Paciente");
  const [seconds, setSeconds] = useState(0);
  const [percOpen, setPercOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [enviarAvaliacao, setEnviarAvaliacao] = useState(true);

  useEffect(() => {
    if (pacienteIdRota && pacienteIdRota !== pacienteId) {
      selecionarPaciente(pacienteIdRota);
    }
  }, [pacienteIdRota, pacienteId, selecionarPaciente]);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  async function handleFinalizar() {
    setFinalizando(true);
    try {
      await finalizarAtendimento();
      if (enviarAvaliacao) {
        // Best-effort: se o e-mail de avaliação falhar (ex: Resend não
        // configurado ainda), não impede o profissional de fechar o
        // atendimento — só avisamos, sem travar a navegação.
        try {
          await enviarAvaliacaoPaciente(clinicaId, pacienteId);
        } catch (err) {
          // Best-effort: não bloqueia a navegação por causa disso (ex:
          // Resend ainda não configurado) — só registra no console.
          console.error("Erro ao enviar avaliação:", err);
        }
      }
      navigate("/pacientes");
    } finally {
      setFinalizando(false);
    }
  }

  function renderTab() {
    switch (active) {
      case "Queixa Paciente": return <QueixaPaciente />;
      case "Histórico": return <Historico />;
      case "Exame físico": return <ExameFisico />;
      case "Problemas": return <Problemas />;
      case "Alergias": return <Alergias />;
      case "Sinais Vitais": return <SinaisVitais />;
      case "Hist. Exames": return <HistExames />;
      case "Imagens": return <Imagens />;
      case "Conduta": return <Conduta />;
      case "Prescrições": return <Prescricoes />;
      case "Encaminhamento": return <Encaminhamento />;
      case "Formulários": return <Formularios />;
      default: return null;
    }
  }

  if (firebaseConfigured && (!clinicaId || pacienteId !== pacienteIdRota || loadingAtendimento)) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-ink-500 text-sm">
        <Loader2 size={18} className="animate-spin" /> Abrindo atendimento…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Atendimento" timer={`${mm}:${ss}`} />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        {!firebaseConfigured && (
          <div className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-3.5 py-2.5">
            Firebase não configurado — as abas abaixo ficam em modo demo (somente leitura do layout, sem persistência).
          </div>
        )}
        <PatientHeader onOpenPercepcoes={() => setPercOpen(true)} />
        <div className="card">
          <div className="px-2">
            <Tabs tabs={tabs} active={active} onChange={setActive} />
          </div>
          <div className="p-4 lg:p-5">{renderTab()}</div>
        </div>
      </main>
      <div className="sticky bottom-0 bg-white border-t border-black/5 px-4 lg:px-6 py-3 flex items-center justify-end gap-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-500 mr-auto">
          <input type="checkbox" checked={enviarAvaliacao} onChange={(e) => setEnviarAvaliacao(e.target.checked)} className="rounded focus-ring" />
          <Star size={13} /> Enviar avaliação por e-mail ao finalizar
        </label>
        <button onClick={() => navigate("/pacientes")} className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg focus-ring">
          <Trash2 size={15} /> Cancelar
        </button>
        <button onClick={handleFinalizar} disabled={finalizando} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg focus-ring">
          {finalizando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Finalizar
        </button>
      </div>
      <AIPercepcoesPanel open={percOpen} onClose={() => setPercOpen(false)} />
    </div>
  );
}
