export const currentUser = {
  name: "Jessica Diniz",
  status: "Disponível",
  initials: "JD",
};

export const patient = {
  name: "Mario Acca",
  age: 46,
  birth: "31/03/1978",
  sex: "Masculino",
  cpf: "214.070.728-11",
  idCode: "672",
  convenio: "UNIMED",
  photo: null,
  allergies: true,
};

export const queixaEntries = [
  {
    date: "08/08/2024",
    time: "13:20",
    author: "Jessica Gabriela Diniz",
    text: "",
    aiGenerated: false,
  },
  {
    date: "17/07/2024",
    time: "23:47",
    author: "Jessica Gabriela Diniz",
    text: "Pápulas descamativas amarelo-avermelhadas ao longo da linha do cabelo, atrás das orelhas, nas sobrancelhas, nas dobras nasolabiais e ao longo do esterno.",
    aiGenerated: true,
  },
  {
    date: "11/07/2024",
    time: "17:25",
    author: "Jessica Gabriela Diniz",
    text: "Paciente relata coceira leve, sem piora nos últimos dias.",
    aiGenerated: false,
  },
  {
    date: "11/07/2024",
    time: "07:16",
    author: "Jessica Gabriela Diniz",
    text: "Pápulas descamativas amarelo-avermelhadas ao longo da linha do cabelo, atrás das orelhas, nas sobrancelhas, nas dobras nasolabiais e ao longo do esterno.",
    aiGenerated: true,
  },
];

export const favoritesChips = ["Dermatite seborreica", "Micoses", "Rosácea"];

export const problemsList = [
  { date: "04/07/2024", prof: "JESSICA GABRIELA", cid: "I49", desc: "Outr Arritmias Cardíacas", grau: "SEM CLASSIFICAÇÃO", obs: "Atendimento homologação", ativo: false },
  { date: "17/06/2024", prof: "JESSICA GABRIELA", cid: "Z720", desc: "Uso Do Tabaco", grau: "SEM CLASSIFICAÇÃO", obs: "Atendimento homologação", ativo: false },
  { date: "30/04/2024", prof: "JESSICA GABRIELA", cid: "L600", desc: "Unha Encravada", grau: "SEM CLASSIFICAÇÃO", obs: "", ativo: false },
  { date: "09/04/2024", prof: "JESSICA GABRIELA", cid: "I10", desc: "Hipertensão Essencial", grau: "MODERADA", obs: "", ativo: false },
  { date: "09/04/2024", prof: "JESSICA GABRIELA", cid: "I49", desc: "Outr Arritmias Cardíacas", grau: "LEVE", obs: "", ativo: false },
  { date: "09/04/2024", prof: "JESSICA GABRIELA", cid: "Z720", desc: "Uso Do Tabaco", grau: "SEM CLASSIFICAÇÃO", obs: "", ativo: false },
];

export const problemChips = ["Uso Do Tabaco", "Outr Arritmias Cardíacas", "Hipertensão Essencial", "Obesidade", "Diabetes Mellitus Insulino-Dependente"];

export const vitalsHistory = [
  { date: "Fev", imc: 31.94 },
  { date: "Mar", imc: 33.73 },
  { date: "Mai", imc: 28.1 },
  { date: "Jun", imc: 22.20 },
  { date: "Jul", imc: 23.55 },
];

export const agendaPorPeriodo = [
  { name: "Agendado", value: 4, color: "#2563eb" },
  { name: "Presente", value: 1, color: "#0ea5b7" },
  { name: "Faltou", value: 1, color: "#ef4444" },
  { name: "Atendido", value: 3, color: "#16a34a" },
  { name: "Cancelou", value: 2, color: "#a855f7" },
  { name: "Confirmado", value: 1, color: "#f59e0b" },
  { name: "Atendendo", value: 10, color: "#94a3b8" },
];

export const ocupacaoPorPeriodo = [
  { periodo: "02/2026", ocupacao: 94, vazio: 6 },
  { periodo: "01/2026", ocupacao: 62, vazio: 38 },
  { periodo: "12/2025", ocupacao: 30, vazio: 70 },
  { periodo: "11/2025", ocupacao: 30, vazio: 70 },
  { periodo: "10/2025", ocupacao: 37, vazio: 63 },
];

