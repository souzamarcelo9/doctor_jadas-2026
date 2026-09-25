// Helpers de geração/leitura de horários de agenda — usados pela grade do
// dia (AgendaGrid), pela Busca avançada de horários e pelo Encaixe. Ficavam
// duplicados dentro de AgendaGrid.jsx; centralizados aqui para as duas telas
// calcularem os mesmos slots a partir do mesmo `horariosTrabalho` do membro.

export const diasSemanaChave = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

export function minutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function paraHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Gera os horários de um dia de trabalho (`clinicas/{id}/membros/{uid}.horariosTrabalho[i]`),
 * já descontando o intervalo. */
export function gerarSlots(horarioDia) {
  if (!horarioDia || !horarioDia.ativo) return [];
  const inicio = minutos(horarioDia.primeiraConsulta);
  const fim = minutos(horarioDia.ultimaConsulta);
  const passo = minutos(horarioDia.tempoConsulta || "00:30");
  const intInicio = horarioDia.inicioIntervalo && horarioDia.inicioIntervalo !== "--:--" ? minutos(horarioDia.inicioIntervalo) : null;
  const intFim = horarioDia.fimIntervalo && horarioDia.fimIntervalo !== "--:--" ? minutos(horarioDia.fimIntervalo) : null;
  const slots = [];
  for (let t = inicio; t < fim; t += passo || 30) {
    if (intInicio !== null && t >= intInicio && t < intFim) continue;
    slots.push(paraHHMM(t));
  }
  return slots;
}

/** Gera os horários que caem DENTRO do intervalo/almoço cadastrado pro dia,
 * no mesmo passo dos slots de consulta — usado só pra desenhar a faixa de
 * intervalo na grade da Agenda (AgendaGrid), já que `gerarSlots` acima
 * propositalmente descarta esse período (ele é pra horários disponíveis
 * pra agendar, não pra exibição). Sem isso a grade ficava em branco no
 * horário de almoço, sem indicar que ali é intervalo e não "sem cadastro". */
export function gerarSlotsIntervalo(horarioDia) {
  if (!horarioDia || !horarioDia.ativo) return [];
  const intInicio = horarioDia.inicioIntervalo && horarioDia.inicioIntervalo !== "--:--" ? minutos(horarioDia.inicioIntervalo) : null;
  const intFim = horarioDia.fimIntervalo && horarioDia.fimIntervalo !== "--:--" ? minutos(horarioDia.fimIntervalo) : null;
  if (intInicio === null || intFim === null || intFim <= intInicio) return [];
  const passo = minutos(horarioDia.tempoConsulta || "00:30") || 30;
  const slots = [];
  for (let t = intInicio; t < intFim; t += passo) slots.push(paraHHMM(t));
  return slots;
}

/** Classifica um horário "HH:MM" em manhã/tarde/noite — usado pelo filtro de
 * período tanto na Busca avançada quanto na Lista de espera. */
export function periodoDoHorario(hhmm) {
  const m = minutos(hhmm);
  if (m < 12 * 60) return "manha";
  if (m < 18 * 60) return "tarde";
  return "noite";
}

export function paraISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}