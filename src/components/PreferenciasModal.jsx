import { useState } from "react";
import { X, Grip, Pencil, ChevronDown, ChevronUp, Folder, ListTree } from "lucide-react";

const sections = [
  "Queixa Paciente", "Histórico", "Exame físico", "Problemas", "Alergias",
  "Hist. Exames", "Sinais Vitais", "Imagens", "Formulários", "Encaminhamento",
  "Conduta", "Preescrições", "Aso",
];

export default function PreferenciasModal({ open, onClose }) {
  const [mode, setMode] = useState("Horizontal");
  const [state, setState] = useState(
    sections.map((s, i) => ({ name: s, section: i + 1, aberto: true, ativo: i !== sections.length - 1 }))
  );

  if (!open) return null;

  function toggle(idx, key) {
    setState((s) => s.map((row, i) => (i === idx ? { ...row, [key]: !row[key] } : row)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-3xl max-h-[85vh] rounded-xl2 shadow-pop flex flex-col overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold">Preferências</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 border-b border-black/5">
          <p className="text-center text-sm font-semibold text-ink-900 mb-3">Modo de exibição de prontuário</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setMode("Horizontal")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium focus-ring ${mode === "Horizontal" ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-700"}`}
            >
              <Folder size={16} /> Horizontal
            </button>
            <button
              onClick={() => setMode("Vertical")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium focus-ring ${mode === "Vertical" ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-700"}`}
            >
              <ListTree size={16} /> Vertical
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b border-black/5">
              <tr className="text-left text-ink-500">
                <Th>Meu prontuário</Th><Th>Editar nome</Th><Th>Sequência</Th><Th>Aberto</Th><Th>Ativo</Th><Th>Cor</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {state.map((row, i) => (
                <tr key={row.name} className="border-b border-black/5">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <Grip size={14} className="text-ink-500 cursor-grab" />
                    <div>
                      <div className="font-medium text-ink-900">{row.name}</div>
                      <div className="text-[10px] text-ink-500">Seção {row.section} de {sections.length}</div>
                    </div>
                  </td>
                  <td className="px-4"><Pencil size={13} className="text-brand-500 cursor-pointer" /></td>
                  <td className="px-4">
                    <div className="flex flex-col text-brand-500">
                      <ChevronUp size={13} className="cursor-pointer" />
                      <ChevronDown size={13} className="cursor-pointer" />
                    </div>
                  </td>
                  <td className="px-4">
                    <Toggle checked={row.aberto} onChange={() => toggle(i, "aberto")} />
                  </td>
                  <td className="px-4">
                    <Toggle checked={row.ativo} onChange={() => toggle(i, "ativo")} />
                  </td>
                  <td className="px-4"><span className="w-4 h-4 rounded-sm bg-brand-700 inline-block" /></td>
                  <td className="px-4 text-ink-500"><ChevronDown size={13} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-black/5 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={onClose} className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg focus-ring">Salvar preferências</button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={onChange} className={`w-9 h-5 rounded-full relative transition-colors focus-ring ${checked ? "bg-brand-600" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`} />
    </button>
  );
}
function Th({ children }) { return <th className="px-4 py-2.5 font-semibold text-[11px]">{children}</th>; }
