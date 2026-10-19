import { useMemo, useState } from "react";
import { User } from "lucide-react";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Campo de texto livre (o tomador pode ser empresa) que sugere pacientes
// cadastrados enquanto digita — por nome ou CPF — e devolve o paciente ao escolher.
export default function AutocompletePaciente({ label, value, onChange, onSelecionar, pacientes }) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const sugestoes = useMemo(() => {
    const q = norm(value).trim();
    const dig = value.replace(/\D/g, "");
    if (q.length < 2 && dig.length < 3) return [];
    return pacientes
      .filter((p) => p.ativo !== false && (norm(p.nome).includes(q) || (dig.length >= 3 && String(p.cpf || "").replace(/\D/g, "").includes(dig))))
      .slice(0, 8);
  }, [value, pacientes]);

  function escolher(p) {
    onSelecionar(p);
    setAberto(false);
  }

  function aoTeclar(e) {
    if (!aberto || !sugestoes.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => Math.min(i + 1, sugestoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); escolher(sugestoes[ativo] || sugestoes[0]); }
    else if (e.key === "Escape") setAberto(false);
  }

  return (
    <label className="block text-xs relative">
      <span className="text-ink-500 font-medium">{label}</span>
      <input
        value={value}
        autoComplete="off"
        placeholder="Digite o nome ou CPF do paciente…"
        onChange={(e) => { onChange(e.target.value); setAberto(true); setAtivo(0); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={aoTeclar}
        className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-black/10 rounded-lg shadow-pop max-h-60 overflow-y-auto">
          {sugestoes.map((p, i) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); escolher(p); }} onMouseEnter={() => setAtivo(i)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm ${i === ativo ? "bg-brand-50" : ""}`}>
                <User size={13} className="text-ink-500 shrink-0" />
                <span className="flex-1 truncate text-ink-900">{p.nome}</span>
                {p.cpf && <span className="text-[11px] text-ink-500 shrink-0">{p.cpf}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
