import { useRef, useState } from "react";
import { X, ShieldCheck, Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc } from "../lib/firestore";
import { nfseSalvarCertificado } from "../lib/nfse";

export default function CertificadoDigitalModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const { data: clinica, loading } = useFirestoreDoc(open ? "clinicas" : null, clinicaId);
  const [arquivo, setArquivo] = useState(null);
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(null);
  const inputRef = useRef(null);

  if (!open) return null;

  const certAtual = clinica?.certificadoNfse;

  async function salvar() {
    if (!arquivo || !senha) return;
    setSalvando(true);
    setErro("");
    setSucesso(null);
    try {
      const resultado = await nfseSalvarCertificado(clinicaId, arquivo, senha);
      setSucesso(resultado);
      setArquivo(null);
      setSenha("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      console.error("Erro ao salvar certificado:", err);
      setErro(err.code === "functions/permission-denied" ? "Só administradores da clínica podem configurar o certificado." : err.message || "Não foi possível salvar o certificado.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><ShieldCheck size={18} /> Certificado Digital</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-ink-500 justify-center py-4"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : certAtual?.status === "configurado" ? (
            <div className="flex items-start gap-2.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Certificado configurado</div>
                {certAtual.nomeCertificado && <div>Emitido para: {certAtual.nomeCertificado}</div>}
                {certAtual.validoAte && <div>Válido até: {new Date(certAtual.validoAte).toLocaleDateString("pt-BR")}</div>}
                <div className="text-[11px] text-emerald-600 mt-1">Envie um novo arquivo abaixo para substituir.</div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Nenhum certificado configurado ainda — a emissão de NFS-e não vai funcionar até isso ser feito.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Arquivo do certificado (.pfx ou .p12)</label>
            <input ref={inputRef} type="file" accept=".pfx,.p12" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="w-full text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring file:mr-2 file:text-xs file:border-0 file:bg-brand-50 file:text-brand-700 file:rounded file:px-2 file:py-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Senha do certificado</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          </div>

          <p className="text-[11px] text-ink-500">
            O arquivo e a senha são enviados direto para um cofre de segredos (Secret Manager) — nunca ficam salvos no banco de dados nem visíveis depois, nem para administradores.
          </p>

          {erro && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>}
          {sucesso && (
            <div className="flex items-start gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> Certificado salvo com sucesso{sucesso.nomeCertificado ? ` — ${sucesso.nomeCertificado}` : ""}.
            </div>
          )}

          <button
            onClick={salvar}
            disabled={salvando || !arquivo || !senha}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Salvar certificado
          </button>
        </div>
      </div>
    </div>
  );
}
