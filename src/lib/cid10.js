// Catálogo CID-10, edição brasileira — dados públicos do Ministério da
// Saúde/DATASUS (revisão 2008), extraídos e reduzidos a {codigo, descricao}
// a partir do pacote npm @br-health-kit/cid10 (que por sua vez redistribui,
// sem modificação de conteúdo, os CSVs oficiais publicados em
// http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip).
// 12.451 códigos "terminais" (os que de fato são usados pra codificar um
// diagnóstico — categorias de 3 dígitos sem subcategoria, tipo I10, mais
// todas as subcategorias de 4 dígitos, tipo E11.9).
//
// O JSON tem ~1.2MB — carregado sob demanda (import dinâmico, cacheado em
// memória) em vez de estático, pra não inflar o bundle principal que todo
// mundo baixa mesmo sem nunca abrir a aba de Problemas.
let cachePromise = null;
function carregarCatalogo() {
  if (!cachePromise) {
    cachePromise = import("../data/cid10.json").then((m) => m.default);
  }
  return cachePromise;
}

function normalizar(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos pra busca não depender deles
}

/** Busca no catálogo por código (prefixo) ou descrição (substring),
 * ignorando acentuação e caixa. Devolve no máximo `limite` resultados.
 * Assíncrona porque o catálogo é carregado sob demanda (ver acima). */
export async function buscarCid10(termo, limite = 30) {
  const q = normalizar(termo).trim();
  if (q.length < 2) return [];
  const cid10 = await carregarCatalogo();
  const qSemPonto = q.replace(".", "");
  const resultados = [];
  for (const item of cid10) {
    const codigoNorm = normalizar(item.codigo).replace(".", "");
    const descricaoNorm = normalizar(item.descricao);
    if (codigoNorm.startsWith(qSemPonto) || descricaoNorm.includes(q)) {
      resultados.push(item);
      if (resultados.length >= limite) break;
    }
  }
  return resultados;
}

/** Busca um código exato (usado pra reidratar a descrição oficial a partir
 * de um código já salvo, por exemplo). */
export async function buscarCid10PorCodigo(codigo) {
  const cid10 = await carregarCatalogo();
  const alvo = normalizar(codigo).replace(".", "");
  return cid10.find((item) => normalizar(item.codigo).replace(".", "") === alvo) || null;
}
