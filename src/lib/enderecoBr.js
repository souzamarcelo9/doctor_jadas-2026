// Helpers de endereço brasileiro usados no formulário de paciente/agendamento.
// Cidades vêm da API pública do IBGE (por UF, sem chave/custo) e o CEP vem do
// ViaCEP — ambos consumidos direto do navegador do usuário final, não daqui
// do ambiente de build.

export const ESTADOS_BR = [
  { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" }, { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" }, { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" }, { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" }, { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" },
];

const cacheCidades = new Map();

/** Lista de cidades de uma UF, ordenada alfabeticamente. Cacheada em memória
 * por sessão para não repetir a chamada toda vez que o select abre. */
export async function buscarCidadesPorUf(uf) {
  if (!uf) return [];
  if (cacheCidades.has(uf)) return cacheCidades.get(uf);
  try {
    const resp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
    if (!resp.ok) throw new Error("Falha ao buscar cidades");
    const json = await resp.json();
    const nomes = json.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    cacheCidades.set(uf, nomes);
    return nomes;
  } catch (err) {
    console.error("Erro ao buscar cidades do IBGE:", err);
    return [];
  }
}

/** Consulta o ViaCEP e devolve { logradouro, bairro, cidade, estado } ou
 * null se o CEP for inválido/não encontrado. */
export async function buscarEnderecoPorCep(cep) {
  const digitos = (cep || "").replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!resp.ok) throw new Error("Falha ao buscar CEP");
    const json = await resp.json();
    if (json.erro) return null;
    return {
      logradouro: json.logradouro || "",
      bairro: json.bairro || "",
      cidade: json.localidade || "",
      estado: json.uf || "",
    };
  } catch (err) {
    console.error("Erro ao buscar CEP no ViaCEP:", err);
    return null;
  }
}
