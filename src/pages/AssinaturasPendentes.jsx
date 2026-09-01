import { useState } from "react";
import Topbar from "../components/Topbar";
import { FileSignature, ClipboardList, Pill, Send, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreQuery, where, orderBy } from "../lib/firestore";
import { assinarDocumento } from "../lib/assinaturas";

const moduloInfo = {
  condutas: { label: "Conduta", icon: ClipboardList, tone: "bg-brand-50 text-brand-700" },
  prescricoes: { label: "Prescrição", icon: Pill, tone: "bg-emerald-50 text-emerald-700" },
  encaminhamentos: { label: "Encaminhamento", icon: Send, tone: "bg-indigo-50 text-indigo-700" },
};

export default function AssinaturasPendentes() {
  const { clinicaId, profissionalId } = useTenant();
  const { data: pendentes, loading } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/assinaturasPendentes` : null,
    [where("profissionalId", "==", profissionalId), orderBy("criadoEm", "desc")],
    [profissionalId]
  );

  const [assinandoId, setAssinandoId] = useState(null);
  const [erroId, setErroId] = useState(null);
  const [erroMsg, setErroMsg] = useState("");

  async function assinar(item) {
    setAssinandoId(item.id);
    setErroId(null);
    try {
      await assinarDocumento(clinicaId, item.pacienteId, item.modulo, item.documentoId);
      // Sem necessidade de remover manualmente da lista: a Cloud Function
      // apaga o item do índice ao assinar, e o onSnapshot já reflete isso.
    } catch (err) {
      console.error("Erro ao assinar documento:", err);
      setErroId(item.id);
      setErroMsg(err.message || "Não foi possível assinar. Tente novamente.");
    } finally {
      setAssinandoId(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Assinaturas Pendentes" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex items-start gap-2.5 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg p-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          A assinatura usa o certificado digital configurado em Configurações → Certificado Digital. Ela prova integridade e autoria com criptografia real, mas ainda não é um envelope CAdES/PAdES no padrão ICP-Brasil — não trate como equivalente legal a uma assinatura ICP-Brasil para documentos que exigem validade jurídica plena.
        </div>

        {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

        {!loading && pendentes.length === 0 && (
          <div className="card p-8 text-center">
            <ShieldCheck size={28} className="mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-semibold text-ink-900">Tudo assinado por aqui.</p>
            <p className="text-xs text-ink-500 mt-1">Novas condutas, prescrições e encaminhamentos que você registrar aparecem aqui até serem assinados.</p>
          </div>
        )}

        <div className="space-y-2">
          {pendentes.map((item) => {
            const info = moduloInfo[item.modulo] || moduloInfo.condutas;
            const Icon = info.icon;
            return (
              <div key={item.id} className="card p-3.5">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${info.tone}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink-900">{item.pacienteNome || "Paciente"}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.tone}`}>{info.label}</span>
                      <span className="text-[11px] text-ink-500">{formatarData(item.criadoEm)}</span>
                    </div>
                    <p className="text-xs text-ink-700 mt-1 leading-relaxed">{item.resumo || "—"}</p>
                    {erroId === item.id && <p className="text-[11px] text-rose-600 mt-1.5">{erroMsg}</p>}
                  </div>
                  <button
                    onClick={() => assinar(item)}
                    disabled={assinandoId === item.id}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-3.5 py-2 rounded-lg focus-ring shrink-0"
                  >
                    {assinandoId === item.id ? <Loader2 size={13} className="animate-spin" /> : <FileSignature size={13} />}
                    Assinar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function formatarData(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
