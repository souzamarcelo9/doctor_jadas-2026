import { criarDocumento } from "./firestore";

// Convênios aceitos pela clínica (transcritos do quadro de convênios).
// Grafias corrigidas: "PRIME HEALT" -> Prime Health, "DECONTOS" -> Descontos;
// "CLUDE SAÚDE" (repetido no quadro) foi tratado como o mesmo "Club Saúde".
// Depois de importada, a lista é 100% editável em Configurações →
// Convênios e Serviços → Convênios.
export const CONVENIOS_PADRAO = [
  "AMBEP", "Allianz Saúde", "Alligare / Alliance", "AMES Benefício", "Amil", "ANASP", "APAF Rio", "APPAI",
  "ASSEFAZ", "Benvinda Saúde", "Blue Saúde", "Bradesco", "BR Clube de Benefício / Express Assist",
  "Brasil Assistência", "CABERJ", "CAMARJ", "CAMPERJ", "CAPESAÚDE", "Care Plus", "CAURJ", "CEMERU",
  "Club Saúde", "EPHAMA (Programa Calme Colono)", "Exército Brasileiro", "Fio Saúde", "Gama", "GEAP",
  "Grey Card", "Hospital Naval Marcílio Dias", "IBEN", "Integral Saúde", "Invictus Clube", "IPALERJ",
  "Klini Saúde", "Lance Saúde", "Select Saúde", "Life Saúde", "Mapfre Assistência", "Maxíma", "Mediservice",
  "Mútua", "Nova Saúde", "NUCLEP", "OAF / OSAF", "Omint", "Petrobras", "PF Saúde", "Plan Assiste / MPU",
  "Porto Cuida / Porto Serviços", "Porto Seguro", "Prime Health", "Real Grandeza", "Rede Sua Saúde",
  "Saúde 10", "Saúde Caixa", "Saúde e Vida", "Saúde Plena & Descontos", "Saúde Total", "SEFAS", "SERPRO",
  "Social", "Sua Saúde", "SulAmérica", "Telos - AMAP", "USS - Tempo Assist.", "Vale Jequiti", "Vale S.A / PASA",
  "Vale Saúde Sempre", "Unimed", "BC Saúde (Banco Central)",
];

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Cria só os que ainda não existem (compara sem acento/maiúscula).
// Retorna quantos foram criados.
export async function importarConveniosPadrao(clinicaId, existentes = []) {
  const jaTem = new Set(existentes.map((c) => norm(c.nome)));
  const novos = CONVENIOS_PADRAO.filter((n) => !jaTem.has(norm(n)));
  await Promise.all(novos.map((nome) => criarDocumento(`clinicas/${clinicaId}/convenios`, { nome, ativo: true })));
  return novos.length;
}
