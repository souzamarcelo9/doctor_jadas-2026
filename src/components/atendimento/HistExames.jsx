import { useMemo, useRef, useState } from "react";
import { Search, ArrowUpDown, Upload, FileText, LineChart as LineChartIcon, Plus, Loader2, X, Paperclip, ExternalLink, Trash2, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../firebase";
import { examFavorites } from "../../data/mockData";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento, alternarAtivo, atualizarDocumento } from "../../lib/firestore";

const RESULTADOS = ["Normal", "Alterado"];
const TAMANHO_MAX = 25 * 1024 * 1024; // mesmo limite do storage.rules
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const isoParaBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const dataBase = (r) => r.realizado || (r.criadoEm?.toDate ? r.criadoEm.toDate().toISOString().slice(0, 10) : "");

export default function HistExames() {
  const { clinicaId, pacienteId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const caminho = `${pacientePath}/examesSolicitados`;
  const { data: todos, loading } = useFirestoreCollection(caminho);
  const [novoExame, setNovoExame] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [busca, setBusca] = useState("");
  const [maisAntigoPrimeiro, setMaisAntigoPrimeiro] = useState(false);
  const [enviandoId, setEnviandoId] = useState(null);
  const [erro, setErro] = useState("");
  const [detalheId, setDetalheId] = useState(null);
  const [evolucaoId, setEvolucaoId] = useState(null);
  const inputRef = useRef(null);
  const alvoUploadRef = useRef(null);

  const rows = useMemo(() => {
    const termo = norm(busca);
    const lista = todos.filter((r) => (mostrarInativos || r.ativo !== false) && (!termo || norm(r.exame).includes(termo)));
    return maisAntigoPrimeiro ? [...lista].reverse() : lista;
  }, [todos, mostrarInativos, busca, maisAntigoPrimeiro]);

  const detalhe = todos.find((r) => r.id === detalheId) || null;
  const evolucao = todos.find((r) => r.id === evolucaoId) || null;

  async function solicitar(nomeExame) {
    const nome = nomeExame || novoExame;
    if (!nome.trim() || !firebaseConfigured) return;
    setSalvando(true);
    setErro("");
    try {
      await criarDocumento(caminho, {
        exame: nome.trim(), qtd: 1, valor: 0, resultado: "", ativo: true, atendimentoId, profissionalId,
      });
      setNovoExame("");
    } catch (err) {
      console.error("Erro ao solicitar exame:", err);
      setErro("Não foi possível solicitar o exame. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const salvarCampo = (id, dados) =>
    atualizarDocumento(caminho, id, dados).catch((err) => {
      console.error("Erro ao salvar exame:", err);
      setErro("Não foi possível salvar a alteração. Tente novamente.");
    });

  function escolherArquivo(exameId) {
    alvoUploadRef.current = exameId;
    inputRef.current?.click();
  }

  async function enviarLaudo(e) {
    const file = e.target.files?.[0];
    const exameId = alvoUploadRef.current;
    if (inputRef.current) inputRef.current.value = "";
    if (!file || !exameId || !firebaseConfigured) return;
    setErro("");
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!ehPdf && !file.type.startsWith("image/")) return setErro("Formato não aceito. Envie um PDF ou uma imagem (JPG, PNG…).");
    if (file.size >= TAMANHO_MAX) return setErro("Arquivo maior que 25 MB. Reduza o tamanho e tente de novo.");
    setEnviandoId(exameId);
    try {
      const anterior = todos.find((r) => r.id === exameId)?.laudo;
      const nomeSeguro = file.name.replace(/[^\w.-]+/g, "_");
      const storagePath = `clinicas/${clinicaId}/pacientes/${pacienteId}/exames/${exameId}/laudo_${Date.now()}_${nomeSeguro}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: ehPdf ? "application/pdf" : file.type });
      const url = await getDownloadURL(storageRef);
      await atualizarDocumento(caminho, exameId, {
        laudo: { url, nome: file.name, tipo: ehPdf ? "pdf" : "imagem", storagePath, enviadoEm: new Date().toISOString() },
      });
      if (anterior?.storagePath) deleteObject(ref(storage, anterior.storagePath)).catch(() => {});
    } catch (err) {
      console.error("Erro no upload do laudo:", err);
      setErro("Não foi possível enviar o laudo. Verifique a conexão e tente novamente.");
    } finally {
      setEnviandoId(null);
    }
  }

  async function removerLaudo(r) {
    if (!r.laudo || !window.confirm("Remover o laudo anexado a este exame?")) return;
    try {
      await atualizarDocumento(caminho, r.id, { laudo: null });
      if (r.laudo.storagePath) deleteObject(ref(storage, r.laudo.storagePath)).catch(() => {});
    } catch (err) {
      console.error("Erro ao remover laudo:", err);
      setErro("Não foi possível remover o laudo.");
    }
  }

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={enviarLaudo} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="rounded accent-brand-600" /> Exibir inativos
        </label>
        <div className="flex-1" />
        <select value="" onChange={(e) => e.target.value && solicitar(e.target.value)} disabled={salvando} className="text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring max-w-[200px]">
          <option value="">Favoritos...</option>
          {examFavorites.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" className="text-xs border border-black/10 rounded-lg pl-7 pr-2.5 py-1.5 focus-ring" />
        </div>
        <button onClick={() => setMaisAntigoPrimeiro((v) => !v)} title={maisAntigoPrimeiro ? "Mais antigos primeiro" : "Mais recentes primeiro"} className={`p-1.5 rounded-lg border focus-ring ${maisAntigoPrimeiro ? "border-brand-300 text-brand-700 bg-brand-50" : "border-black/10 text-ink-500"}`}><ArrowUpDown size={14} /></button>
      </div>

      <div className="flex flex-wrap gap-2">
        {examFavorites.map((c) => (
          <button key={c} onClick={() => solicitar(c)} disabled={salvando} className="text-xs border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full px-3.5 py-1.5 focus-ring max-w-[220px] truncate" title={c}>
            {c}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); solicitar(); }} className="card p-3 flex gap-2">
        <input
          value={novoExame}
          onChange={(e) => setNovoExame(e.target.value)}
          placeholder="Nome do exame a solicitar…"
          className="flex-1 text-xs border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
        />
        <button type="submit" disabled={salvando || !firebaseConfigured} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg focus-ring">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Solicitar
        </button>
      </form>

      {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-brand-700 text-white text-left">
              <Th>Data</Th><Th className="min-w-[260px]">Exame</Th><Th>Qtd.</Th><Th>Valor</Th><Th>Realizado</Th><Th>Resultado</Th><Th>Laudo</Th><Th>Info</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-ink-500">Nenhum exame {busca ? "encontrado" : "solicitado"}.</td></tr>}
            {rows.map((r, i) => {
              const inativo = r.ativo === false;
              const enviando = enviandoId === r.id;
              return (
                <tr key={r.id} className={`border-t border-black/5 ${i % 2 ? "bg-brand-50/30" : ""} ${inativo ? "opacity-50" : ""}`}>
                  <Td className="whitespace-nowrap">{formatarData(r.criadoEm)}</Td>
                  <Td>{r.exame}{inativo && <span className="ml-2 text-[10px] text-ink-500">(inativo)</span>}</Td>
                  <Td><input type="number" min="1" defaultValue={r.qtd} onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== r.qtd && salvarCampo(r.id, { qtd: Number(e.target.value) })} className="w-12 text-xs border border-black/10 rounded px-1.5 py-1 text-center focus-ring" /></Td>
                  <Td><input type="number" min="0" step="0.01" defaultValue={r.valor} onBlur={(e) => Number(e.target.value) >= 0 && Number(e.target.value) !== r.valor && salvarCampo(r.id, { valor: Number(e.target.value) || 0 })} className="w-16 text-xs border border-black/10 rounded px-1.5 py-1 text-center focus-ring" /></Td>
                  <Td>
                    <input
                      type="date"
                      value={r.realizado || ""}
                      onChange={(e) => salvarCampo(r.id, { realizado: e.target.value })}
                      className="w-32 text-xs border border-black/10 rounded px-1.5 py-1 focus-ring"
                    />
                  </Td>
                  <Td>
                    <select
                      value={r.resultado || ""}
                      onChange={(e) => salvarCampo(r.id, { resultado: e.target.value })}
                      className={`w-24 text-xs border rounded px-1.5 py-1 focus-ring ${r.resultado === "Alterado" ? "border-rose-200 text-rose-700 bg-rose-50" : r.resultado === "Normal" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-black/10"}`}
                    >
                      <option value="">—</option>
                      {RESULTADOS.map((o) => <option key={o} value={o}>{o}</option>)}
                      {r.resultado && !RESULTADOS.includes(r.resultado) && <option value={r.resultado}>{r.resultado}</option>}
                    </select>
                  </Td>
                  <Td>
                    <button onClick={() => escolherArquivo(r.id)} disabled={enviando} title={r.laudo ? "Substituir laudo" : "Anexar laudo (PDF ou imagem)"} className={`p-1.5 rounded-md focus-ring disabled:opacity-60 ${r.laudo ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-brand-50 text-brand-600 hover:bg-brand-100"}`}>
                      {enviando ? <Loader2 size={13} className="animate-spin" /> : r.laudo ? <Paperclip size={13} /> : <Upload size={13} />}
                    </button>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setDetalheId(r.id)} title="Detalhes e laudo" className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 focus-ring"><FileText size={13} /></button>
                      <button onClick={() => setEvolucaoId(r.id)} title="Ver evolução" className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 focus-ring"><LineChartIcon size={13} /></button>
                    </div>
                  </Td>
                  <Td>
                    <button onClick={() => alternarAtivo(caminho, r.id, inativo)} className={`${inativo ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-500 hover:bg-rose-600"} text-white text-[11px] font-semibold px-3 py-1 rounded-md focus-ring whitespace-nowrap`}>
                      {inativo ? "Reativar" : "Inativar"}
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detalhe && <DetalheModal r={detalhe} onClose={() => setDetalheId(null)} onAnexar={() => escolherArquivo(detalhe.id)} onRemover={() => removerLaudo(detalhe)} enviando={enviandoId === detalhe.id} />}
      {evolucao && <EvolucaoModal r={evolucao} todos={todos} onClose={() => setEvolucaoId(null)} />}
    </div>
  );
}

function ModalBase({ titulo, onClose, children, largo }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className={`relative bg-white w-full ${largo ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] rounded-xl2 shadow-pop overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3.5 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold text-sm truncate pr-3">{titulo}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function DetalheModal({ r, onClose, onAnexar, onRemover, enviando }) {
  const l = r.laudo;
  return (
    <ModalBase titulo={`Detalhes — ${r.exame}`} onClose={onClose} largo>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
        <Info label="Solicitado em" value={formatarData(r.criadoEm)} />
        <Info label="Realizado em" value={isoParaBR(r.realizado)} />
        <Info label="Quantidade" value={r.qtd ?? 1} />
        <Info label="Resultado" value={r.resultado || "—"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-ink-900 flex-1 min-w-0 truncate">{l ? `Laudo: ${l.nome}` : "Nenhum laudo anexado"}</span>
        {l && <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg focus-ring"><ExternalLink size={13} /> Abrir / baixar</a>}
        <button onClick={onAnexar} disabled={enviando} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 px-3 py-1.5 rounded-lg focus-ring">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {l ? "Substituir" : "Anexar laudo"}
        </button>
        {l && <button onClick={onRemover} title="Remover laudo" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 focus-ring"><Trash2 size={14} /></button>}
      </div>

      {l ? (
        l.tipo === "pdf"
          ? <iframe src={l.url} title={l.nome} className="w-full h-[60vh] rounded-lg border border-black/10 bg-gray-50" />
          : <img src={l.url} alt={l.nome} className="max-h-[60vh] mx-auto rounded-lg border border-black/10 object-contain" />
      ) : (
        <p className="text-xs text-ink-500 text-center py-8 border border-dashed border-black/10 rounded-lg">Anexe o laudo do exame (PDF ou imagem, até 25 MB) para visualizá-lo aqui.</p>
      )}
    </ModalBase>
  );
}

function Info({ label, value }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div><div className="text-sm text-ink-900 font-medium">{value}</div></div>;
}

function EvolucaoModal({ r, todos, onClose }) {
  // Mesmo exame (nome sem acento/maiúscula), com resultado Normal/Alterado, em ordem de data.
  const pontos = useMemo(
    () => todos
      .filter((x) => x.ativo !== false && norm(x.exame) === norm(r.exame) && RESULTADOS.includes(x.resultado))
      .map((x) => ({ id: x.id, data: dataBase(x), resultado: x.resultado, nivel: x.resultado === "Normal" ? 1 : 0 }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((p) => ({ ...p, rotulo: isoParaBR(p.data) })),
    [todos, r.exame]
  );
  const primeiro = pontos[0], ultimo = pontos[pontos.length - 1];
  let resumo = null;
  if (pontos.length >= 2) {
    if (primeiro.resultado === ultimo.resultado) resumo = { tom: "text-ink-700 bg-gray-50", Icone: Minus, texto: `Sem mudança: permanece ${ultimo.resultado.toLowerCase()} desde ${primeiro.rotulo}.` };
    else if (ultimo.resultado === "Normal") resumo = { tom: "text-emerald-700 bg-emerald-50", Icone: TrendingUp, texto: `Melhora: passou de Alterado (${primeiro.rotulo}) para Normal (${ultimo.rotulo}).` };
    else resumo = { tom: "text-rose-700 bg-rose-50", Icone: TrendingDown, texto: `Piora: passou de Normal (${primeiro.rotulo}) para Alterado (${ultimo.rotulo}).` };
  }

  return (
    <ModalBase titulo={`Evolução — ${r.exame}`} onClose={onClose} largo>
      {pontos.length === 0 ? (
        <p className="text-xs text-ink-500 text-center py-8">Ainda não há resultados (Normal/Alterado) registrados para este exame. Preencha a coluna Resultado para acompanhar a evolução.</p>
      ) : (
        <div className="space-y-4">
          {resumo && <div className={`flex items-center gap-2 text-xs font-medium rounded-lg p-3 ${resumo.tom}`}><resumo.Icone size={15} /> {resumo.texto}</div>}
          {pontos.length === 1 && <p className="text-xs text-ink-500">Só há um resultado até agora — a linha de evolução aparece a partir do segundo.</p>}
          <div className="h-56" role="img" aria-label={`Evolução do exame ${r.exame}: ${pontos.map((p) => `${p.rotulo} ${p.resultado}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pontos} margin={{ top: 10, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} />
                <YAxis type="number" domain={[-0.3, 1.3]} ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? "Normal" : "Alterado")} tick={{ fontSize: 11, fill: "#6b7280" }} width={64} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v === 1 ? "Normal" : "Alterado", "Resultado"]} labelFormatter={(l) => `Realizado em ${l}`} />
                <Line
                  type="stepAfter" dataKey="nivel" stroke="#6b7280" strokeWidth={2} isAnimationActive={false}
                  dot={({ cx, cy, payload, index }) => (
                    <circle key={index} cx={cx} cy={cy} r={6} fill={payload.nivel === 1 ? "#059669" : "#e11d48"} stroke="#fff" strokeWidth={2} />
                  )}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-ink-500"><th className="py-1.5 font-semibold">Data</th><th className="py-1.5 font-semibold">Resultado</th></tr></thead>
            <tbody>
              {pontos.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="py-1.5">{p.rotulo}</td>
                  <td className={`py-1.5 font-semibold ${p.resultado === "Normal" ? "text-emerald-700" : "text-rose-700"}`}>{p.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-ink-500">Considera todos os registros deste exame no prontuário do paciente, pela data de realização (ou de solicitação, se ainda não preenchida).</p>
        </div>
      )}
    </ModalBase>
  );
}

function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function Th({ children, className = "" }) { return <th className={`px-3 py-2.5 font-semibold text-[11px] tracking-wide ${className}`}>{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 align-middle ${className}`}>{children}</td>; }
