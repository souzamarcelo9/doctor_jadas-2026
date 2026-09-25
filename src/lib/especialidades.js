import { criarDocumento } from "./firestore";

// Lista inicial de especialidades — carimbada automaticamente na clínica
// na primeira vez que alguém abre o agendamento e a coleção ainda está
// vazia (ver `useEspecialidadesComSeed` abaixo). Depois disso, o cadastro
// vira 100% gerenciável em Configurações → Convênios e Serviços →
// Especialidades (pode desativar as que não usa e adicionar outras).
export const ESPECIALIDADES_PADRAO = [
  "Clínica Geral",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Cardiologia",
  "Dermatologia",
  "Ortopedia e Traumatologia",
  "Psiquiatria",
  "Endocrinologia",
  "Neurologia",
  "Oftalmologia",
  "Otorrinolaringologia",
  "Urologia",
  "Gastroenterologia",
  "Nutrição",
  "Psicologia",
  "Fisioterapia",
  "Odontologia",
  "Geriatria",
  "Reumatologia",
  "Pneumologia",
];

export async function semearEspecialidadesPadrao(clinicaId) {
  await Promise.all(
    ESPECIALIDADES_PADRAO.map((nome) => criarDocumento(`clinicas/${clinicaId}/especialidades`, { nome, ativo: true }))
  );
}
