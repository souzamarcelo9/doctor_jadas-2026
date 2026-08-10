import Topbar from "../components/Topbar";
import AITranscriber from "../components/AITranscriber";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc } from "../lib/firestore";
import { Mic, FileText, ListChecks, Sparkles, ClipboardList, Pill, FlaskConical, AlertCircle } from "lucide-react";

const features = [
  { icon: Mic, title: "Transcrição instantânea", desc: "Fala transformada em texto em segundos, direto durante a consulta (Groq Whisper)." },
  { icon: FileText, title: "Anotações automáticas", desc: "Cada detalhe do atendimento é registrado sem digitação manual." },
  { icon: Sparkles, title: "Sumarização inteligente", desc: "O que importa, organizado e pronto para revisão em segundos (Groq Llama 3.3)." },
  { icon: ListChecks, title: "Itens sugeridos", desc: "Condutas, exames e alertas sugeridos para agilizar a decisão clínica." },
];

const iconByType = { problema: ClipboardList, conduta: Pill, exame: FlaskConical, alerta: AlertCircle };

export default function IAClinica() {
  const { clinicaId, atendimentoId } = useTenant();
  const { data: atendimento } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/atendimentos` : null, atendimentoId);
  const sugestoes = atendimento?.sugestoesIA || [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="IA Clínica" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-4">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-2.5">
                <Icon size={17} />
              </div>
              <div className="text-sm font-semibold text-ink-900">{title}</div>
              <div className="text-xs text-ink-500 mt-1 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <AITranscriber />

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-brand-500" />
              <span className="text-sm font-display font-semibold text-ink-900">Itens sugeridos para este atendimento</span>
            </div>
            {sugestoes.length === 0 ? (
              <p className="text-xs text-ink-500 py-4 text-center">Grave a consulta ao lado para gerar sugestões aqui.</p>
            ) : (
              <div className="space-y-2.5">
                {sugestoes.map((s, i) => {
                  const Icon = iconByType[s.tipo] || Sparkles;
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-brand-50/50">
                      <div className="w-7 h-7 rounded-lg bg-white text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-ink-900 leading-snug">{s.label}</p>
                        <span className="text-[10px] text-ink-500">{Math.round((s.confianca || 0) * 100)}% de confiança</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-ink-500 mt-3">
              As sugestões são geradas a partir da transcrição desta consulta. A decisão final é sempre do profissional responsável.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