export const agendaHoje = [
  { time: "08:00", patient: "Mario Acca", status: "confirmado", channel: "WhatsApp", convenio: "UNIMED" },
  { time: "09:00", patient: "Fernanda Lopes", status: "aguardando", channel: "WhatsApp", convenio: "Particular" },
  { time: "09:30", patient: "Renato Souza", status: "faltou", channel: "SMS", convenio: "BRADESCO" },
  { time: "10:15", patient: "Carla Mendes", status: "confirmado", channel: "WhatsApp", convenio: "SULAMÉRICA" },
  { time: "11:00", patient: "Igor Tavares", status: "presente", channel: "WhatsApp", convenio: "UNIMED" },
];

export const transcriptScript = [
  { speaker: "Médico", text: "Bom dia, Mario. Como você está se sentindo essa semana?" },
  { speaker: "Paciente", text: "Bom dia, doutora. Estou com uma coceira leve no couro cabeludo e atrás das orelhas." },
  { speaker: "Médico", text: "Desde quando você notou essas lesões?" },
  { speaker: "Paciente", text: "Faz uns dez dias, mais ou menos. Piora um pouco quando eu transpiro." },
  { speaker: "Médico", text: "Vou examinar a região. Notei pápulas descamativas amarelo-avermelhadas na linha do cabelo e nas sobrancelhas." },
  { speaker: "Paciente", text: "Isso mesmo, e também sinto um pouco nas dobras perto do nariz." },
  { speaker: "Médico", text: "Isso é compatível com dermatite seborreica. Vamos ajustar o tratamento tópico." },
];

export const examFavorites = [
  "Glicemia após sobrecarga com dextrosol ou glicos...",
  "Colesterol (LDL) - pesquisa e/ou dosagem",
  "Colesterol (HDL) - pesquisa e/ou dosagem",
  "ECG convencional de até 12 derivações",
  "Hipoglicemia - tratamento cirúrgico (pancreatecto...",
];

export const examHistory = [
  { date: "04/07/2024 06:48", exam: "Glicemia após sobrecarga com dextrosol ou glicose - pesquisa e/ou dosagem", qtd: 1, valor: 0, realizado: "04/07/2024", resultado: "", laudo: true },
  { date: "17/06/2024 23:29", exam: "Glicemia após sobrecarga com dextrosol ou glicose - pesquisa e/ou dosagem", qtd: 1, valor: 0, realizado: "17/06/2024", resultado: "", laudo: true },
  { date: "13/05/2024 06:51", exam: "Glicemia em jejum", qtd: 1, valor: 0, realizado: "", resultado: "", laudo: false },
  { date: "13/05/2024 06:51", exam: "Hemograma completo", qtd: 1, valor: 0, realizado: "", resultado: "", laudo: false },
  { date: "13/05/2024 06:51", exam: "Colesterol esterificado", qtd: 1, valor: 0, realizado: "", resultado: "", laudo: false },
  { date: "06/05/2024 14:04", exam: "Glicemia em jejum", qtd: 1, valor: 0, realizado: "", resultado: "", laudo: false },
  { date: "06/05/2024 14:04", exam: "Hemograma completo", qtd: 1, valor: 0, realizado: "", resultado: "", laudo: false },
  { date: "06/05/2024 14:04", exam: "Colesterol esterificado", qtd: 1, valor: 0, realizado: "", resultado: "", laudo: false },
];

export const condutaFavorites = ["Repouso relativo", "Retorno em 30 dias", "Encaminhar dermatologia", "Orientações gerais"];
export const condutaHistory = [
  { date: "11/07/2024 17:30", author: "Jessica Gabriela Diniz", text: "Ajuste de tratamento tópico para dermatite seborreica. Retorno em 30 dias para reavaliação." },
  { date: "09/04/2024 10:12", author: "Jessica Gabriela Diniz", text: "Orientação sobre cessação do tabagismo. Encaminhado para acompanhamento nutricional." },
];

export const prescricoes = [
  { data: "11/07/2024", medicamento: "Cetoconazol xampu 2%", posologia: "Aplicar 3x por semana por 4 semanas", memed: true, status: "Enviada ao paciente" },
  { data: "09/04/2024", medicamento: "Losartana Potássica 50mg", posologia: "1 comprimido pela manhã, uso contínuo", memed: true, status: "Enviada ao paciente" },
  { data: "17/06/2024", medicamento: "Sinvastatina 20mg", posologia: "1 comprimido à noite", memed: true, status: "Retirada na farmácia" },
];

