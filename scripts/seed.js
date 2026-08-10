/**
 * Popula uma clínica de teste no Firestore com os mesmos dados que hoje
 * vivem em src/data/mockData.js — serve para comparar, tela por tela, se a
 * migração de cada aba do protótipo para dados reais ficou equivalente.
 *
 * Como rodar:
 *   1. Baixe a chave de conta de serviço em:
 *      Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada
 *   2. Salve o arquivo como `serviceAccountKey.json` na raiz do projeto (já está no .gitignore)
 *   3. npm run seed
 *
 * O script é idempotente-ish: usa IDs fixos para clínica/paciente/profissional,
 * então rodar de novo apenas sobrescreve os mesmos documentos (não duplica).
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const CLINICA_ID = "teste-clinica-diniz";
const PACIENTE_ID = "mario-acca";
const PROFISSIONAL_EMAIL = "jessica@testeclinicadiniz.com.br";
const PROFISSIONAL_SENHA = "Doutor123!";

const ts = (isoString) => Timestamp.fromDate(new Date(isoString));
const agora = Timestamp.now();

async function garantirUsuarioAuth() {
  try {
    const existente = await auth.getUserByEmail(PROFISSIONAL_EMAIL);
    console.log(`Usuário já existia: ${existente.uid}`);
    return existente.uid;
  } catch {
    const novo = await auth.createUser({
      email: PROFISSIONAL_EMAIL,
      password: PROFISSIONAL_SENHA,
      displayName: "Jessica Gabriela Diniz",
    });
    console.log(`Usuário criado: ${novo.uid} (senha: ${PROFISSIONAL_SENHA})`);
    return novo.uid;
  }
}

async function seed() {
  const uid = await garantirUsuarioAuth();

  // Custom claim com os IDs das clínicas — é isso que o app usa no login para
  // descobrir em quais clínicas o usuário atua, sem precisar de uma consulta
  // Firestore (collectionGroup) logo na primeira tela.
  await auth.setCustomUserClaims(uid, { clinicas: [CLINICA_ID] });
  console.log(`Custom claim definido: clinicas=[${CLINICA_ID}]`);

  // ---------- usuarios/{uid} ----------
  await db.doc(`usuarios/${uid}`).set({
    nome: "Jessica Gabriela Diniz",
    email: PROFISSIONAL_EMAIL,
    telefone: "(11) 90000-0000",
    criadoEm: agora,
    clinicasVinculadas: [CLINICA_ID],
  });

  // ---------- clinicas/{clinicaId} ----------
  await db.doc(`clinicas/${CLINICA_ID}`).set({
    nome: "Teste Clínica Diniz",
    cnpj: "00.000.000/0001-00",
    endereco: { cidade: "São Paulo", uf: "SP" },
    configuracoes: { modoExibicaoPadrao: "horizontal", tempoConsultaPadrao: 30, metaAtendimentoMensal: 120 },
    integracoes: {
      nfse: { certificadoConfigurado: false, ambiente: "homologacao" },
      whatsapp: { bspProvider: "", numeroConectado: "", ativo: false },
      memed: { tokenConfigurado: false },
    },
    criadoEm: agora,
    ativa: true,
  });

  // ---------- clinicas/{clinicaId}/membros/{uid} ----------
  const diasSemana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  await db.doc(`clinicas/${CLINICA_ID}/membros/${uid}`).set({
    uid,
    nome: "Jessica Gabriela Diniz",
    clinicaNome: "Teste Clínica Diniz",
    papel: "medico",
    especialidade: "Dermatologia",
    crm: "CRM-SP 000000",
    corAgenda: "#178a8c",
    ativo: true,
    horariosTrabalho: diasSemana.map((dia) => ({
      dia,
      primeiraConsulta: "08:00",
      ultimaConsulta: "18:00",
      inicioIntervalo: null,
      fimIntervalo: null,
      tempoConsulta: "00:30",
      ativo: true,
    })),
    favoritos: {
      queixa: ["Dermatite seborreica", "Micoses", "Rosácea"],
      conduta: ["Repouso relativo", "Retorno em 30 dias", "Encaminhar dermatologia", "Orientações gerais"],
      exameFisico: ["Normocárdico, sem sopros", "Abdômen plano e indolor", "Ausculta pulmonar limpa"],
    },
    vinculadoEm: agora,
  });

  // ---------- clinicas/{clinicaId}/convenios ----------
  const convenios = ["UNIMED", "BRADESCO", "SULAMÉRICA", "Particular"];
  for (const nome of convenios) {
    await db.collection(`clinicas/${CLINICA_ID}/convenios`).doc(nome.toLowerCase().replace(/[^a-z]/g, "")).set({ nome, ativo: true });
  }

  // ---------- clinicas/{clinicaId}/formularios (templates) ----------
  const formularios = [
    { nome: "Anamnese Dermatológica", campos: 12, uso: "Alto" },
    { nome: "Questionário de Qualidade de Vida (DLQI)", campos: 10, uso: "Médio" },
    { nome: "Triagem Pré-Consulta", campos: 8, uso: "Alto" },
    { nome: "Avaliação de Risco Cardiovascular", campos: 15, uso: "Baixo" },
  ];
  for (const f of formularios) {
    await db.collection(`clinicas/${CLINICA_ID}/formularios`).add(f);
  }

  // ---------- paciente ----------
  await db.doc(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}`).set({
    nome: "Mario Acca",
    nascimento: ts("1978-03-31"),
    sexo: "Masculino",
    cpf: "214.070.728-11",
    convenioId: "unimed",
    telefone: "(11) 98888-0000",
    alergiasResumo: true,
    criadoEm: agora,
    criadoPor: uid,
  });

  // ---------- atendimento de referência ----------
  const atendimentoRef = db.collection(`clinicas/${CLINICA_ID}/atendimentos`).doc();
  await atendimentoRef.set({
    clinicaId: CLINICA_ID,
    pacienteId: PACIENTE_ID,
    profissionalId: uid,
    dataHora: ts("2024-07-17T17:25:00-03:00"),
    status: "finalizado",
    duracaoSegundos: 620,
    convenioId: "unimed",
    origem: "presencial",
  });
  const atendimentoId = atendimentoRef.id;

  const prontuarioBase = (extra) => ({
    atendimentoId,
    profissionalId: uid,
    origemIA: false,
    ativo: true,
    ...extra,
  });

  // ---------- prontuario/queixas ----------
  const queixaTexto = "Pápulas descamativas amarelo-avermelhadas ao longo da linha do cabelo, atrás das orelhas, nas sobrancelhas, nas dobras nasolabiais e ao longo do esterno.";
  await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/queixas`).add(
    prontuarioBase({
      texto: queixaTexto,
      origemIA: true,
      criadoEm: ts("2024-07-17T23:47:00-03:00"),
    })
  );

  // ---------- prontuario/problemas ----------
  const problemas = [
    { cid: "I49", descricao: "Outr Arritmias Cardíacas", grau: "LEVE", data: "2024-04-09T00:00:00-03:00" },
    { cid: "I10", descricao: "Hipertensão Essencial", grau: "MODERADA", data: "2024-04-09T00:00:00-03:00" },
    { cid: "Z720", descricao: "Uso Do Tabaco", grau: "SEM CLASSIFICAÇÃO", data: "2024-04-09T00:00:00-03:00" },
  ];
  for (const p of problemas) {
    await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/problemas`).add(
      prontuarioBase({ cid: p.cid, descricao: p.descricao, grau: p.grau, observacao: "", criadoEm: ts(p.data) })
    );
  }

  // ---------- prontuario/alergias ----------
  const alergias = [
    { tipo: "Medicamentosa", agente: "Dipirona", reacao: "Urticária", grau: "MODERADA", data: "2024-04-09T00:00:00-03:00" },
    { tipo: "Alimentar", agente: "Camarão / frutos do mar", reacao: "Edema labial", grau: "SEVERA", data: "2024-06-17T00:00:00-03:00" },
    { tipo: "Ambiental", agente: "Poeira / ácaros", reacao: "Rinite alérgica", grau: "LEVE", data: "2024-07-11T00:00:00-03:00" },
  ];
  for (const a of alergias) {
    await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/alergias`).add(
      prontuarioBase({ tipo: a.tipo, agente: a.agente, reacao: a.reacao, grau: a.grau, criadoEm: ts(a.data) })
    );
  }

  // ---------- prontuario/sinaisVitais ----------
  await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/sinaisVitais`).add(
    prontuarioBase({ peso: 82, altura: 1.78, imc: 23.55, pulso: 72, temperatura: 36.5, criadoEm: ts("2024-07-17T17:25:00-03:00") })
  );

  // ---------- prontuario/condutas ----------
  const condutaTexto = "Ajuste de tratamento tópico para dermatite seborreica. Retorno em 30 dias para reavaliação.";
  await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/condutas`).add(
    prontuarioBase({
      texto: condutaTexto,
      criadoEm: ts("2024-07-11T17:30:00-03:00"),
    })
  );

  // Espelha o mesmo resumo que a Queixa/Conduta salvam no app real, para a
  // aba Histórico já mostrar algo coerente logo após o seed.
  await atendimentoRef.update({ queixaResumo: queixaTexto, condutaResumo: condutaTexto });

  // ---------- prontuario/prescricoes ----------
  await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/prescricoes`).add(
    prontuarioBase({
      medicamento: "Cetoconazol xampu 2%",
      posologia: "Aplicar 3x por semana por 4 semanas",
      memedId: null,
      criadoEm: ts("2024-07-11T17:30:00-03:00"),
    })
  );

  // ---------- prontuario/examesSolicitados ----------
  await db.collection(`clinicas/${CLINICA_ID}/pacientes/${PACIENTE_ID}/examesSolicitados`).add(
    prontuarioBase({
      exame: "Glicemia após sobrecarga com dextrosol ou glicose - pesquisa e/ou dosagem",
      qtd: 1,
      valor: 0,
      realizado: ts("2024-07-04T06:48:00-03:00"),
      resultado: "",
      criadoEm: ts("2024-07-04T06:48:00-03:00"),
    })
  );

  // ---------- agendamentos de hoje ----------
  // "Livre" nunca vira documento — no app real, um horário livre é simplesmente
  // a ausência de um agendamento naquele slot (ver AgendaGrid). Por isso o
  // seed só cria os 3 horários realmente ocupados.

  // Limpeza: como `.add()` sempre cria um documento novo, rodar o seed várias
  // vezes sem isso empilha duplicatas a cada execução (inclusive de dias
  // anteriores, que ainda contam no gráfico "Agenda por status" do mês).
  // Removemos todos os agendamentos deste profissional antes de recriar.
  const agendamentosAntigos = await db.collection(`clinicas/${CLINICA_ID}/agendamentos`).where("profissionalId", "==", uid).get();
  for (const d of agendamentosAntigos.docs) await d.ref.delete();
  if (!agendamentosAntigos.empty) console.log(`Removidos ${agendamentosAntigos.size} agendamento(s) de rodadas anteriores do seed.`);

  const hoje = new Date();
  const agendamentosHoje = [
    { hora: "08:00", status: "atendendo" },
    { hora: "08:30", status: "presente" },
    { hora: "09:00", status: "faltou" },
  ];
  for (const ag of agendamentosHoje) {
    const [h, m] = ag.hora.split(":").map(Number);
    const dataHora = new Date(hoje);
    dataHora.setHours(h, m, 0, 0);
    await db.collection(`clinicas/${CLINICA_ID}/agendamentos`).add({
      profissionalId: uid,
      pacienteId: PACIENTE_ID,
      pacienteNome: "Mario Acca",
      dataHora: Timestamp.fromDate(dataHora),
      duracaoMinutos: 30,
      status: ag.status,
      convenioId: "unimed",
      convenioNome: "UNIMED",
      tipoAtendimento: "CONSULTA",
    });
  }

  // ---------- financeiro: contas a pagar/receber ----------
  const contasReceber = [
    { descricao: "UNIMED - lote 07/2026", vencimento: "2026-07-25", valor: 8400, convenioId: "unimed", status: "pago" },
    { descricao: "Particular - Mario Acca", vencimento: "2026-07-14", valor: 350, convenioId: "particular", status: "pago" },
    { descricao: "BRADESCO SAÚDE - lote 06/2026", vencimento: "2026-07-10", valor: 5150, convenioId: "bradesc", status: "pendente" },
  ];
  for (const c of contasReceber) {
    await db.collection(`clinicas/${CLINICA_ID}/contasReceber`).add({ ...c, criadoEm: agora });
  }
  const contasPagar = [
    { descricao: "Aluguel da clínica", vencimento: "2026-07-20", valor: 4200, status: "pendente" },
    { descricao: "Fornecedor de insumos", vencimento: "2026-07-18", valor: 890, status: "pendente" },
    { descricao: "Energia elétrica", vencimento: "2026-07-15", valor: 610, status: "pago" },
  ];
  for (const c of contasPagar) {
    await db.collection(`clinicas/${CLINICA_ID}/contasPagar`).add({ ...c, criadoEm: agora });
  }

  // ---------- avaliações do paciente ----------
  const avaliacoes = [
    { criterio: "Atendimento médico", nota: 4.8 },
    { criterio: "Tempo de espera", nota: 4.2 },
    { criterio: "Clareza nas orientações", nota: 4.9 },
    { criterio: "Estrutura da clínica", nota: 4.5 },
  ];
  for (const a of avaliacoes) {
    await db.collection(`clinicas/${CLINICA_ID}/avaliacoes`).add({ ...a, criadoEm: agora });
  }

  // ---------- nota fiscal de exemplo ----------
  await db.collection(`clinicas/${CLINICA_ID}/notasFiscais`).add({
    tomador: "Mario Acca", cpfCnpj: PACIENTE_ID === "mario-acca" ? "214.070.728-11" : "",
    codigoServico: "04498 - Consulta médica", valor: 350, aliquota: "2%",
    discriminacao: "Consulta médica - Dermatologia clínica", status: "autorizada", criadoEm: agora,
  });


  console.log("\nSeed concluído:");
  console.log(`  clínica:      ${CLINICA_ID}`);
  console.log(`  paciente:     ${PACIENTE_ID}`);
  console.log(`  profissional: ${PROFISSIONAL_EMAIL} / ${PROFISSIONAL_SENHA}`);
  console.log("\n  Se o usuário já estava logado no navegador, faça logout e login de novo");
  console.log("  (ou aguarde ~1h) para o token pegar o novo custom claim de clínicas.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro ao rodar o seed:", err);
    process.exit(1);
  });
