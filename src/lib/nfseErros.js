// Camada só de EXIBIÇÃO sobre o XML de retorno da Prefeitura — não muda
// nada em como a nota é montada/assinada/enviada (isso continua 100% em
// functions/index.js, sem alterações). Aqui só extraímos e traduzimos os
// códigos de erro/alerta mais comuns pra não deixar o usuário lendo XML
// cru pra entender o que aconteceu — o XML completo continua disponível
// como "ver mais", pra quem quiser conferir tudo.

/** Alguns métodos do webservice da NFS-e devolvem o XML de verdade
 * aninhado dentro de uma tag <RetornoXML> do envelope SOAP, como TEXTO
 * ESCAPADO em entidades HTML (`&lt;Sucesso&gt;true&lt;/Sucesso&gt;`) em vez
 * de XML de verdade — daí toda extração abaixo (<Sucesso>, <Erro>,
 * <ChaveNFe>...) precisar passar por aqui primeiro, senão nunca bate com
 * o texto escapado. Sem efeito quando a resposta já vier normal (o
 * backend já salva normalizado desde esse ajuste — isso aqui cobre notas
 * antigas que ainda tenham a resposta salva "crua"). */
function normalizarRespostaNfse(xmlBruto) {
  if (!xmlBruto) return xmlBruto;
  const aninhado = xmlBruto.match(/<(?:\w+:)?RetornoXML[^>]*>([\s\S]*?)<\/(?:\w+:)?RetornoXML>/i);
  const interno = aninhado ? aninhado[1] : xmlBruto;
  return interno
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&"); // por último, senão "&amp;lt;" viraria "<" (decodificação dupla)
}

export { normalizarRespostaNfse };

// Dicas em português claro pros códigos mais relevantes — sobretudo os de
// cancelamento (1301-1306, manual v3.3.8 item 4.5.1) e alguns comuns de
// emissão. Quando o código não estiver aqui, a <Descricao> que a própria
// Prefeitura manda já costuma ser razoavelmente legível e é exibida do
// mesmo jeito, só sem a dica extra.
const DICAS_POR_CODIGO = {
  "1001": "O XML não passou na validação de schema da Prefeitura — geralmente um campo faltando ou fora do formato esperado.",
  "1301": "Essa NF-e já foi cancelada antes — confira a data de cancelamento na mensagem ao lado.",
  "1302": "O mesmo número de NF-e apareceu duas vezes no pedido enviado.",
  "1303": "Só é possível cancelar NF-e emitidas pela mesma Inscrição Municipal (prestador) configurada nesta clínica.",
  "1304": "Erro genérico ao cancelar — confira se o número da NF-e e o código de verificação estão corretos.",
  "1305": "A assinatura do pedido de cancelamento não bateu — geralmente indica Inscrição Municipal ou Número da NF-e incorretos, ou um certificado diferente do que emitiu a nota.",
  "1306": "Essa NF-e não foi gerada por este Web Service (foi emitida por outro canal, como o site da Prefeitura) — não é possível cancelá-la por aqui.",
  "1404": "A Inscrição Municipal do Prestador informada não consta na base de dados da Prefeitura.",
};

/** Extrai todos os blocos <Erro> e <Alerta> do XML de retorno, cada um com
 * código, descrição (texto já em português da própria Prefeitura) e, se
 * houver, uma dica adicional nossa. */
export function extrairErrosAmigaveis(xmlRetornoBruto) {
  if (!xmlRetornoBruto) return [];
  const xmlRetorno = normalizarRespostaNfse(xmlRetornoBruto);
  const itens = [];
  const padroes = [
    { regex: /<Erro[^>]*>([\s\S]*?)<\/Erro>/gi, tipo: "erro" },
    { regex: /<Alerta[^>]*>([\s\S]*?)<\/Alerta>/gi, tipo: "alerta" },
  ];
  for (const { regex, tipo } of padroes) {
    let m;
    while ((m = regex.exec(xmlRetorno))) {
      const bloco = m[1];
      const codigo = bloco.match(/<Codigo>([\s\S]*?)<\/Codigo>/i)?.[1]?.trim();
      const descricao = bloco.match(/<Descricao>([\s\S]*?)<\/Descricao>/i)?.[1]?.trim();
      if (codigo || descricao) {
        itens.push({ tipo, codigo, descricao, dica: codigo ? DICAS_POR_CODIGO[codigo] : undefined });
      }
    }
  }
  return itens;
}

export function respostaFoiSucesso(xmlRetorno) {
  return /<Sucesso>true<\/Sucesso>/i.test(normalizarRespostaNfse(xmlRetorno) || "");
}

/** Extrai Inscrição do Prestador, Número da NF-e e Código de Verificação
 * do <ChaveNFe> presente na resposta de emissão já salva — usado pra
 * pré-preencher o formulário de cancelamento sem precisar guardar esses
 * campos separadamente (a emissão continua salvando só o XML cru). */
export function extrairChaveNFe(xmlRetornoBruto) {
  if (!xmlRetornoBruto) return {};
  const xmlRetorno = normalizarRespostaNfse(xmlRetornoBruto);
  const bloco = xmlRetorno.match(/<ChaveNFe>([\s\S]*?)<\/ChaveNFe>/i)?.[1] || "";
  const inscricaoPrestador = bloco.match(/<InscricaoPrestador>([\s\S]*?)<\/InscricaoPrestador>/i)?.[1]?.trim();
  const numeroNfe = (bloco.match(/<NumeroNFe>([\s\S]*?)<\/NumeroNFe>/i) || bloco.match(/<Numero>([\s\S]*?)<\/Numero>/i))?.[1]?.trim();
  const codigoVerificacao = bloco.match(/<CodigoVerificacao>([\s\S]*?)<\/CodigoVerificacao>/i)?.[1]?.trim();
  return { inscricaoPrestador, numeroNfe, codigoVerificacao };
}

/** Monta o link da página oficial da Prefeitura de SP que exibe/imprime a
 * NFS-e (a mesma que o próprio portal usa pra "segunda via"). O webservice
 * só devolve XML — não existe método que entregue o PDF — então o
 * documento "no formato da Prefeitura" é esta página. Formato do link
 * observado em links públicos reais de notas emitidas (não está descrito
 * no manual do webservice); confirmar com a primeira nota real em
 * produção. Retorna null se faltar algum dado da chave (caso das notas
 * emitidas em modo de teste, que não geram NFS-e de verdade). */
export function montarLinkNfse({ inscricaoPrestador, numeroNfe, codigoVerificacao } = {}) {
  const ins = String(inscricaoPrestador || "").replace(/\D/g, "");
  const nf = String(numeroNfe || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const ver = String(codigoVerificacao || "").replace(/[^A-Za-z0-9]/g, "");
  if (!ins || !nf || !ver) return null;
  return `https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx?inscricao=${ins}&nf=${nf}&verificacao=${ver}`;
}
