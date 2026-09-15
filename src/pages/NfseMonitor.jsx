import { useState } from "react";
import Topbar from "../components/Topbar";
import { Receipt, CheckCircle2, Clock3, XCircle, Copy, Check, AlertTriangle } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection } from "../lib/firestore";

const statusTone = {
  autorizada: { label: "Autorizada", tone: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  processando: { label: "Processando (teste)", tone: "bg-amber-100 text-amber-700", icon: Clock3 },
  erro_certificado: { label: "Erro no envio", tone: "bg-rose-100 text-rose-700", icon: XCircle },
  pendente: { label: "Pendente", tone: "bg-gray-100 text-gray-500", icon: Clock3 },
};

export default function NfseMonitor() {
  const { clinicaId } = useTenant();
  const { data: notas, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/notasFiscais` : null, "criadoEm", "desc");
  const [selecionadaId, setSelecionadaId] = useState(null);

  // Sem seleção manual ainda, cai na mais recente — evita um clique extra
  // bem no momento em que você acabou de testar uma emissão. Derivado
  // direto no render (não precisa de efeito pra isso).
  const idEfetiva = selecionadaId || notas[0]?.id;
  const selecionada = notas.find((n) => n.id === idEfetiva);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Monitor de NFS-e" />
      <main className="flex-1 p-4 lg:p-6 flex gap-4 min-h-0">
        <div className="w-72 shrink-0 card overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-black/5 text-xs font-semibold text-ink-700 flex items-center gap-1.5">
            <Receipt size={13} /> Tentativas de emissão
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-black/5">
            {loading && <div className="p-4 text-xs text-ink-500">Carregando…</div>}
            {!loading && notas.length === 0 && <div className="p-4 text-xs text-ink-500">Nenhuma nota emitida ainda.</div>}
            {notas.map((n) => {
              const st = statusTone[n.status] || statusTone.pendente;
              const Icon = st.icon;
              const dataRef = n.enviadoEm || n.tentadoEm || n.criadoEm?.toDate?.()?.toISOString();
              return (
                <button
                  key={n.id}
                  onClick={() => setSelecionadaId(n.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 focus-ring ${idEfetiva === n.id ? "bg-brand-50" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} className={st.tone.split(" ")[1]} />
                    <span className="text-xs font-medium text-ink-900 truncate">{n.tomador || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.tone}`}>{st.label}</span>
                    <span className="text-[10px] text-ink-500">{dataRef ? new Date(dataRef).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selecionada ? (
            <div className="card p-8 text-center text-sm text-ink-500">Selecione uma tentativa na lista ao lado.</div>
          ) : (
            <DetalheNota nota={selecionada} />
          )}
        </div>
      </main>
    </div>
  );
}

function DetalheNota({ nota }) {
  const st = statusTone[nota.status] || statusTone.pendente;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm font-display font-semibold text-ink-900">{nota.tomador || "—"}</div>
            <div className="text-xs text-ink-500 mt-0.5">
              {nota.valor != null && `R$ ${Number(nota.valor).toFixed(2)} · `}
              Cód. serviço {nota.codigoServico || "—"}
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.tone}`}>{st.label}</span>
        </div>
      </div>

      {nota.resumoResposta && (
        <div className={`card p-4 flex items-start gap-2 ${nota.status === "erro_certificado" ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"}`}>
          <AlertTriangle size={15} className={nota.status === "erro_certificado" ? "text-rose-600 mt-0.5 shrink-0" : "text-amber-600 mt-0.5 shrink-0"} />
          <div>
            <div className="text-xs font-semibold text-ink-900">Resumo automático</div>
            <p className="text-xs text-ink-700 mt-0.5">{nota.resumoResposta}</p>
          </div>
        </div>
      )}

      {nota.erroWebservice && (
        <div className="card p-4 bg-rose-50 border-rose-100">
          <div className="text-xs font-semibold text-rose-700">Erro registrado</div>
          <p className="text-xs text-rose-700 mt-0.5">{nota.erroWebservice}</p>
        </div>
      )}

      {nota.xmlEnviado && <BlocoXml titulo="XML enviado (RPS)" conteudo={nota.xmlEnviado} />}
      {nota.respostaWebservice && <BlocoXml titulo="XML de retorno da Prefeitura" conteudo={nota.respostaWebservice} />}

      {!nota.xmlEnviado && !nota.respostaWebservice && !nota.erroWebservice && (
        <div className="card p-4 text-xs text-ink-500">Essa tentativa ainda não tem XML registrado (pode ser de antes dessa funcionalidade existir, ou ainda está pendente de envio).</div>
      )}
    </div>
  );
}

function BlocoXml({ titulo, conteudo }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(conteudo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/5">
        <span className="text-xs font-semibold text-ink-700">{titulo}</span>
        <button onClick={copiar} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 focus-ring">
          {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="text-[11px] text-ink-700 p-4 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all bg-gray-50/50">{conteudo}</pre>
    </div>
  );
}
