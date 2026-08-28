// Helpers de WhatsApp compartilhados entre a tela de Confirmações
// (AgendaWhatsapp.jsx) e o modal de agendamento da Agenda — extraídos daqui
// pra não duplicar a normalização de telefone/mensagem em dois lugares.

/** Normaliza um telefone brasileiro para o formato que o wa.me espera:
 * só dígitos, com código do país (55) na frente. */
export function paraFormatoWhatsapp(telefone) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("55") && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

/** Monta a mensagem de lembrete/confirmação de consulta a partir de um
 * agendamento (precisa de `dataHora`, `pacienteNome`). */
export function montarMensagemConfirmacao(ag) {
  const dataHora = ag.dataHora?.toDate?.();
  const dataFmt = dataHora ? dataHora.toLocaleDateString("pt-BR") : "";
  const horaFmt = dataHora ? dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const primeiroNome = (ag.pacienteNome || "").split(" ")[0];
  return `Olá, ${primeiroNome}! Passando para lembrar da sua consulta marcada para ${dataFmt} às ${horaFmt}. Poderia confirmar sua presença respondendo esta mensagem? Obrigado!`;
}

/** Monta a mensagem de aviso de formulário de anamnese. */
export function montarMensagemFormulario(ag) {
  const dataHora = ag.dataHora?.toDate?.();
  const dataFmt = dataHora ? dataHora.toLocaleDateString("pt-BR") : "";
  const horaFmt = dataHora ? dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const primeiroNome = (ag.pacienteNome || "").split(" ")[0];
  return `Olá, ${primeiroNome}! Para agilizar sua consulta do dia ${dataFmt} às ${horaFmt}, pedimos que preencha o formulário de anamnese que enviaremos em seguida. Qualquer dúvida, estamos à disposição.`;
}

/** Abre o WhatsApp Web/App com a mensagem já pronta para o número informado.
 * Não é uma API de envio automático — ainda precisa de um clique manual
 * dentro do WhatsApp para efetivamente enviar. */
export function abrirLinkWhatsapp(telefone, mensagem) {
  const numero = paraFormatoWhatsapp(telefone);
  if (!numero) return false;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  return true;
}