export const encaminhamentos = [
  { data: "09/04/2024", especialidade: "Cardiologia", motivo: "Avaliação de arritmia cardíaca leve", status: "Agendado" },
  { data: "17/06/2024", especialidade: "Nutrição", motivo: "Acompanhamento nutricional - cessação do tabagismo", status: "Realizado" },
];

export const formulariosDisponiveis = [
  { nome: "Anamnese Dermatológica", campos: 12, uso: "Alto" },
  { nome: "Questionário de Qualidade de Vida (DLQI)", campos: 10, uso: "Médio" },
  { nome: "Triagem Pré-Consulta", campos: 8, uso: "Alto" },
  { nome: "Avaliação de Risco Cardiovascular", campos: 15, uso: "Baixo" },
];

export const contasPagar = [
  { desc: "Aluguel da clínica", venc: "20/07/2026", valor: "R$ 4.200,00", status: "pendente" },
  { desc: "Fornecedor de insumos", venc: "18/07/2026", valor: "R$ 890,00", status: "pendente" },
  { desc: "Energia elétrica", venc: "15/07/2026", valor: "R$ 610,00", status: "pago" },
];
export const contasReceber = [
  { desc: "UNIMED - lote 07/2026", venc: "25/07/2026", valor: "R$ 8.400,00", status: "pendente" },
  { desc: "Particular - Mario Acca", venc: "14/07/2026", valor: "R$ 350,00", status: "pago" },
  { desc: "BRADESCO SAÚDE - lote 06/2026", venc: "10/07/2026", valor: "R$ 5.150,00", status: "pago" },
];

export const faturamentoPorConvenio = [
  { name: "UNIMED", value: 18400 },
  { name: "BRADESCO", value: 9200 },
  { name: "SULAMÉRICA", value: 6100 },
  { name: "Particular", value: 4800 },
];

export const metaAtendimento = { meta: 160, realizado: 121 };

export const avaliacaoPaciente = [
  { criterio: "Atendimento médico", nota: 4.8 },
  { criterio: "Tempo de espera", nota: 4.2 },
  { criterio: "Clareza nas orientações", nota: 4.9 },
  { criterio: "Estrutura da clínica", nota: 4.5 },
];

export const historicoConsultas = [
  {
    date: "17/07/2024",
    tipo: "Consulta",
    author: "Jessica Gabriela Diniz",
    queixa: "Prurido leve em couro cabeludo e retroauricular.",
    conduta: "Ajuste de tratamento tópico para dermatite seborreica.",
  },
  {
    date: "09/04/2024",
    tipo: "Consulta",
    author: "Jessica Gabriela Diniz",
    queixa: "Acompanhamento de hipertensão essencial e uso de tabaco.",
    conduta: "Orientação sobre cessação do tabagismo, ajuste de anti-hipertensivo.",
  },
  {
    date: "30/04/2024",
    tipo: "Procedimento",
    author: "Jessica Gabriela Diniz",
    queixa: "Unha encravada em hálux direito.",
    conduta: "Realizada cauterização parcial da matriz ungueal.",
  },
  {
    date: "17/06/2024",
    tipo: "Retorno",
    author: "Jessica Gabriela Diniz",
    queixa: "Retorno para avaliação de exames de rotina.",
    conduta: "Solicitado novo perfil lipídico e glicemia de jejum.",
  },
];

export const exameFisicoSistemas = [
  { sistema: "Estado geral", texto: "Bom estado geral, corado, hidratado, eupneico, afebril." },
  { sistema: "Pele e fâneros", texto: "Pápulas descamativas amarelo-avermelhadas na linha do cabelo, retroauricular e sobrancelhas." },
  { sistema: "Cabeça e pescoço", texto: "Sem linfonodomegalias palpáveis. Tireoide não palpável." },
  { sistema: "Aparelho cardiovascular", texto: "Ritmo cardíaco regular em 2 tempos, bulhas normofonéticas, sem sopros." },
  { sistema: "Aparelho respiratório", texto: "Murmúrio vesicular presente bilateralmente, sem ruídos adventícios." },
  { sistema: "Abdômen", texto: "Plano, flácido, indolor à palpação, sem visceromegalias." },
  { sistema: "Membros", texto: "Sem edemas, panturrilhas livres, pulsos periféricos presentes." },
];

