/**
 * Cadastra, numa clínica já existente, 5 templates de formulário de
 * avaliação baseados em escalas clínicas oficiais/publicadas — pra você
 * não precisar montar do zero pergunta por pergunta.
 *
 * Fontes usadas (verbatim, com pontuação oficial):
 *   - IVCF-20: Manual de aplicação do IVCF-20, SES/RS, 2023 (Moraes et al.)
 *   - MEEM: Bertolucci et al. 1994 / Brucki et al. 2003 (pontos de corte
 *     por escolaridade) — versão consolidada em uso na Atenção Primária
 *   - EDG-15 (GDS-15/Yesavage): versão em português, EERP/USP, corte
 *     Almeida & Almeida (1999)
 *   - Escala de Gijón: versão reduzida de 3 domínios (Situação Familiar,
 *     Relações e Contactos Sociais, Apoio da Rede Social) em uso clínico
 *     em Portugal — a versão espanhola original tem 5 domínios (inclui
 *     Situação Econômica e Situação da Moradia), mas eu não consegui
 *     confirmar o texto verbatim desses 2 domínios numa fonte confiável,
 *     então preferi não inventar e deixei só os 3 que consegui verificar.
 *     Se precisar da versão completa de 5 domínios, me manda uma fonte
 *     confiável com o texto exato que eu completo.
 *   - Lawton-Brody (AIVD): Ministério da Saúde, Caderno de Atenção Básica
 *     nº 19, 2006 — mesma fonte citada pelo próprio manual do IVCF-20.
 *
 * IMPORTANTE — sobre a seção "Mobilidade" simplificada do IVCF-20: o
 * manual oficial descreve alguns subitens de mobilidade (alcance/preensão/
 * pinça, marcha) como compostos por mais de uma pergunta cada, mas o texto
 * disponível não deixa claro a redação exata de cada subpergunta — então
 * cada subdomínio foi condensado numa única pergunta que carrega a
 * pontuação máxima correta daquele subdomínio (a pontuação total da seção
 * bate exatamente com os 10 pontos oficiais, só a granularidade interna é
 * simplificada). Mesma lógica pra "Atividades de vida diária instrumental"
 * do IVCF-20 (compras/dinheiro/trabalhos domésticos): o manual diz que a
 * seção INTEIRA vale no máximo 4 pontos (não 4 por pergunta), então virou
 * uma pergunta única.
 *
 * Como rodar:
 *   node scripts/seedFormularios.js
 * (precisa do mesmo serviceAccountKey.json usado pelo seed.js/criarAdmin.js)
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CLINICA_ID = "teste-clinica-diniz";

function campo(label, tipo, opcoes = null) {
  return { id: randomUUID(), label, tipo, opcoes };
}
function simNao(label, pontosSim) {
  return campo(label, "opcoes", [{ label: "Sim", valor: pontosSim }, { label: "Não", valor: 0 }]);
}
function corretoIncorreto(label) {
  return campo(label, "opcoes", [{ label: "Correto", valor: 1 }, { label: "Incorreto", valor: 0 }]);
}

// ---------------------------------------------------------------------
// IVCF-20 — Índice de Vulnerabilidade Clínico-Funcional
// Fonte: Manual de aplicação do IVCF-20, SES/RS, 2023. Máximo 40 pontos.
// Corte: 0-6 robusto · 7-14 potencialmente frágil · ≥15 frágil.
// ---------------------------------------------------------------------
const ivcf20 = {
  nome: "IVCF-20 — Índice de Vulnerabilidade Clínico-Funcional",
  descricao: "Triagem de fragilidade em idosos (Moraes et al.). Máx. 40 pontos — 0-6: robusto · 7-14: potencialmente frágil · ≥15: frágil. Fonte: Manual SES/RS, 2023.",
  campos: [
    campo("1. Idade", "opcoes", [{ label: "60 a 74 anos", valor: 0 }, { label: "75 a 84 anos", valor: 1 }, { label: "85 anos ou mais", valor: 3 }]),
    campo("2. Comparando com outras pessoas da sua idade, você diria que sua saúde é regular ou ruim?", "opcoes", [{ label: "Não (excelente/muito boa/boa)", valor: 0 }, { label: "Sim (regular ou ruim)", valor: 1 }]),
    simNao("3. Deixou de fazer compras, cuidar do próprio dinheiro ou pequenos trabalhos domésticos que fazia antes (AVD instrumental)?", 4),
    simNao("4. Deixou de tomar banho sozinho(a) (AVD básica)?", 6),
    simNao("5. Algum familiar ou amigo falou que você está ficando esquecido(a)?", 1),
    simNao("6. Esse esquecimento está piorando nos últimos meses?", 1),
    simNao("7. Esse esquecimento está impedindo a realização de alguma atividade do cotidiano?", 2),
    simNao("8. No último mês, ficou com desânimo, tristeza ou desesperança?", 2),
    simNao("9. No último mês, perdeu o interesse ou prazer em atividades anteriormente prazerosas?", 2),
    simNao("10. Apresenta dificuldade de alcance, preensão ou pinça (ex: erguer os braços, segurar objetos pequenos)?", 2),
    simNao("11. Apresenta redução de capacidade aeróbica e/ou muscular (cansaço ou fraqueza que limita atividades)?", 2),
    simNao("12. Apresenta alteração de marcha, instabilidade postural ou quedas de repetição?", 4),
    simNao("13. Apresenta incontinência urinária e/ou fecal?", 2),
    simNao("14. Apresenta dificuldade visual que atrapalha alguma atividade do cotidiano, mesmo usando óculos?", 2),
    simNao("15. Apresenta dificuldade auditiva que atrapalha alguma atividade do cotidiano, mesmo usando prótese?", 2),
    simNao("16. Tem 5 ou mais doenças crônicas, usa 5 ou mais medicamentos diários, ou teve internação nos últimos 6 meses?", 4),
  ],
  pontuavel: true,
  ativo: true,
};

// ---------------------------------------------------------------------
// MEEM — Mini-Exame do Estado Mental (versão consolidada Bertolucci/Brucki)
// Máximo 30 pontos. Corte por escolaridade (Brucki et al., 2003):
// analfabetos 20 · 1-4 anos 25 · 5-8 anos 26,5 · 9-11 anos 28 · >11 anos 29.
// ---------------------------------------------------------------------
const meem = {
  nome: "MEEM — Mini-Exame do Estado Mental",
  descricao: "Rastreio cognitivo (Folstein et al., adaptado por Bertolucci et al. 1994). Máx. 30 pontos. Corte varia por escolaridade — ver Brucki et al. 2003.",
  campos: [
    corretoIncorreto("Orientação temporal — dia da semana"),
    corretoIncorreto("Orientação temporal — dia do mês"),
    corretoIncorreto("Orientação temporal — mês"),
    corretoIncorreto("Orientação temporal — ano"),
    corretoIncorreto("Orientação temporal — hora aproximada"),
    corretoIncorreto("Orientação espacial — local (ex: consultório)"),
    corretoIncorreto("Orientação espacial — instituição"),
    corretoIncorreto("Orientação espacial — bairro"),
    corretoIncorreto("Orientação espacial — cidade"),
    corretoIncorreto("Orientação espacial — estado"),
    campo("Registro: repetir 3 palavras (vaso, carro, tijolo) — acertos (0 a 3)", "numero"),
    campo("Atenção e cálculo: 100-7 seriado (ou soletrar MUNDO ao contrário) — acertos (0 a 5)", "numero"),
    campo("Memória de evocação: lembrar as 3 palavras — acertos (0 a 3)", "numero"),
    campo("Linguagem: nomear lápis e relógio — acertos (0 a 2)", "numero"),
    simNao("Linguagem: repetir \"nem aqui, nem ali, nem lá\"", 1),
    campo("Linguagem: comando de 3 estágios (pegar o papel, dobrar ao meio, colocar na mesa) — acertos (0 a 3)", "numero"),
    simNao("Linguagem: ler e obedecer \"FECHE OS OLHOS\"", 1),
    simNao("Linguagem: escrever uma frase com sujeito e predicado que faça sentido", 1),
    simNao("Capacidade construtiva: copiar o desenho dos dois pentágonos que se interceptam", 1),
  ],
  pontuavel: true,
  ativo: true,
};

// ---------------------------------------------------------------------
// EDG-15 — Escala de Depressão Geriátrica (GDS-15, Yesavage)
// Fonte: versão em português, EERP/USP. Máximo 15 pontos.
// Corte: ≥5 sugere sintomas depressivos (Almeida & Almeida, 1999).
// ---------------------------------------------------------------------
function edgItem(pergunta, simPontua) {
  return campo(pergunta, "opcoes", simPontua
    ? [{ label: "Sim", valor: 1 }, { label: "Não", valor: 0 }]
    : [{ label: "Sim", valor: 0 }, { label: "Não", valor: 1 }]);
}
const edg15 = {
  nome: "EDG-15 — Escala de Depressão Geriátrica",
  descricao: "Rastreio de sintomas depressivos em idosos (Yesavage et al., versão EERP/USP). Máx. 15 pontos — corte ≥5 sugere sintomas depressivos (Almeida & Almeida, 1999).",
  campos: [
    edgItem("1. Você está basicamente satisfeito(a) com sua vida?", false),
    edgItem("2. Você deixou muitos de seus interesses e atividades?", true),
    edgItem("3. Você sente que sua vida está vazia?", true),
    edgItem("4. Você se aborrece com frequência?", true),
    edgItem("5. Você se sente de bom humor a maior parte do tempo?", false),
    edgItem("6. Você tem medo que algum mal vá lhe acontecer?", true),
    edgItem("7. Você se sente feliz a maior parte do tempo?", false),
    edgItem("8. Você sente que sua situação não tem saída?", true),
    edgItem("9. Você prefere ficar em casa a sair e fazer coisas novas?", true),
    edgItem("10. Você se sente com mais problemas de memória do que a maioria?", true),
    edgItem("11. Você acha maravilhoso estar vivo(a)?", false),
    edgItem("12. Você se sente um(a) inútil nas atuais circunstâncias?", true),
    edgItem("13. Você se sente cheio(a) de energia?", false),
    edgItem("14. Você acha que sua situação é sem esperanças?", true),
    edgItem("15. Você sente que a maioria das pessoas está melhor que você?", true),
  ],
  pontuavel: true,
  ativo: true,
};

// ---------------------------------------------------------------------
// Escala de Gijón (versão reduzida — 3 domínios)
// Fonte: instrumento em uso clínico (EAS Portugal). Máx. 15 pontos.
// Cutoffs aproximados — confirme contra a fonte oficial antes de usar
// clinicamente: ~3-5 boa situação · 6-9 intermédia · ≥10 severa.
// ---------------------------------------------------------------------
function gijonCampo(label, niveis) {
  return campo(label, "opcoes", niveis.map((texto, i) => ({ label: texto, valor: i + 1 })));
}
const gijon = {
  nome: "Escala de Gijón (situação sociofamiliar)",
  descricao: "Triagem de risco social/familiar em idosos — versão reduzida de 3 domínios. Máx. 15 pontos. Cutoffs aproximados: ~3-5 boa situação social · 6-9 situação intermédia · ≥10 deterioro social severo — confirme contra a fonte oficial antes de uso clínico formal.",
  campos: [
    gijonCampo("Situação familiar", [
      "Vive com cônjuge/companheiro e/ou família, sem conflito",
      "Vive com cônjuge/companheiro de idade semelhante",
      "Vive com cônjuge/companheiro e/ou família e/ou outros, mas não podem ou não querem cuidá-lo",
      "Vive sozinho(a), com filhos e/ou familiares próximos que não dão resposta a todas as necessidades",
      "Vive sozinho(a), família distante, sem cuidador, sem família",
    ]),
    gijonCampo("Relações e contactos sociais", [
      "Mantém relações fora do domicílio",
      "Relaciona-se com família/vizinhos/outros, sai de casa",
      "Apenas se relaciona com a família, sai de casa",
      "Não sai de casa, recebe família ou visitas (mais de 1x por semana)",
      "Não sai de casa nem recebe visitas (menos de 1x por semana)",
    ]),
    gijonCampo("Apoio da rede social", [
      "Não necessita de nenhum apoio",
      "Recebe apoio da família e/ou vizinhos",
      "Recebe apoio social formal suficiente (Centro de Dia, cuidador, etc.)",
      "Tem apoio social, mas é insuficiente",
      "Não tem apoio social e necessita",
    ]),
  ],
  pontuavel: true,
  ativo: true,
};

// ---------------------------------------------------------------------
// Escala de Lawton & Brody — Atividades Instrumentais de Vida Diária (AIVD)
// Fonte: BRASIL. Ministério da Saúde. Envelhecimento e saúde da pessoa
// idosa. Caderno de Atenção Básica nº 19, 2006 (mesma fonte citada pelo
// próprio manual do IVCF-20 como instrumento complementar). Máximo 27
// pontos (9 itens × 3). Quanto MAIOR a pontuação, MAIS independente o
// idoso é nas atividades instrumentais — ao contrário do IVCF-20, aqui
// pontuação alta é um sinal bom, não de risco.
// ---------------------------------------------------------------------
function lawtonItem(pergunta) {
  return campo(pergunta, "opcoes", [
    { label: "Sem ajuda", valor: 3 },
    { label: "Com ajuda parcial", valor: 2 },
    { label: "Não consegue", valor: 1 },
  ]);
}
const lawtonBrody = {
  nome: "Lawton-Brody — Atividades Instrumentais de Vida Diária (AIVD)",
  descricao: "Avalia independência do idoso em atividades instrumentais. Máx. 27 pontos (9 itens × 3) — quanto MAIOR, mais independente (ao contrário do IVCF-20). Fonte: Ministério da Saúde, Caderno de Atenção Básica nº 19, 2006.",
  campos: [
    lawtonItem("1. O(a) Sr(a) consegue usar o telefone?"),
    lawtonItem("2. O(a) Sr(a) consegue fazer compras?"),
    lawtonItem("3. O(a) Sr(a) consegue preparar suas próprias refeições?"),
    lawtonItem("4. O(a) Sr(a) consegue arrumar a casa?"),
    lawtonItem("5. O(a) Sr(a) consegue lavar e passar sua roupa?"),
    lawtonItem("6. O(a) Sr(a) consegue cuidar de suas finanças?"),
    lawtonItem("7. O(a) Sr(a) consegue tomar seus remédios na dose e horários corretos?"),
    lawtonItem("8. O(a) Sr(a) consegue ir a locais distantes, usando algum transporte, sem necessidade de planejamentos especiais?"),
    lawtonItem("9. O(a) Sr(a) consegue fazer trabalhos manuais domésticos, como pequenos reparos?"),
  ],
  pontuavel: true,
  ativo: true,
};

async function main() {
  const templates = [ivcf20, meem, edg15, gijon, lawtonBrody];
  for (const t of templates) {
    const ref = await db.collection(`clinicas/${CLINICA_ID}/formularios`).add(t);
    console.log(`Criado: ${t.nome} (${ref.id}) — ${t.campos.length} campos`);
  }
  console.log("\nPronto! Veja em Atendimento → Formulários, ou gerencie em Configurações → Formulários de Avaliação.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro ao popular formulários:", err);
    process.exit(1);
  });
