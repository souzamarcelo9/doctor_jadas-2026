import { useEffect, useState } from "react";
import { X, Send, Mail, MessageCircle, Printer, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc } from "../lib/firestore";
import { prepararDocumentoPdf } from "../lib/documentosPdf";
import { enviarDocumentoPorEmail, publicarDocumentoParaLink, registrarEnvioDocumento } from "../lib/documentosEnvio";
import { abrirLinkWhatsapp, montarMensagemDocumento } from "../lib/whatsapp";
import { emailValido, maskCelular, celularValido } from "../lib/masks";

/**
 * Modal "Enviar ao paciente": e-mail (PDF anexado), WhatsApp (link do PDF) ou
 * abrir o PDF pra imprimir. `params` são os mesmos de gerarPdfDocumento
 * (clinicaId, pacienteId, profissionalId, titulo, secoes, data, codigo).
 */
export default function EnviarDocumentoModal({ params, onClose }) {
  const { pacientePath } = useTenant();
  const { data: paciente } = useFirestoreDoc(`clinicas/${params.clinicaId}/pacientes`, params.pacienteId);
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  // Pré-preenche com o cadastro do paciente (só uma vez, sem sobrescrever o que a pessoa já digitou).
  useEffect(() => {
    if (!paciente) return;
    setEmail((v) => v || paciente.email || "");
    setCelular((v) => v || (paciente.celular ? maskCelular(paciente.celular) : ""));
  }, [paciente]);

  async function executar(canal, fn) {
    setErro(""); setOk(""); setOcupado(canal);
    try {
      await fn();
    } catch (err) {
      console.error(`Erro ao enviar documento (${canal}):`, err);
      setErro(err.message || "Não foi possível concluir. Tente novamente.");
    } finally {
      setOcupado("");
    }
  }

  const porEmail = () => executar("email", async () => {
    if (!emailValido(email) || !email.trim()) throw new Error("Informe um e-mail válido.");
    const pdf = await prepararDocumentoPdf(params);
    await enviarDocumentoPorEmail({ clinicaId: params.clinicaId, pacienteId: params.pacienteId, email: email.trim(), titulo: params.titulo, nomeArquivo: pdf.nomeArquivo, blob: pdf.blob });
    await registrarEnvioDocumento(pacientePath, { titulo: params.titulo, canal: "email", destino: email.trim(), codigo: params.codigo || "", ativo: true });
    setOk(`Enviado por e-mail para ${email.trim()}.`);
  });

  const porWhatsapp = () => executar("whatsapp", async () => {
    if (!celular.trim() || !celularValido(celular)) throw new Error("Informe um celular válido com DDD.");
    // Abre o WhatsApp só depois do upload; se o navegador bloquear a aba, avisa.
    const pdf = await prepararDocumentoPdf(params);
    const { url, storagePath } = await publicarDocumentoParaLink({ clinicaId: params.clinicaId, pacienteId: params.pacienteId, blob: pdf.blob, nomeArquivo: pdf.nomeArquivo });
    const msg = montarMensagemDocumento(paciente?.nome, params.titulo, url, pdf.clinica?.nome);
    await registrarEnvioDocumento(pacientePath, { titulo: params.titulo, canal: "whatsapp", destino: celular, codigo: params.codigo || "", storagePath, ativo: true });
    if (!abrirLinkWhatsapp(celular, msg)) throw new Error("Celular inválido para o WhatsApp.");
    setOk("WhatsApp aberto com a mensagem pronta — falta só clicar em enviar lá.");
  });

  const imprimir = () => executar("pdf", async () => {
    const janela = window.open("", "_blank");
    try {
      const pdf = await prepararDocumentoPdf(params);
      const url = URL.createObjectURL(pdf.blob);
      if (janela) janela.location.href = url;
      else { const a = document.createElement("a"); a.href = url; a.download = pdf.nomeArquivo; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { janela?.close(); throw e; }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl2 shadow-pop overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-brand-600 text-white">
          <span className="font-display font-semibold text-sm flex items-center gap-2 truncate"><Send size={16} /> Enviar — {params.titulo}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-ink-500">Paciente: <strong className="text-ink-900">{paciente?.nome || "…"}</strong></p>

          <div className="flex items-start gap-2 text-[11px] bg-amber-50 text-amber-800 border border-amber-100 rounded-lg p-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Este PDF ainda não tem assinatura digital ICP-Brasil. Para ter validade como documento médico, imprima e assine/carimbe, ou aguarde a assinatura digital (próxima etapa).
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">E-mail do paciente</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="paciente@email.com" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
            <button onClick={porEmail} disabled={!!ocupado} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg focus-ring">
              {ocupado === "email" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Enviar por e-mail (PDF anexado)
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Celular / WhatsApp</span>
              <input value={celular} onChange={(e) => setCelular(maskCelular(e.target.value))} placeholder="(00) 00000-0000" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
            <button onClick={porWhatsapp} disabled={!!ocupado} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg focus-ring">
              {ocupado === "whatsapp" ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} Enviar por WhatsApp (link do PDF)
            </button>
            <p className="text-[10px] text-ink-500">O WhatsApp abre com a mensagem pronta e o link do PDF; é preciso clicar em enviar lá. Quem tiver o link consegue abrir o documento — mande só para o próprio paciente.</p>
          </div>

          <button onClick={imprimir} disabled={!!ocupado} className="w-full flex items-center justify-center gap-2 border border-black/10 hover:bg-gray-50 disabled:opacity-60 text-ink-700 text-sm font-semibold py-2 rounded-lg focus-ring">
            {ocupado === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Abrir PDF para imprimir
          </button>

          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}
          {ok && <div className="flex items-start gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {ok}</div>}
        </div>
      </div>
    </div>
  );
}
