import { FileEdit, Plus, ClipboardCheck, Loader2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../../lib/firestore";

const usoTone = { Alto: "bg-emerald-100 text-emerald-700", Médio: "bg-amber-100 text-amber-700", Baixo: "bg-gray-100 text-gray-500" };

export default function Formularios() {
  const { clinicaId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: templates, loading } = useFirestoreCollection(`clinicas/${clinicaId}/formularios`, "nome", "asc");

  async function aplicar(template) {
    if (!firebaseConfigured) return;
    await criarDocumento(`${pacientePath}/formulariosRespondidos`, {
      formularioNome: template.nome,
      status: "aplicado",
      atendimentoId,
      profissionalId,
      ativo: true,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-display font-semibold text-ink-900">Formulários dinâmicos</div>
          <p className="text-xs text-ink-500 mt-0.5">Cadastre formulários próprios do consultório ou utilize os modelos já disponíveis.</p>
        </div>
        <button className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring">
          <Plus size={14} /> Novo formulário
        </button>
      </div>

      {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
      {!loading && templates.length === 0 && <p className="text-xs text-ink-500">Nenhum formulário cadastrado nesta clínica ainda.</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        {templates.map((f) => (
          <div key={f.id} className="card p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileEdit size={16} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink-900">{f.nome}</div>
              <div className="text-[11px] text-ink-500 mt-0.5">{f.campos} campos configurados</div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${usoTone[f.uso] || usoTone.Médio}`}>Uso: {f.uso}</span>
                <button onClick={() => aplicar(f)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 ml-auto">
                  <ClipboardCheck size={12} /> Aplicar ao atendimento
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
