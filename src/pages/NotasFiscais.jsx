import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar";
import NfseDocumentoAcoes from "../components/NfseDocumentoAcoes";
import { Receipt, PlugZap, Send, Clock3, CheckCircle2, AlertTriangle, Loader2, XCircle, Link2, Monitor, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc, useFirestoreCollection, criarDocumento, atualizarDocumento } from "../lib/firestore";
import { nfseEmitir } from "../lib/nfse";
import AutocompletePaciente from "../components/AutocompletePaciente";
import CampoCIndOp from "../components/CampoCIndOp";
import { cIndOpAutomatico, cIndOpValido } from "../lib/nfseCodigos";
import { emailValido } from "../lib/masks";

const statusTone = {
  autorizada: { label: "Autorizada", tone: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejeitada: { label: "Rejeitada", tone: "bg-rose-100 text-rose-700", icon: XCircle },
  processando: { label: "Processando", tone: "bg-amber-100 text-amber-700", icon: Clock3 },
  erro_certificado: { label: "Certificado rejeitado", tone: "bg-rose-100 text-rose-700", icon: XCircle },
  pendente: { label: "Pendente", tone: "bg-gray-100 text-gray-500", icon: Clock3 },
};

export default function NotasFiscais() {
  const { clinicaId, firebaseConfigured } = useTenant();
  const { data: clinica } = useFirestoreDoc("clinicas", clinicaId);
  const { data: historico, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/notasFiscais` : null, "criadoEm", "desc");
  const { data: pacientes } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, "nome", "asc");
  const { data: contasReceber } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/contasReceber` : null);
  const [issuing, setIssuing] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [contaVinculadaId, setContaVinculadaId] = useState("");
  const [notaAberta, setNotaAberta] = useState(null);
  const [form, setForm] = useState({ tomador: "", cpfCnpj: "", emailTomador: "", codigoServico: "", valor: "", aliquota: "", discriminacao: "Consulta médica", tipoAtendimento: "presencial", cIndOp: "", issRetido: false });
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 10;
  const totalPaginas = Math.max(1, Math.ceil(historico.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const historicoPagina = historico.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  // Se a pessoa ainda não editou o campo nesta sessão, usa o padrão salvo
  // na clínica — sem isso caía sempre no "04030" fixo, ignorando o que foi
  // configurado em Configurações → Dados Fiscais.
  const codigoServicoEfetivo = form.codigoServico || clinica?.codigoServicoPadrao || "04030";
  // Mesma lógica: usa o que a pessoa editou nesta sessão, senão o padrão
  // configurado pra clínica em Dados Fiscais, senão 0.02 (piso legal pra
  // serviços de saúde no regime normal em SP — não é universal, ver aviso
  // em Configurações → Dados Fiscais sobre Simples Nacional/SUP).
  const layoutV2 = !clinica?.simplesNacional;
  const cIndOpPadraoClinica = clinica?.cIndOpPadrao || "";
  // Código de fato usado: ajuste da nota > padrão da clínica > automático pelo tipo de atendimento.
  const cIndOpEfetivo = form.cIndOp || cIndOpPadraoClinica || cIndOpAutomatico(form.tipoAtendimento);
  const aliquotaEfetiva = form.aliquota || clinica?.aliquotaIssPadrao || "0.02";

  // Antes só listava contas "pendente" — mas no fluxo recomendado a
  // secretária marca como paga (recebe na hora) antes de liberar pro
  // fiscal emitir a NFS-e, então uma conta "pago" sem nota vinculada
  // também precisa aparecer aqui (senão ela some da lista assim que é
  // paga, exatamente quando deveria ficar disponível pra emissão).
  const contasDisponiveis = contasReceber.filter((c) => !c.notaFiscalId && (c.status === "pendente" || c.status === "pago"));

  function vincularConta(id) {
    setContaVinculadaId(id);
    const conta = contasReceber.find((c) => c.id === id);
    if (conta) {
      setForm((f) => ({ ...f, tomador: conta.pacienteNome || f.tomador, cpfCnpj: conta.pacienteCpf || f.cpfCnpj, valor: String(conta.valor ?? f.valor), discriminacao: conta.descricao || f.discriminacao }));
    }
  }

  const certConfigurado = clinica?.certificadoNfse?.status === "configurado";

  async function emitir(e) {
    e.preventDefault();
    if (!form.tomador.trim() || !form.valor) return;
    if (form.cIndOp && !cIndOpValido(form.cIndOp)) { setResultado({ status: "erro", detalhe: "O Indicador de Operação (cIndOp) precisa ter 6 dígitos." }); return; }
    if (form.emailTomador && !emailValido(form.emailTomador)) { setResultado({ status: "erro", detalhe: "E-mail do tomador inválido." }); return; }
    if (form.issRetido && form.cpfCnpj.replace(/\D/g, "").length !== 14) { setResultado({ status: "erro", detalhe: "ISS retido pelo tomador exige o CNPJ do tomador (empresa)." }); return; }
    setIssuing(true);
    setResultado(null);
    try {
      const notaRef = await criarDocumento(`clinicas/${clinicaId}/notasFiscais`, {
        tomador: form.tomador, cpfCnpj: form.cpfCnpj, codigoServico: codigoServicoEfetivo,
        valor: Number(form.valor), aliquota: aliquotaEfetiva, discriminacao: form.discriminacao,
        tipoAtendimento: form.tipoAtendimento,
        emailTomador: form.emailTomador || "",
        issRetido: form.issRetido,
        cIndOp: layoutV2 ? cIndOpEfetivo : null,
        status: "pendente",
      });

      const resposta = await nfseEmitir(clinicaId, notaRef.id, {
        cnpjPrestador: clinica?.cnpj,
        inscricaoMunicipalPrestador: clinica?.inscricaoMunicipal,
        cpfCnpjTomador: form.cpfCnpj,
        razaoSocialTomador: form.tomador,
        valorServicos: Number(form.valor),
        codigoServico: codigoServicoEfetivo,
        aliquota: Number(aliquotaEfetiva),
        discriminacao: form.discriminacao,
        tipoAtendimento: form.tipoAtendimento,
        nbs: clinica?.nbsPadrao,
        cClassTrib: clinica?.cClassTribPadrao,
        cIndOp: form.cIndOp || cIndOpPadraoClinica || "",
        issRetido: form.issRetido,
      });
      setResultado(resposta);

      // Alimenta o financeiro só quando a emissão de fato saiu (RPS montado
      // e enviado) — nunca duplica: se a nota foi emitida em cima de uma
      // conta a receber que já existia (ex: gerada pelo agendamento), só
      // vinculamos essa conta à nota; senão, criamos uma nova.
      if (resposta.status === "enviado_teste") {
        if (contaVinculadaId) {
          await atualizarDocumento(`clinicas/${clinicaId}/contasReceber`, contaVinculadaId, { notaFiscalId: notaRef.id });
        } else {
          await criarDocumento(`clinicas/${clinicaId}/contasReceber`, {
            descricao: form.discriminacao || "Nota fiscal avulsa",
            valor: Number(form.valor),
            vencimento: new Date().toISOString().slice(0, 10),
            status: "pendente",
            pacienteNome: form.tomador,
            origem: "nfse",
            notaFiscalId: notaRef.id,
          });
        }
      }

      setForm({ tomador: "", cpfCnpj: "", emailTomador: "", codigoServico: "", valor: "", aliquota: "", discriminacao: "Consulta médica", tipoAtendimento: "presencial", cIndOp: "", issRetido: false });
      setContaVinculadaId("");
    } catch (err) {
      console.error("Erro ao emitir NFS-e:", err);
      setResultado({ status: "erro", detalhe: err.message || "Falha ao emitir." });
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Notas Fiscais" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex justify-end">
          <Link to="/notas-fiscais/monitor" className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg focus-ring">
            <Monitor size={13} /> Abrir monitor de emissões
          </Link>
        </div>

        <div className="card p-4 flex items-start gap-3 bg-brand-50/40 border-brand-100">
          <PlugZap size={18} className="text-brand-600 mt-0.5 shrink-0" />
          <div className="text-xs text-ink-700">
            <span className="font-semibold text-ink-900">Integração NFS-e Paulistana (Prefeitura de São Paulo).</span>{" "}
            O RPS é montado, assinado e enviado no <strong>modo produtivo</strong> .
            Sem um certificado válido, a Prefeitura rejeita a conexão . Assim que houver um certificado ICP-Brasil real configurado, o resultado muda sozinho.
          </div>
        </div>

        {!certConfigurado && (
          <div className="card p-3.5 bg-amber-50 border-amber-100 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-700">Nenhum certificado digital configurado ainda — vá em <strong>Configurações → Certificado Digital</strong> antes de emitir.</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <form onSubmit={emitir} className="lg:col-span-2 card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={16} className="text-brand-600" />
              <span className="text-sm font-display font-semibold text-ink-900">Emitir NFS-e </span>
            </div>

            {contasDisponiveis.length > 0 && (
              <label className="block text-xs">
                <span className="text-ink-500 font-medium flex items-center gap-1"><Link2 size={12} /> Vincular a uma conta a receber existente (opcional)</span>
                <select value={contaVinculadaId} onChange={(e) => vincularConta(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                  <option value="">Nota avulsa (cria uma conta nova)</option>
                  {contasDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>{c.status === "pago" ? "✓ " : ""}{c.descricao} — {(c.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{c.status === "pago" ? " (pago)" : " (pendente)"}</option>
                  ))}
                </select>
                <span className="text-[11px] text-ink-500">Selecionar aqui evita lançar a mesma receita duas vezes no financeiro.</span>
              </label>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <AutocompletePaciente
                label="Tomador do serviço"
                value={form.tomador}
                pacientes={pacientes}
                onChange={(v) => setForm({ ...form, tomador: v })}
                onSelecionar={(p) => setForm((f) => ({ ...f, tomador: p.nome, cpfCnpj: p.cpf || f.cpfCnpj, emailTomador: p.email || f.emailTomador }))}
              />
              <Field label="CPF/CNPJ" value={form.cpfCnpj} onChange={(v) => setForm({ ...form, cpfCnpj: v })} />
              <Field label="E-mail do tomador (opcional — facilita o envio da nota)" type="email" value={form.emailTomador} onChange={(v) => setForm({ ...form, emailTomador: v })} />
              <label className="flex items-center gap-2 text-xs text-ink-700 self-end pb-2">
                <input type="checkbox" checked={form.issRetido} onChange={(e) => setForm({ ...form, issRetido: e.target.checked })} className="rounded accent-brand-600" />
                ISS retido pelo tomador <span className="text-ink-500">(só se o cliente for o responsável por recolher)</span>
              </label>
              <Field label="Código de serviço" value={codigoServicoEfetivo} onChange={(v) => setForm({ ...form, codigoServico: v })} />
              {codigoServicoEfetivo === "04030" && (
                <p className="text-[10px] text-emerald-600 -mt-1.5 col-span-2">✓ 04030 — "Medicina e biomedicina" (PJ), item 4.01, confirmado no Anexo 1 da IN SF/SUREM 08/2011 (atualizado até IN 03/2026).</p>
              )}
              <Field label="Valor do serviço (R$)" type="number" value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
              <Field label="Alíquota ISS (ex: 0.02 = 2%)" value={aliquotaEfetiva} onChange={(v) => setForm({ ...form, aliquota: v })} />
              {clinica?.simplesNacional && (
                <p className="text-[10px] text-amber-600 -mt-1.5 col-span-2">⚠ Clínica no Simples Nacional — essa alíquota muda mês a mês conforme o faturamento (Anexo III). Confirme o valor atual com o contador antes de emitir; não é um percentual fixo.</p>
              )}
              <label className="block text-xs">
                <span className="text-ink-500 font-medium">Tipo de atendimento</span>
                <select value={form.tipoAtendimento} onChange={(e) => setForm({ ...form, tipoAtendimento: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                  <option value="presencial">Presencial (no consultório)</option>
                  <option value="teleconsulta">Teleconsulta</option>
                  <option value="domiciliar">Atendimento domiciliar</option>
                </select>
              </label>
            </div>
            {layoutV2 ? (
              <div className="space-y-1.5">
                <div className="block text-xs">
                  <span className="text-ink-500 font-medium">Indicador de Operação (cIndOp)</span>
                  <CampoCIndOp
                    className="mt-1" value={form.cIndOp} onChange={(v) => setForm({ ...form, cIndOp: v })}
                    rotuloVazio={cIndOpPadraoClinica ? `Padrão da clínica (${cIndOpPadraoClinica})` : `Automático pelo tipo de atendimento (${cIndOpAutomatico(form.tipoAtendimento)})`}
                  />
                </div>
                <p className="text-[11px] text-ink-500">Será enviado: <strong>{cIndOpEfetivo}</strong>. O padrão da clínica fica em Configurações → Dados Fiscais. Reforma Tributária (IBS/CBS): NBS e cClassTrib também vêm de Dados Fiscais (hoje {clinica?.nbsPadrao || "123012100"} / {clinica?.cClassTribPadrao || "200029"}).</p>
              </div>
            ) : (
              <p className="text-[11px] text-ink-500">Clínica no Simples Nacional: a nota usa o layout v1 (só ISS), que não leva cIndOp, NBS nem IBS/CBS.</p>
            )}
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Discriminação dos serviços</span>
              <textarea rows={3} value={form.discriminacao} onChange={(e) => setForm({ ...form, discriminacao: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none" />
            </label>

            <button disabled={issuing || !firebaseConfigured || !certConfigurado} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {issuing ? (<><Loader2 size={16} className="animate-spin" /> Enviando ao web service da Prefeitura…</>) : (<><Send size={15} /> Emitir Nota Fiscal</>)}
            </button>

            {resultado && (
              <div className={`text-xs rounded-lg p-3 border ${resultado.status === "enviado_teste" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
                {resultado.detalhe}
              </div>
            )}
          </form>

          <div className="card p-4">
            <div className="text-sm font-display font-semibold text-ink-900 mb-3">Status da integração</div>
            <ul className="space-y-2.5 text-xs text-ink-700">
              <StatusRow label="Persistência no Firestore" ok />
              <StatusRow label="Montagem e assinatura do RPS" ok />
              <StatusRow label="Certificado digital" ok={certConfigurado} />
              <StatusRow label="Certificado ICP-Brasil real" />
            </ul>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 text-sm font-display font-semibold text-ink-900">Notas emitidas</div>
          {loading ? (
            <div className="p-8 flex justify-center text-ink-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
          ) : historico.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">Nenhuma nota emitida ainda.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500 border-b border-black/5">
                  <Th>Tomador</Th><Th>Valor</Th><Th>Data</Th><Th>Status</Th><Th>Documento</Th>
                </tr>
              </thead>
              <tbody>
                {historicoPagina.map((n) => {
                  const S = statusTone[n.status] || statusTone.pendente;
                  const emailSugerido = n.emailTomador || contasReceber.find((c) => c.notaFiscalId === n.id)?.pacienteEmail || "";
                  return (
                    <Fragment key={n.id}>
                      <tr className="border-b border-black/5 last:border-0">
                        <Td>{n.tomador}</Td>
                        <Td>{(n.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                        <Td>{n.criadoEm?.toDate ? n.criadoEm.toDate().toLocaleDateString("pt-BR") : "—"}</Td>
                        <Td><span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${S.tone}`}><S.icon size={11} /> {S.label}</span></Td>
                        <Td>
                          {n.status === "autorizada" ? (
                            <button onClick={() => setNotaAberta(notaAberta === n.id ? null : n.id)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                              <FileDown size={13} /> {notaAberta === n.id ? "Fechar" : "Abrir / enviar"}
                            </button>
                          ) : "—"}
                        </Td>
                      </tr>
                      {notaAberta === n.id && (
                        <tr className="border-b border-black/5 bg-gray-50/50">
                          <td colSpan={5} className="px-4 py-3">
                            <NfseDocumentoAcoes clinicaId={clinicaId} nota={n} emailSugerido={emailSugerido} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && historico.length > ITENS_POR_PAGINA && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-black/5">
              <span className="text-[11px] text-ink-500">Página {paginaAtual} de {totalPaginas} · {historico.length} notas no total</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="p-1.5 rounded-lg border border-black/10 text-ink-500 disabled:opacity-40 focus-ring">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="p-1.5 rounded-lg border border-black/10 text-ink-500 disabled:opacity-40 focus-ring">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <input {...props} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}
function StatusRow({ label, ok }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-gray-300"}`} />
      {label}
      <span className="ml-auto text-[10px] text-ink-500">{ok ? "pronto" : "pendente"}</span>
    </li>
  );
}
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px]">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
