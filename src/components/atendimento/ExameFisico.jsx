import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { exameFisicoFavoritos } from "../../data/mockData";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreDoc, salvarDocumentoComId } from "../../lib/firestore";

const sistemas = [
  { key: "estadoGeral", label: "Estado geral" },
  { key: "peleFaneros", label: "Pele e fâneros" },
  { key: "cabecaPescoco", label: "Cabeça e pescoço" },
  { key: "cardiovascular", label: "Aparelho cardiovascular" },
  { key: "respiratorio", label: "Aparelho respiratório" },
  { key: "abdomen", label: "Abdômen" },
  { key: "membros", label: "Membros" },
];

export default function ExameFisico() {
  const { pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  // Um documento por atendimento — ID = atendimentoId, assim o exame físico
  // desta consulta é sempre o mesmo doc enquanto o atendimento está aberto.
  const { data: doc, loading } = useFirestoreDoc(`${pacientePath}/exameFisico`, atendimentoId);
  const [values, setValues] = useState({});
  const [activeKey, setActiveKey] = useState("peleFaneros");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (doc) setValues(doc);
  }, [doc]);

  async function salvarCampo(key, texto) {
    if (!firebaseConfigured || !atendimentoId) return;
    setSalvando(true);
    try {
      await salvarDocumentoComId(`${pacientePath}/exameFisico`, atendimentoId, {
        [key]: texto,
        profissionalId,
        atualizadoEm: new Date().toISOString(),
      }, !doc);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-2">
        {loading && <div className="text-xs text-ink-500 flex items-center gap-2 py-4"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
        {!loading && sistemas.map((s) => (
          <div key={s.key} className="card overflow-hidden">
            <button onClick={() => setActiveKey(activeKey === s.key ? "" : s.key)} className="w-full flex items-center justify-between px-4 py-2.5 text-left focus-ring">
              <span className="text-sm font-semibold text-ink-900">{s.label}</span>
              <span className="text-ink-500 text-xs">{activeKey === s.key ? "−" : "+"}</span>
            </button>
            {activeKey === s.key ? (
              <div className="px-4 pb-3.5">
                <textarea
                  value={values[s.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                  onBlur={(e) => salvarCampo(s.key, e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-2 focus-ring resize-none"
                />
              </div>
            ) : (
              <p className="px-4 pb-3.5 text-xs text-ink-500 truncate">{values[s.key] || "—"}</p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="card p-3.5">
          <div className="text-xs font-semibold text-ink-500 mb-2">Itens de acesso rápido</div>
          <div className="flex flex-wrap gap-2">
            {exameFisicoFavoritos.map((f) => (
              <button
                key={f}
                onClick={() => activeKey && setValues((v) => ({ ...v, [activeKey]: v[activeKey] ? `${v[activeKey]} ${f}.` : `${f}.` }))}
                className="text-xs border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full px-3 py-1.5 focus-ring"
              >
                {f}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-500 mt-3">Clique numa seção à esquerda para editar; ao sair do campo o texto é salvo automaticamente.</p>
        </div>
        {activeKey && (
          <button onClick={() => salvarCampo(activeKey, values[activeKey] || "")} disabled={salvando || !firebaseConfigured} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar seção atual
          </button>
        )}
      </div>
    </div>
  );
}
