// Indicador de Operação (cIndOp) da NFS-e Paulistana v2 (Reforma Tributária) —
// tabela IndOp_IBSCBS (Anexo VII do manual do web service). Só os três códigos
// que cobrem consulta/atendimento médico; qualquer outro código de 6 dígitos
// da tabela oficial pode ser digitado em "Outro código".
export const CIND_OP_OPCOES = [
  { valor: "030101", rotulo: "030101 — Serviço prestado fisicamente sobre a pessoa, no estabelecimento do prestador (consulta presencial)" },
  { valor: "030104", rotulo: "030104 — Serviço prestado fisicamente sobre a pessoa, em endereço diverso (atendimento domiciliar)" },
  { valor: "100301", rotulo: "100301 — Demais serviços, operação onerosa (teleconsulta)" },
];

export const cIndOpValido = (v) => /^\d{6}$/.test(String(v || ""));

// Código que o sistema usa sozinho conforme o tipo de atendimento (mesma regra do servidor).
export const cIndOpAutomatico = (tipo) => (tipo === "teleconsulta" ? "100301" : tipo === "domiciliar" ? "030104" : "030101");

// Layout (1 = só ISS, 2 = ISS + IBS/CBS) com que a nota foi enviada: usa o campo
// gravado na emissão e, nas notas antigas, lê a versão do próprio XML enviado.
export function layoutDaNota(n) {
  if (n?.layoutVersao) return Number(n.layoutVersao);
  const m = String(n?.xmlEnviado || "").match(/<Cabecalho[^>]*Versao="(\d)"/);
  return m ? Number(m[1]) : null;
}
