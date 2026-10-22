import { useState } from "react";
import { FileCheck2, Loader2, AlertTriangle, FileDown } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, useFirestoreDoc, criarDocumento, mensagemErroAmigavel } from "../../lib/firestore";
import { emitirDocumentoPdf } from "../../lib/documentosPdf";

const TIPOS = {
  afastamento: "Atestado médico (afastamento)",
  comparecimento: "Declaração de comparecimento",
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const brData = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function textoPadrao({ tipo, dias, dataInicio, nome, cpf }) {
  const quem = `${nome || "o(a) paciente"}${cpf ? `, portador(a) do CPF ${cpf}` : ""}`;
  if (tipo === "comparecimento") {
    return `Declaro, para os devidos fins, que ${quem}, compareceu a esta clínica para atendimento médico em ${brData(dataInicio)}.`;
  }
  const n = Number(dias) || 1;
  return `Atesto, para os devidos fins, que ${quem}, esteve sob meus cuidados médicos e necessita de afastamento de suas atividades por ${n} (${n === 1 ? "um" : n}) dia${n === 1 ? "" : "s"}, a partir de ${brData(dataInicio)}.`;
}

export default function Atestado() {
  const { clinicaId, pacienteId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: paciente } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, pacienteId);
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/atestados`);
  const [form, setForm] = useState({ tipo: "afastamento", dias: "1", dataInicio: hojeISO(), cid: "", texto: "" });
  const [textoEditado, setTextoEditado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoId, setGerandoId] = useState(null);
  const [erro, setErro] = useState("");

  // Texto sugerido (derivado); vira o texto do médico assim que ele edita à mão.
  const textoSugerido = textoPadrao({ tipo: form.tipo, dias: form.dias, dataInicio: form.dataInicio, nome: paciente?.nome, cpf: paciente?.cpf });
  const textoAtual = textoEditado ? form.texto : textoSugerido;

  const secoesDe = (r) => [
    { texto: r.texto },
    ...(r.cid ? [{ titulo: "CID-10 (informado com autorização do paciente)", texto: r.cid }] : []),
  ];

  async function gerar(r) {
    setGerandoId(r.id);
    setErro("");
    try {
      const res = await emitirDocumentoPdf({
        clinicaId, pacienteId, profissionalId: r.profissionalId || profissionalId,
        titulo: TIPOS[r.tipo] || "Atestado médico", codigo: r.id.slice(0, 8).toUpperCase(),
        data: r.criadoEm?.toDate?.(), secoes: secoesDe(r),
      });
      if (res.medicoSemCrm) setErro("O PDF foi gerado, mas o CRM do médico não está cadastrado — preencha em Configurações → Editar Usuário.");
    } catch (err) {
      console.error("Erro ao gerar PDF do atestado:", err);
      setErro("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerandoId(null);
    }
  }

  async function emitir() {
    if (!textoAtual.trim() || !firebaseConfigured) return;
    setSalvando(true);
    setErro("");
    try {
      const dados = {
        tipo: form.tipo, dias: form.tipo === "afastamento" ? Number(form.dias) || 1 : null,
        dataInicio: form.dataInicio, cid: form.cid.trim(), texto: textoAtual.trim(),
        ativo: true, atendimentoId, profissionalId,
      };
      const ref = await criarDocumento(`${pacientePath}/atestados`, dados);
      await gerar({ id: ref.id, ...dados });
      setTextoEditado(false);
      setForm((f) => ({ ...f, cid: "", texto: "" }));
    } catch (err) {
      console.error("Erro ao emitir atestado:", err);
      setErro(mensagemErroAmigavel(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-4 space-y-3">
        <div className="text-sm font-display font-semibold text-ink-900 flex items-center gap-2">
          <FileCheck2 size={16} className="text-brand-600" /> Novo atestado
        </div>
        <label className="block text-xs">
          <span className="text-ink-500 font-medium">Tipo</span>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {form.tipo === "afastamento" && (
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Dias de afastamento</span>
              <input type="number" min="1" value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
          )}
          <label className="block text-xs">
            <span className="text-ink-500 font-medium">{form.tipo === "afastamento" ? "A partir de" : "Data do comparecimento"}</span>
            <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          </label>
        </div>
        <label className="block text-xs">
          <span className="text-ink-500 font-medium">CID-10 (opcional)</span>
          <input value={form.cid} onChange={(e) => setForm({ ...form, cid: e.target.value.toUpperCase() })} placeholder="Ex: J11" maxLength={20} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          <span className="text-[10px] text-ink-500">Só informe com autorização expressa do paciente (sigilo médico).</span>
        </label>
        <label className="block text-xs">
          <span className="text-ink-500 font-medium">Texto do documento (editável)</span>
          <textarea value={textoAtual} onChange={(e) => { setTextoEditado(true); setForm({ ...form, texto: e.target.value }); }} rows={6} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none" />
        </label>
        {erro && (
          <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}
          </div>
        )}
        <button onClick={emitir} disabled={salvando || !firebaseConfigured || !textoAtual.trim()} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Emitir e gerar PDF
        </button>
      </div>

      <div className="lg:col-span-2 card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-500 border-b border-black/5">
              <th className="px-3 py-2.5 font-semibold">Data</th><th className="px-3 py-2.5 font-semibold">Tipo</th><th className="px-3 py-2.5 font-semibold">Detalhe</th><th className="px-3 py-2.5 font-semibold">Documento</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-ink-500">Nenhum atestado emitido.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-ink-700">{r.criadoEm?.toDate ? r.criadoEm.toDate().toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 font-medium text-ink-900">{TIPOS[r.tipo] || r.tipo}</td>
                <td className="px-3 py-2 text-ink-700">{r.tipo === "afastamento" ? `${r.dias} dia(s) a partir de ${brData(r.dataInicio)}` : brData(r.dataInicio)}{r.cid ? ` · CID ${r.cid}` : ""}</td>
                <td className="px-3 py-2">
                  <button onClick={() => gerar(r)} disabled={gerandoId === r.id} className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60 px-2.5 py-1 rounded-md focus-ring">
                    {gerandoId === r.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
