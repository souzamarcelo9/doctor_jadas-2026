import { useState } from "react";
import { X, ClipboardCheck, Loader2, AlertTriangle, Send, Copy, Check } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, useFirestoreDoc, criarDocumento } from "../../lib/firestore";
import { paraFormatoWhatsapp, montarMensagemTriagem } from "../../lib/whatsapp";

export default function EnviarTriagemModal({ open, onClose, paciente, agendamentoId }) {
  const { clinicaId } = useTenant();
  const { data: clinica } = useFirestoreDoc(open ? "clinicas" : null, clinicaId);
  const { data: formularios, loading } = useFirestoreCollection(open && clinicaId ? `clinicas/${clinicaId}/formularios` : null, "nome", "asc");

  const [formularioId, setFormularioId] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  if (!open) return null;

  const formulariosAtivos = (formularios || []).filter((f) => f.ativo !== false);

  async function gerarLink() {
    setErro("");
    const template = formulariosAtivos.find((f) => f.id === formularioId);
    if (!template) { setErro("Escolha qual formulário enviar."); return; }
    if (!paciente?.telefone) { setErro(`${paciente?.nome || "Este paciente"} não tem telefone cadastrado.`); return; }
    setGerando(true);
    try {
      const conviteRef = await criarDocumento(`clinicas/${clinicaId}/convitesFormulario`, {
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        agendamentoId: agendamentoId || null,
        formularioId: template.id,
        formularioNome: template.nome,
        campos: template.campos || [],
        pontuavel: template.pontuavel !== false,
        clinicaNome: clinica?.nome || "",
        status: "pendente",
      });
      const url = `${window.location.origin}/triagem/${clinicaId}/${conviteRef.id}`;
      setLink(url);
      const numero = paraFormatoWhatsapp(paciente.telefone);
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(montarMensagemTriagem(paciente.nome, url))}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Erro ao gerar convite de triagem:", err);
      setErro(err.message || "Não foi possível gerar o link. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><ClipboardCheck size={18} /> Enviar formulário de triagem</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-ink-500">
            Gera um link público — o paciente preenche em casa, sem precisar de login, e a resposta já aparece pronta na aba Formulários quando ele chegar pra consulta.
          </p>

          <label className="block text-xs">
            <span className="text-ink-500 font-medium">Paciente</span>
            <div className="mt-1 text-sm font-medium text-ink-900">{paciente?.nome || "—"}</div>
          </label>

          <label className="block text-xs">
            <span className="text-ink-500 font-medium">Qual formulário enviar</span>
            <select value={formularioId} onChange={(e) => setFormularioId(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
              <option value="">{loading ? "Carregando…" : "Selecione"}</option>
              {formulariosAtivos.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>

          {erro && (
            <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          {link && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-2.5">
              <span className="flex-1 truncate">{link}</span>
              <button onClick={copiarLink} className="flex items-center gap-1 font-semibold shrink-0 focus-ring">
                {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}

          <button onClick={gerarLink} disabled={gerando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
            {gerando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Gerar link e abrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
