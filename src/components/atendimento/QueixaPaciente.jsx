import { useState } from "react";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { favoritesChips } from "../../data/mockData";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento, atualizarDocumento } from "../../lib/firestore";
import AITranscriber from "../AITranscriber";

export default function QueixaPaciente() {
  const { clinicaId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: entries, loading } = useFirestoreCollection(`${pacientePath}/queixas`);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  function insertNote(note) {
    setText((t) => (t ? `${t}\n${note}` : note));
  }

  async function handleSalvar() {
    if (!text.trim() || !firebaseConfigured) return;
    setSaving(true);
    try {
      await criarDocumento(`${pacientePath}/queixas`, {
        texto: text,
        atendimentoId,
        profissionalId,
        origemIA: false,
        ativo: true,
      });
      if (atendimentoId) {
        await atualizarDocumento(`clinicas/${clinicaId}/atendimentos`, atendimentoId, { queixaResumo: text });
      }
      setText("");
    } catch (err) {
      console.error("Erro ao salvar queixa:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-500">
            <input type="checkbox" className="rounded accent-brand-600" /> Exibir inativos
          </label>
          <input type="date" defaultValue="2026-08-08" className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          <input type="time" defaultValue="13:20" className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          <span className="badge-leve text-xs font-semibold px-3 py-1 rounded-full">Leve</span>
          <span className="badge-moderada text-xs font-semibold px-3 py-1 rounded-full">Moderada</span>
          <span className="badge-severa text-xs font-semibold px-3 py-1 rounded-full">Severa</span>
          <div className="ml-auto flex items-center gap-2">
            <select className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
              <option>Favoritos...</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {favoritesChips.map((c) => (
            <button
              key={c}
              onClick={() => setText((t) => (t ? `${t} ${c}.` : `${c}.`))}
              className="text-xs border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors rounded-full px-3.5 py-1.5 focus-ring"
            >
              {c}
            </button>
          ))}
        </div>

        <div className="card p-3">
          <div className="flex items-center gap-1 pb-2 mb-2 border-b border-black/5 text-ink-500">
            {[12, 14, 16, 18].map((s) => (
              <button key={s} className="text-xs w-7 h-7 rounded hover:bg-black/5 focus-ring">{s}</button>
            ))}
            <div className="w-px h-4 bg-black/10 mx-1" />
            <button className="w-7 h-7 rounded hover:bg-black/5 focus-ring"><Bold size={14} /></button>
            <button className="w-7 h-7 rounded hover:bg-black/5 focus-ring"><Italic size={14} /></button>
            <button className="w-7 h-7 rounded hover:bg-black/5 focus-ring"><Underline size={14} /></button>
            <div className="w-px h-4 bg-black/10 mx-1" />
            <button className="w-7 h-7 rounded hover:bg-black/5 focus-ring"><AlignLeft size={14} /></button>
            <button className="w-7 h-7 rounded hover:bg-black/5 focus-ring"><AlignCenter size={14} /></button>
            <button className="w-7 h-7 rounded hover:bg-black/5 focus-ring"><AlignRight size={14} /></button>
            <div className="w-px h-4 bg-black/10 mx-1" />
            {["#1e3a5c", "#f97316", "#10b981", "#38bdf8"].map((c) => (
              <span key={c} className="w-4 h-4 rounded-sm cursor-pointer" style={{ background: c }} />
            ))}
            <button
              onClick={handleSalvar}
              disabled={saving || !firebaseConfigured}
              className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg focus-ring"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} Salvar registro
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={firebaseConfigured ? "Descreva a queixa do paciente, ou use a transcrição por IA ao lado…" : "Firebase não configurado — modo demo apenas para visualizar o layout."}
            rows={6}
            className="w-full text-sm resize-none outline-none placeholder:text-ink-500/60"
          />
        </div>
      </div>

      <div className="space-y-4">
        <AITranscriber onInsertNote={insertNote} />

        <div className="card p-3">
          <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-black/5">
            <span className="text-xs font-semibold text-ink-500">Histórico de registros</span>
            <ChevronDown size={14} className="text-ink-500" />
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-black/5">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-ink-500 py-4 justify-center">
                <Loader2 size={14} className="animate-spin" /> Carregando…
              </div>
            )}
            {!loading && entries.length === 0 && (
              <p className="text-xs text-ink-500 py-4 text-center">Nenhum registro ainda.</p>
            )}
            {entries.map((e) => (
              <div key={e.id} className="py-2.5 px-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  {formatarData(e.criadoEm)}
                  {e.origemIA && (
                    <span className="ml-1 flex items-center gap-0.5 text-[10px] font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                      <Sparkles size={9} /> IA
                    </span>
                  )}
                </div>
                {e.texto && <p className="text-xs text-ink-700 mt-1 leading-relaxed">{e.texto}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatarData(timestamp) {
  if (!timestamp?.toDate) return "agora";
  const d = timestamp.toDate();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
