// Máscaras e validações de campos sensíveis do paciente — usadas no
// cadastro rápido (Pacientes.jsx), no cadastro completo feito durante o
// agendamento (AgendamentoModal.jsx) e na edição de paciente
// (EditarPacienteModal.jsx). Existiam três lugares digitando CPF/celular/
// CEP sem nenhuma máscara ou limite — centralizado aqui pra não deixar
// "lixo" ser salvo nesses campos e pra manter os três formulários com o
// mesmo comportamento.

export function somenteDigitos(v) {
  return (v || "").replace(/\D/g, "");
}

/** 000.000.000-00, aplicada progressivamente enquanto digita. */
export function maskCPF(v) {
  const d = somenteDigitos(v).slice(0, 11);
  const p1 = d.slice(0, 3), p2 = d.slice(3, 6), p3 = d.slice(6, 9), p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += "." + p2;
  if (p3) out += "." + p3;
  if (p4) out += "-" + p4;
  return out;
}

/** 00000-000 */
export function maskCEP(v) {
  const d = somenteDigitos(v).slice(0, 8);
  const p1 = d.slice(0, 5), p2 = d.slice(5, 8);
  return p2 ? `${p1}-${p2}` : p1;
}

/** Aceita fixo (10 dígitos) ou celular (11 dígitos): (00) 0000-0000 / (00) 00000-0000. */
export function maskCelular(v) {
  const d = somenteDigitos(v).slice(0, 11);
  const ddd = d.slice(0, 2);
  const celular = d.length > 10;
  const meio = celular ? d.slice(2, 7) : d.slice(2, 6);
  const fim = celular ? d.slice(7, 11) : d.slice(6, 10);
  let out = "";
  if (ddd) out += `(${ddd}`;
  if (ddd.length === 2) out += ") ";
  if (meio) out += meio;
  if (fim) out += `-${fim}`;
  return out;
}

/** Valida dígito verificador do CPF (rejeita também sequências tipo 111.111.111-11). */
export function cpfValido(v) {
  const d = somenteDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(d[10]);
}

/** Campo opcional na maioria dos formulários — só reprova se algo foi digitado e ficou incompleto/malformado. */
export function emailValido(v) {
  if (!v || !v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function celularValido(v) {
  const d = somenteDigitos(v);
  if (!d) return true;
  return d.length === 10 || d.length === 11;
}

export function cepValido(v) {
  const d = somenteDigitos(v);
  if (!d) return true;
  return d.length === 8;
}

/** Bloqueia dígitos/símbolos de código em campos de nome de pessoa, sem
 * travar acentos, espaço, hífen ou apóstrofo (ex: "D'Ávila", "Maria-José"). */
export function limparNome(v) {
  return (v || "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, "");
}

// Limites de tamanho usados nos campos sensíveis/identificadores do
// paciente — evita colar textos enormes em campos que deveriam ser curtos.
export const LIMITES = {
  nome: 120,
  nomeMae: 120,
  fichaPaciente: 30,
  cpf: 14, // já formatado: 000.000.000-00
  celular: 16, // já formatado: (00) 00000-0000
  email: 150,
  cep: 9, // já formatado: 00000-000
  logradouro: 150,
  numero: 10,
  bairro: 100,
  carteirinha: 40,
  observacoesGerais: 500,
};
