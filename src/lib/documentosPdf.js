import { doc as docRef, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Gerador de documentos clínicos em PDF (encaminhamento, atestado, pedido de
// exames…). Tudo no navegador, com jsPDF carregado sob demanda (não pesa no
// carregamento inicial). O PDF sai em A4 com: cabeçalho da clínica, dados do
// paciente, corpo do documento, local/data e área de assinatura + carimbo com
// nome/CRM do médico. A função devolve o Blob pra que as próximas etapas
// (envio ao paciente, assinatura digital ICP-Brasil) reaproveitem o mesmo PDF.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function dataExtenso(d = new Date()) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function idadeDe(nascimento) {
  const d = typeof nascimento === "string" ? new Date(`${nascimento}T00:00:00`) : nascimento?.toDate?.();
  if (!d || isNaN(d)) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  if (hoje < new Date(hoje.getFullYear(), d.getMonth(), d.getDate())) idade -= 1;
  return { idade, texto: d.toLocaleDateString("pt-BR") };
}

async function lerDoc(path, id) {
  if (!id) return null;
  const snap = await getDoc(docRef(db, path, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Busca clínica, médico (autor do documento) e paciente. */
export async function carregarContextoDocumento({ clinicaId, pacienteId, profissionalId }) {
  const [clinica, medico, paciente] = await Promise.all([
    lerDoc("clinicas", clinicaId),
    lerDoc(`clinicas/${clinicaId}/membros`, profissionalId),
    lerDoc(`clinicas/${clinicaId}/pacientes`, pacienteId),
  ]);
  return { clinica, medico, paciente };
}

/**
 * @param {object} p
 * @param {object} p.clinica, p.medico, p.paciente - docs do Firestore
 * @param {string} p.titulo - ex: "Encaminhamento médico"
 * @param {{titulo?: string, texto?: string, itens?: string[]}[]} p.secoes
 * @param {Date} [p.data]
 * @param {string} [p.codigo] - identificador do documento (rodapé)
 * @returns {Promise<{blob: Blob, nomeArquivo: string}>}
 */
export async function gerarPdfDocumento({ clinica, medico, paciente, titulo, secoes = [], data = new Date(), codigo = "" }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 20, largura = W - 2 * M;
  let y = 18;

  const cor = (r, g, b) => pdf.setTextColor(r, g, b);
  const novaPaginaSe = (altura) => { if (y + altura > H - 25) { pdf.addPage(); y = 20; } };
  const escrever = (texto, { tamanho = 11, estilo = "normal", alinhar = "left", espaco = 5.2, x = M, largura: lg = largura } = {}) => {
    pdf.setFont("helvetica", estilo); pdf.setFontSize(tamanho);
    const linhas = pdf.splitTextToSize(String(texto || ""), lg);
    linhas.forEach((l) => {
      novaPaginaSe(espaco);
      pdf.text(l, alinhar === "center" ? W / 2 : alinhar === "right" ? W - M : x, y, { align: alinhar });
      y += espaco;
    });
  };

  // ---- cabeçalho da clínica
  cor(15, 90, 95);
  escrever(clinica?.nome || clinica?.razaoSocial || "Clínica", { tamanho: 15, estilo: "bold", alinhar: "center", espaco: 6.5 });
  cor(90, 90, 90);
  const linhasCab = [
    clinica?.cnpj ? `CNPJ ${String(clinica.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}` : "",
    clinica?.enderecoDocumento || "",
    [clinica?.telefoneDocumento, clinica?.emailDocumento].filter(Boolean).join("  ·  "),
  ].filter(Boolean);
  linhasCab.forEach((l) => escrever(l, { tamanho: 9, alinhar: "center", espaco: 4.2 }));
  y += 1;
  pdf.setDrawColor(15, 90, 95); pdf.setLineWidth(0.5); pdf.line(M, y, W - M, y);
  y += 10;

  // ---- título
  cor(20, 20, 20);
  escrever(String(titulo).toUpperCase(), { tamanho: 14, estilo: "bold", alinhar: "center", espaco: 7 });
  y += 4;

  // ---- paciente
  const idade = idadeDe(paciente?.nascimento);
  pdf.setDrawColor(210, 210, 210); pdf.setLineWidth(0.2);
  const topoBox = y - 5.5;
  cor(20, 20, 20);
  escrever(`Paciente: ${paciente?.nome || "—"}`, { tamanho: 11, estilo: "bold", espaco: 5.5 });
  const linhaPac = [
    idade ? `Nascimento: ${idade.texto} (${idade.idade} anos)` : "",
    paciente?.cpf ? `CPF: ${paciente.cpf}` : "",
  ].filter(Boolean).join("     ");
  if (linhaPac) escrever(linhaPac, { tamanho: 10, espaco: 5 });
  pdf.rect(M - 2, topoBox, largura + 4, y - topoBox + 0.5, "S");
  y += 8;

  // ---- corpo
  secoes.forEach((s) => {
    if (s.titulo) { cor(15, 90, 95); escrever(s.titulo, { tamanho: 11, estilo: "bold", espaco: 6 }); }
    cor(20, 20, 20);
    if (s.texto) { escrever(s.texto, { tamanho: 11, espaco: 5.8 }); y += 3; }
    (s.itens || []).forEach((it) => escrever(it, { tamanho: 11, espaco: 5.8, x: M + 3, largura: largura - 3 }));
    if (s.itens?.length) y += 3;
  });

  // ---- local/data + assinatura (mantidos juntos na mesma página)
  y += 12;
  if (y > H - 85) { pdf.addPage(); y = 30; }
  cor(20, 20, 20);
  escrever(`${clinica?.cidadeDocumento || "São Paulo"}, ${dataExtenso(data)}.`, { tamanho: 11, espaco: 6 });
  y += 22;
  pdf.setDrawColor(40, 40, 40); pdf.setLineWidth(0.3);
  pdf.line(W / 2 - 40, y, W / 2 + 40, y);
  y += 5;
  escrever(medico?.nome || "Médico(a) responsável", { tamanho: 11, estilo: "bold", alinhar: "center", espaco: 5 });
  const crm = medico?.boardNumber ? `CRM-${medico.boardState || "__"} ${medico.boardNumber}` : "CRM-__ ________";
  escrever([crm, medico?.especialidade].filter(Boolean).join("  ·  "), { tamanho: 10, alinhar: "center", espaco: 5 });
  cor(130, 130, 130);
  escrever("Assinatura e carimbo", { tamanho: 8, alinhar: "center", espaco: 4 });

  // ---- rodapé em todas as páginas
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); cor(140, 140, 140);
    pdf.text(`Emitido em ${data.toLocaleString("pt-BR")}${codigo ? `  ·  Doc. ${codigo}` : ""}`, M, H - 10);
    pdf.text(`Página ${i} de ${total}`, W - M, H - 10, { align: "right" });
  }

  const slug = String(titulo).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  const pac = String(paciente?.nome || "paciente").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  return { blob: pdf.output("blob"), nomeArquivo: `${slug}_${pac}.pdf` };
}

/**
 * Carrega o contexto, gera o PDF e abre numa nova aba (pra imprimir/salvar).
 * Se o navegador bloquear a aba, baixa o arquivo. Deve ser chamada direto de um clique.
 */
export async function emitirDocumentoPdf({ clinicaId, pacienteId, profissionalId, titulo, secoes, data, codigo }) {
  const janela = window.open("", "_blank"); // abre já no clique, pra não ser bloqueada
  try {
    const ctx = await carregarContextoDocumento({ clinicaId, pacienteId, profissionalId });
    const { blob, nomeArquivo } = await gerarPdfDocumento({ ...ctx, titulo, secoes, data, codigo });
    const url = URL.createObjectURL(blob);
    if (janela) { janela.location.href = url; }
    else {
      const a = document.createElement("a");
      a.href = url; a.download = nomeArquivo; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { blob, nomeArquivo, medicoSemCrm: !ctx.medico?.boardNumber };
  } catch (err) {
    janela?.close();
    throw err;
  }
}
