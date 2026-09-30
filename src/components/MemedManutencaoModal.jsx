import { useState } from "react";
import { X, Stethoscope, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { memedLimparTokensCache } from "../lib/memed";

export default function MemedManutencaoModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");

  async function limpar() {
    setRodando(true);
    setErro("");
    setResultado(null);
    try {
      const r = await memedLimparTokensCache(clinicaId);
      setResultado(r);
    } catch (err) {
      console.error("Erro ao limpar tokens da Memed:", err);
      setErro(err.message || "Não foi possível limpar. Tente novamente.");
    } finally {
      setRodando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><Stethoscope size={18} /> Prescrição Digital (Memed)</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-ink-700">
            Sempre que a clínica trocar de ambiente da Memed (teste → produção) ou trocar as chaves de API, os tokens já
            salvos dos médicos ficam obsoletos — cada um deles precisaria logar de novo na Memed na próxima receita.
            Esse botão limpa esse cache de uma vez, pra ninguém tomar um erro confuso de "token inválido".
          </p>

          {resultado && (
            <div className="flex items-start gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
              {resultado.limpos > 0
                ? `Pronto — ${resultado.limpos} sessão(ões) de médico limpa(s). Na próxima receita, cada um loga de novo automaticamente.`
                : "Nenhuma sessão salva encontrada — nada a limpar."}
            </div>
          )}
          {erro && (
            <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          <button
            onClick={limpar}
            disabled={rodando}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring"
          >
            {rodando ? <Loader2 size={15} className="animate-spin" /> : <Stethoscope size={15} />} Limpar sessões salvas
          </button>
        </div>
      </div>
    </div>
  );
}
