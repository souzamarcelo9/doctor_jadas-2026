import { useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useTenant } from "../context/TenantContext";

export default function ClinicSwitcher() {
  const { clinicaId, clinicasDisponiveis, trocarClinica, loadingClinicas } = useTenant();
  const [open, setOpen] = useState(false);

  if (loadingClinicas) return null;
  if (clinicasDisponiveis.length === 0) return null;

  const atual = clinicasDisponiveis.find((c) => c.clinicaId === clinicaId);

  // Só um vínculo: mostra como rótulo fixo, sem dropdown (nada a trocar).
  if (clinicasDisponiveis.length === 1) {
    return (
      <span className="hidden md:flex items-center gap-1.5 text-xs text-ink-500 border border-black/10 rounded-lg px-2.5 py-1.5">
        <Building2 size={13} /> {atual?.nome}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-ink-700 border border-black/10 hover:border-black/20 rounded-lg px-2.5 py-1.5 focus-ring"
      >
        <Building2 size={13} /> {atual?.nome || "Selecionar clínica"} <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-pop border border-black/5 py-1.5 z-20">
            {clinicasDisponiveis.map((c) => (
              <button
                key={c.clinicaId}
                onClick={() => { trocarClinica(c.clinicaId); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs text-ink-700 hover:bg-brand-50 focus-ring text-left"
              >
                <span>
                  <span className="block font-medium">{c.nome}</span>
                  <span className="block text-[10px] text-ink-500 capitalize">{c.papel}</span>
                </span>
                {c.clinicaId === clinicaId && <Check size={13} className="text-brand-600 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