export const exameFisicoFavoritos = ["Normocárdico, sem sopros", "Abdômen plano e indolor", "Ausculta pulmonar limpa", "Sem edemas em MMII"];

export const alergiasList = [
  { data: "09/04/2024", tipo: "Medicamentosa", agente: "Dipirona", reacao: "Urticária", grau: "MODERADA", ativo: true },
  { data: "17/06/2024", tipo: "Alimentar", agente: "Camarão / frutos do mar", reacao: "Edema labial", grau: "SEVERA", ativo: true },
  { data: "11/07/2024", tipo: "Ambiental", agente: "Poeira / ácaros", reacao: "Rinite alérgica", grau: "LEVE", ativo: true },
  { data: "30/04/2024", tipo: "Medicamentosa", agente: "Penicilina", reacao: "Suspeita não confirmada", grau: "SEM CLASSIFICAÇÃO", ativo: false },
];

export const imagensList = [
  { titulo: "Lesão couro cabeludo", data: "17/07/2024", categoria: "Dermatologia", tag: "Dermatite seborreica" },
  { titulo: "ECG 12 derivações", data: "04/07/2024", categoria: "Exame", tag: "Cardiologia" },
  { titulo: "Raio-X tórax PA", data: "13/05/2024", categoria: "Exame de imagem", tag: "Rotina" },
  { titulo: "Lesão retroauricular", data: "11/07/2024", categoria: "Dermatologia", tag: "Acompanhamento" },
  { titulo: "Laudo hemograma completo", data: "13/05/2024", categoria: "Documento", tag: "Laboratorial" },
  { titulo: "Unha hálux direito", data: "30/04/2024", categoria: "Procedimento", tag: "Pós-operatório" },
];

export const agendaKpis = {
  pacientes: 3,
  ocupacao: "15.00%",
  faltas: 1,
  previsaoSaida: "09:30",
  salaEspera: 1,
};

export const agendaGrid = [
  { hora: "08:00", nome: "MARIO ACCA", obs: "", chegada: "08:37", convenio: "UNIMED", tipo: "CONSULTA", situacao: "atendendo" },
  { hora: "08:30", nome: "JESSICA GABRIELA DINIZ", obs: "", chegada: "10:21", convenio: "UNIMED", tipo: "CONSULTA", situacao: "presente" },
  { hora: "09:00", nome: "MARIA FERNANDA DA SILVA", obs: "", chegada: "13:21", convenio: "UNIMED", tipo: "CONSULTA", situacao: "faltou" },
  { hora: "09:30", nome: "", obs: "", chegada: "", convenio: "", tipo: "", situacao: "livre" },
  { hora: "10:00", nome: "", obs: "", chegada: "", convenio: "", tipo: "", situacao: "livre" },
  { hora: "10:30", nome: "", obs: "", chegada: "", convenio: "", tipo: "", situacao: "livre" },
  { hora: "11:00", nome: "", obs: "", chegada: "", convenio: "", tipo: "", situacao: "livre" },
];

export const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export const horariosCadastrados = [
  { dia: "Domingo", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
  { dia: "Segunda-feira", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
  { dia: "Terça-feira", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
  { dia: "Quarta-feira", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
  { dia: "Quinta-feira", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
  { dia: "Sexta-feira", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
  { dia: "Sábado", primeira: "08:00", ultima: "18:00", inicioIntervalo: "--:--", fimIntervalo: "--:--", tempo: "00:30", ativo: true, clinica: "TESTE CLINICA DINIZ" },
];

export const aiSuggestions = [
  { type: "problema", label: "Adicionar Dermatite Seborreica (L21) aos problemas ativos", confidence: 0.94 },
  { type: "conduta", label: "Prescrever Cetoconazol xampu 2% — uso 3x/semana", confidence: 0.88 },
  { type: "exame", label: "Solicitar avaliação dermatológica de retorno em 30 dias", confidence: 0.81 },
  { type: "alerta", label: "Paciente tabagista — considerar orientação de cessação", confidence: 0.76 },
];
