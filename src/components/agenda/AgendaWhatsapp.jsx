import { useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { MessageCircle, FileText, BellRing, Send, CheckCheck, Clock3, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreQuery, useFirestoreCollection, where, orderBy, criarDocumento } from "../../lib/firestore";

const statusMap = {
  confirmado: { label: "Confirmado", tone: "bg-emerald-100 text-emerald-700" },
  agendado: { label: "Aguardando", tone: "bg-amber-100 text-amber-700" },
  faltou: { label: "Faltou", tone: "bg-rose-100 text-rose-700" },
  presente: { label: "Presente", tone: "bg-brand-100 text-brand-700" },
  atendendo: { label: "Atendendo", tone: "bg-brand-100 text-brand-700" },
  cancelado: { label: "Cancelado", tone: "bg-gray-100 text-gray-500" },
};

function inicioFimHoje() {
  const ini = new Date(); ini.setHours(0, 0, 0, 0);
  const fim = new Date(); fim.setHours(23, 59, 59, 999);
  return [Timestamp.fromDate(ini), Timestamp.fromDate(fim)];
}

/** Normaliza um telefone brasileiro para o formato que o wa.me espera:
 * só dígitos, com código do país (55) na frente. */
function paraFormatoWhatsapp(telefone) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("55") && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

function montarMensagem(ag, tipo) {
  const dataHora = ag.dataHora?.toDate?.();
  const dataFmt = dataHora ? dataHora.toLocaleDateString("pt-BR") : "";
  const horaFmt = dataHora ? dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const primeiroNome = (ag.pacienteNome || "").split(" ")[0];

  if (tipo === "formulario") {
    return `Olá, ${primeiroNome}! Para agilizar sua consulta do dia ${dataFmt} às ${horaFmt}, pedimos que preencha o formulário de anamnese que enviaremos em seguida. Qualquer dúvida, estamos à disposição.`;
  }
  return `Olá, ${primeiroNome}! Passando para lembrar da sua consulta marcada para ${dataFmt} às ${horaFmt}. Poderia confirmar sua presença respondendo esta mensagem? Obrigado!`;
}

export default function AgendaWhatsapp() {
  const { clinicaId, profissionalId } = useTenant();
  const [inicio, fim] = useMemo(() => inicioFimHoje(), []);
  const [erro, setErro] = useState("");

  const { data: rows, loading } = useFirestoreQuery(
    clinicaId ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("profissionalId", "==", profissionalId), where("dataHora", ">=", inicio), where("dataHora", "<", fim), orderBy("dataHora", "asc")],
    [profissionalId, inicio, fim]
  );

  const { data: log } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/notificacoes` : null, "criadoEm", "desc");

  async function enviarWhatsapp(ag, tipo) {
    setErro("");
    const numero = paraFormatoWhatsapp(ag.pacienteTelefone);
    if (!numero) {
      setErro(`${ag.pacienteNome} não tem telefone cadastrado — edite o paciente para adicionar um número antes de enviar.`);
      return;
    }
    const mensagem = montarMensagem(ag, tipo);
    // wa.me abre o WhatsApp com a mensagem pronta — o envio em si ainda
    // precisa de um clique manual dentro do WhatsApp (não é uma API de
    // envio automático; ver observação na tela).
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");

    await criarDocumento(`clinicas/${clinicaId}/notificacoes`, {
      tipo,
      pacienteId: ag.pacienteId,
      pacienteNome: ag.pacienteNome,
      canal: "whatsapp_link",
      texto: `Link do WhatsApp aberto para ${ag.pacienteNome} (${tipo === "formulario" ? "formulário" : "lembrete"}) — envio precisa ser confirmado manualmente.`,
    });
  }

  const confirmedCount = rows.filter((r) => r.status === "confirmado" || r.status === "presente").length;

  return (
    <div className="space-y-4">
      <div className="card p-3.5 bg-amber-50/60 border-amber-100 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          <span className="font-semibold">Envio assistido, não automático:</span> os botões abaixo abrem o WhatsApp com a mensagem já pronta — falta só clicar em enviar lá dentro. Confirmação automática de entrega/leitura exige uma API oficial (BSP), que pode entrar depois se fizer sentido.
        </p>
      </div>

      {erro && (
        <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={CheckCheck} label="Confirmações hoje" value={confirmedCount} tone="bg-emerald-50 text-emerald-600" />
        <Stat icon={BellRing} label="Consultas de hoje" value={rows.length} tone="bg-brand-50 text-brand-600" />
        <Stat icon={Clock3} label="Links abertos (log)" value={log.length} tone="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
            <span className="text-sm font-display font-semibold text-ink-900">Consultas de hoje</span>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">Nenhum agendamento hoje.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500 border-b border-black/5">
                  <Th>Horário</Th><Th>Paciente</Th><Th>Status</Th><Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 last:border-0">
                    <Td className="font-semibold">{r.dataHora?.toDate ? r.dataHora.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</Td>
                    <Td>{r.pacienteNome}</Td>
                    <Td><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusMap[r.status]?.tone || "bg-gray-100 text-gray-500"}`}>{statusMap[r.status]?.label || r.status}</span></Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <button onClick={() => enviarWhatsapp(r, "lembrete")} title="Abrir lembrete no WhatsApp" className="flex items-center gap-1 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 focus-ring">
                          <Send size={13} /><ExternalLink size={10} />
                        </button>
                        <button onClick={() => enviarWhatsapp(r, "formulario")} title="Abrir aviso de formulário no WhatsApp" className="flex items-center gap-1 p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 focus-ring">
                          <FileText size={13} /><ExternalLink size={10} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={16} className="text-emerald-500" />
            <span className="text-sm font-display font-semibold text-ink-900">Log de envios</span>
          </div>
          <p className="text-xs text-ink-500 mb-3">Cada clique nos botões ao lado registra aqui — mas é o link que foi aberto, não a confirmação de que a mensagem saiu.</p>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-64">
            {log.length === 0 && (
              <div className="text-xs text-ink-500 border border-dashed border-black/10 rounded-lg p-3 text-center">
                Nenhum link aberto ainda. Use os botões na tabela ao lado.
              </div>
            )}
            {log.slice(0, 20).map((l) => (
              <div key={l.id} className="text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 flex items-start gap-2 animate-slideIn">
                <CheckCheck size={13} className="mt-0.5 shrink-0" /> {l.texto}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon size={18} /></div>
      <div>
        <div className="text-lg font-display font-bold text-ink-900 leading-none">{value}</div>
        <div className="text-[11px] text-ink-500 mt-1">{label}</div>
      </div>
    </div>
  );
}
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px]">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
