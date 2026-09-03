import { useMemo, useState } from "react";
import { FileEdit, ClipboardCheck, Loader2, Eye, TrendingUp, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, alternarAtivo } from "../../lib/firestore";
import FormularioResponderModal from "./FormularioResponderModal";

export default function Formularios() {
  const { clinicaId, pacientePath } = useTenant();
  const { data: templates, loading: loadingTemplates } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/formularios` : null, "nome", "asc");
  const { data: respostas, loading: loadingRespostas } = useFirestoreCollection(`${pacientePath}/formulariosRespondidos`, "criadoEm", "desc");

  const [templateRespondendo, setTemplateRespondendo] = useState(null);
  const [respostaVendo, setRespostaVendo] = useState(null);

  const templatesAtivos = templates.filter((t) => t.ativo !== false);

  // Quantas respostas cada formulário já tem, pra só mostrar o ícone de
  // tendência quando fizer sentido (2 ou mais aplicações).
  const contagemPorFormulario = useMemo(() => {
    const contagem = {};
    respostas.forEach((r) => { contagem[r.formularioId] = (contagem[r.formularioId] || 0) + 1; });
    return contagem;
  }, [respostas]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-display font-semibold text-ink-900">Formulários dinâmicos</div>
        <p className="text-xs text-ink-500 mt-0.5">Escolha um formulário pra aplicar neste atendimento. Para criar ou editar templates, vá em Configurações → Formulários de Avaliação.</p>
      </div>

      {loadingTemplates && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
      {!loadingTemplates && templatesAtivos.length === 0 && (
        <p className="text-xs text-ink-500">Nenhum formulário cadastrado nesta clínica ainda — cadastre em Configurações → Formulários de Avaliação.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {templatesAtivos.map((f) => (
          <div key={f.id} className="card p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileEdit size={16} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink-900">{f.nome}</div>
              <div className="text-[11px] text-ink-500 mt-0.5">{(f.campos || []).length} campo(s){f.pontuavel === false ? " · sem score" : ""}</div>
              <button onClick={() => setTemplateRespondendo(f)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 mt-2">
                <ClipboardCheck size={12} /> Aplicar ao atendimento
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-700 text-white text-left">
              <Th>Data</Th><Th>Formulário</Th><Th>Score</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loadingRespostas && <tr><td colSpan={4} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loadingRespostas && respostas.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-ink-500">Nenhum formulário respondido ainda.</td></tr>}
            {respostas.map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <Td className="whitespace-nowrap">{formatarData(r.criadoEm)}</Td>
                <Td className="font-medium text-ink-900">{r.formularioNome}</Td>
                <Td>{r.scoreTotal ?? "—"}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRespostaVendo(r)} title="Visualizar respostas" className="p-1.5 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 focus-ring"><Eye size={13} /></button>
                    {contagemPorFormulario[r.formularioId] >= 2 && (
                      <button onClick={() => setRespostaVendo({ ...r, mostrarTendencia: true })} title="Ver evolução do score" className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 focus-ring"><TrendingUp size={13} /></button>
                    )}
                    <button onClick={() => alternarAtivo(`${pacientePath}/formulariosRespondidos`, r.id, false)} className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md focus-ring">
                      Inativar
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {templateRespondendo && (
        <FormularioResponderModal template={templateRespondendo} onClose={() => setTemplateRespondendo(null)} />
      )}

      {respostaVendo && (
        <RespostaDetalheModal
          resposta={respostaVendo}
          historico={respostas.filter((r) => r.formularioId === respostaVendo.formularioId)}
          onClose={() => setRespostaVendo(null)}
        />
      )}
    </div>
  );
}

function RespostaDetalheModal({ resposta, historico, onClose }) {
  const dadosGrafico = [...historico]
    .filter((r) => r.scoreTotal !== null && r.scoreTotal !== undefined)
    .sort((a, b) => (a.criadoEm?.toMillis?.() || 0) - (b.criadoEm?.toMillis?.() || 0))
    .map((r) => ({ data: formatarData(r.criadoEm), score: r.scoreTotal }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold">{resposta.formularioNome} · {formatarData(resposta.criadoEm)}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {resposta.mostrarTendencia && dadosGrafico.length >= 2 && (
            <div className="card p-3">
              <div className="text-xs font-semibold text-ink-700 mb-2">Evolução do score</div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5eeee" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#5a7683" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="#178a8c" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {resposta.scoreTotal !== null && resposta.scoreTotal !== undefined && (
            <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-4 py-2.5">
              <span className="text-xs font-semibold text-brand-700">Score desta aplicação</span>
              <span className="text-base font-display font-bold text-brand-700">{resposta.scoreTotal}</span>
            </div>
          )}

          <div className="space-y-2">
            {(resposta.respostas || []).map((r) => (
              <div key={r.campoId} className="text-xs border-b border-black/5 pb-2 last:border-0">
                <div className="text-ink-500">{r.label}</div>
                <div className="text-ink-900 font-medium mt-0.5">{String(r.valor) || "—"} {r.tipo !== "texto" && <span className="text-ink-500 font-normal">({r.pontos} pt)</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleDateString("pt-BR") : "—"; }
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px] tracking-wide">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
