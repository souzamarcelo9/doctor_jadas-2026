import { useState } from "react";
import { ExternalLink, Copy, Check, Mail, Loader2, Info } from "lucide-react";
import { extrairChaveNFe, montarLinkNfse } from "../lib/nfseErros";
import { nfseEnviarPorEmail } from "../lib/nfse";
import { emailValido } from "../lib/masks";

/** Ações sobre o documento de uma NFS-e já autorizada: abrir a página
 * oficial da Prefeitura (de onde dá pra imprimir / salvar em PDF), copiar o
 * link e mandar por e-mail pro paciente. O webservice da Prefeitura só
 * devolve XML — o "PDF no formato da Prefeitura" é gerado pelo portal dela,
 * por isso o caminho é apontar pra página oficial da nota. */
export default function NfseDocumentoAcoes({ clinicaId, nota, emailSugerido = "" }) {
  const chave = extrairChaveNFe(nota.respostaWebservice);
  const link = montarLinkNfse(chave);
  const [email, setEmail] = useState(emailSugerido);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (nota.status !== "autorizada") return null;

  if (!link) {
    return (
      <div className="flex items-start gap-2 text-xs bg-gray-50 text-ink-500 border border-black/5 rounded-lg p-3">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>Esta nota foi emitida em <strong>modo de teste</strong> — a Prefeitura não gera NFS-e de verdade nesse modo, então ainda não há documento oficial para abrir ou enviar. Isso passa a aparecer aqui automaticamente nas notas emitidas em produção.</span>
      </div>
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setFeedback({ tipo: "erro", texto: "Não foi possível copiar — use o botão de abrir e copie o endereço da barra do navegador." });
    }
  }

  async function enviar() {
    setFeedback(null);
    const destino = email.trim();
    if (!destino || !emailValido(destino)) {
      setFeedback({ tipo: "erro", texto: "Informe um e-mail válido." });
      return;
    }
    setEnviando(true);
    try {
      await nfseEnviarPorEmail(clinicaId, nota.id, destino);
      setFeedback({ tipo: "ok", texto: `NFS-e enviada para ${destino}.` });
    } catch (err) {
      console.error("Erro ao enviar NFS-e por e-mail:", err);
      setFeedback({ tipo: "erro", texto: err.message || "Não foi possível enviar o e-mail." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-700">
        <span>NFS-e nº <strong className="font-mono">{chave.numeroNfe}</strong></span>
        <span>Código de verificação <strong className="font-mono">{chave.codigoVerificacao}</strong></span>
        {nota.nfseEnviadaEmailPara && (
          <span className="text-ink-500">· Último envio: {nota.nfseEnviadaEmailPara}{nota.nfseEnviadaEmailEm ? ` em ${new Date(nota.nfseEnviadaEmailEm).toLocaleString("pt-BR")}` : ""}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg focus-ring">
          <ExternalLink size={13} /> Abrir NFS-e oficial
        </a>
        <button onClick={copiar} className="flex items-center gap-1.5 text-xs font-semibold border border-black/10 text-ink-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg focus-ring">
          {copiado ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} {copiado ? "Link copiado" : "Copiar link"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          maxLength={150}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do paciente"
          className="flex-1 min-w-[200px] max-w-sm text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
        />
        <button onClick={enviar} disabled={enviando} className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg focus-ring">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Enviar por e-mail
        </button>
      </div>

      {feedback && (
        <p className={`text-xs ${feedback.tipo === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{feedback.texto}</p>
      )}
      <p className="text-[11px] text-ink-500">Na página oficial da Prefeitura dá pra imprimir ou salvar em PDF (Ctrl+P → Salvar como PDF).</p>
    </div>
  );
}
