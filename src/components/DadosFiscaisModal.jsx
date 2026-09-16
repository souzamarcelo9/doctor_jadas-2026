import { useState } from "react";
import { X, Landmark, Loader2, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc, atualizarDocumento } from "../lib/firestore";

function apenasDigitos(v) {
  return (v || "").replace(/\D/g, "");
}

export default function DadosFiscaisModal({ open, onClose }) {
  const { clinicaId } = useTenant();
  const { data: clinica, loading } = useFirestoreDoc(open ? "clinicas" : null, clinicaId);

  // form só guarda o que a pessoa efetivamente editou nesta sessão do
  // modal — o valor mostrado (e salvo) é sempre "o que ela digitou, senão
  // o que já estava salvo na clínica, senão o padrão". Isso evita
  // sincronizar `clinica` pra dentro do estado via useEffect.
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  if (!open) return null;

  const valores = {
    cnpj: form.cnpj ?? clinica?.cnpj ?? "",
    inscricaoMunicipal: form.inscricaoMunicipal ?? clinica?.inscricaoMunicipal ?? "",
    codigoServicoPadrao: form.codigoServicoPadrao ?? clinica?.codigoServicoPadrao ?? "04030",
    nbsPadrao: form.nbsPadrao ?? clinica?.nbsPadrao ?? "123012100",
    cClassTribPadrao: form.cClassTribPadrao ?? clinica?.cClassTribPadrao ?? "200029",
  };

  async function salvar() {
    setErro("");
    setSucesso(false);
    if (apenasDigitos(valores.cnpj).length !== 14) { setErro("CNPJ precisa ter 14 dígitos."); return; }
    if (!apenasDigitos(valores.inscricaoMunicipal)) { setErro("Informe a Inscrição Municipal (CCM)."); return; }
    setSalvando(true);
    try {
      await atualizarDocumento("clinicas", clinicaId, {
        cnpj: apenasDigitos(valores.cnpj),
        inscricaoMunicipal: apenasDigitos(valores.inscricaoMunicipal),
        codigoServicoPadrao: valores.codigoServicoPadrao.trim(),
        nbsPadrao: valores.nbsPadrao.trim(),
        cClassTribPadrao: valores.cClassTribPadrao.trim(),
      });
      setSucesso(true);
    } catch (err) {
      console.error("Erro ao salvar dados fiscais:", err);
      setErro(err.code === "permission-denied" ? "Só administradores da clínica podem alterar os dados fiscais." : err.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><Landmark size={18} /> Dados Fiscais</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-ink-500 justify-center py-4"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : (
            <>
              <p className="text-xs text-ink-500">Usados na emissão de NFS-e (Nota Fiscal Paulistana). Precisam bater exatamente com o Cadastro de Contribuintes Mobiliários (CCM) da clínica na Prefeitura.</p>

              <label className="block text-xs">
                <span className="text-ink-500 font-medium">CNPJ da clínica</span>
                <input value={valores.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
              </label>

              <label className="block text-xs">
                <span className="text-ink-500 font-medium">Inscrição Municipal (CCM)</span>
                <input value={valores.inscricaoMunicipal} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} placeholder="0.000.000-0" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
                <span className="text-[11px] text-ink-500">Só os dígitos são usados — pode digitar com ou sem pontuação.</span>
              </label>

              <label className="block text-xs">
                <span className="text-ink-500 font-medium">Código de serviço padrão (ISS)</span>
                <input value={valores.codigoServicoPadrao} onChange={(e) => setForm({ ...form, codigoServicoPadrao: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-3 py-2 focus-ring" />
                <span className="text-[11px] text-ink-500">04030 = Medicina e biomedicina (padrão). Só troque se sua clínica tiver um enquadramento diferente.</span>
              </label>

              <div className="border-t border-black/5 pt-4">
                <p className="text-xs font-semibold text-ink-700 mb-2">Reforma Tributária (IBS/CBS)</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs">
                    <span className="text-ink-500 font-medium">NBS</span>
                    <input value={valores.nbsPadrao} onChange={(e) => setForm({ ...form, nbsPadrao: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
                  </label>
                  <label className="block text-xs">
                    <span className="text-ink-500 font-medium">cClassTrib</span>
                    <input value={valores.cClassTribPadrao} onChange={(e) => setForm({ ...form, cClassTribPadrao: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
                  </label>
                </div>
                <p className="text-[11px] text-ink-500 mt-1.5">Padrão: 123012100 (clínica médica geral) / 200029 (serviços de saúde humana). Troque só se a especialidade tiver código próprio no Anexo III da LC 214/2025 (ex: cirúrgico, psiquiátrico, obstétrico).</p>
              </div>

              {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}
              {sucesso && <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3"><CheckCircle2 size={14} /> Salvo!</div>}
            </>
          )}
        </div>

        {!loading && (
          <div className="px-5 py-4 border-t border-black/5 shrink-0">
            <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
