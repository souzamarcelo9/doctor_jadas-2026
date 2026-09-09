import { useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import { Plus, Loader2, MoreVertical, ChevronLeft, ChevronRight, Trash2, LayoutGrid } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, useFirestoreDoc, criarDocumento, atualizarDocumento, salvarDocumentoComId } from "../lib/firestore";
import TarefaDetalheModal from "../components/TarefaDetalheModal";

const CORES_COLUNA = ["bg-sky-400", "bg-amber-400", "bg-violet-400", "bg-emerald-400", "bg-rose-400", "bg-brand-400"];
const prioridadeTone = { alta: "bg-rose-50 text-rose-700", media: "bg-amber-50 text-amber-700", baixa: "bg-emerald-50 text-emerald-700" };
const prioridadeLabel = { alta: "Alta", media: "Média", baixa: "Baixa" };

function novasColunasPadrao() {
  return [
    { id: crypto.randomUUID(), nome: "A Fazer" },
    { id: crypto.randomUUID(), nome: "Em Andamento" },
    { id: crypto.randomUUID(), nome: "Feito" },
  ];
}

export default function Tarefas() {
  const { clinicaId, profissionalId } = useTenant();
  const { data: quadro, loading: loadingQuadro } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/quadroTarefas` : null, "config");
  const { data: tarefas, loading: loadingTarefas } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/tarefas` : null, "criadoEm", "asc");
  const { data: membros } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/membros` : null, "nome", "asc");

  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const [tarefaSelecionada, setTarefaSelecionada] = useState(null);
  const [novaColunaAberta, setNovaColunaAberta] = useState(false);
  const [nomeNovaColuna, setNomeNovaColuna] = useState("");

  const colunas = quadro?.colunas || [];

  const tarefasVisiveis = useMemo(
    () => (somenteMinhas ? tarefas.filter((t) => t.atribuidoA === profissionalId) : tarefas),
    [tarefas, somenteMinhas, profissionalId]
  );

  function tarefasDaColuna(colunaId) {
    return tarefasVisiveis
      .filter((t) => (t.colunaId && colunas.some((c) => c.id === t.colunaId) ? t.colunaId : colunas[0]?.id) === colunaId)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  async function criarQuadroPadrao() {
    await salvarDocumentoComId(`clinicas/${clinicaId}/quadroTarefas`, "config", { colunas: novasColunasPadrao() });
  }

  async function salvarColunas(novasColunas) {
    await salvarDocumentoComId(`clinicas/${clinicaId}/quadroTarefas`, "config", { colunas: novasColunas });
  }

  async function adicionarColuna(e) {
    e.preventDefault();
    if (!nomeNovaColuna.trim()) return;
    await salvarColunas([...colunas, { id: crypto.randomUUID(), nome: nomeNovaColuna.trim() }]);
    setNomeNovaColuna("");
    setNovaColunaAberta(false);
  }

  async function renomearColuna(id, nome) {
    await salvarColunas(colunas.map((c) => (c.id === id ? { ...c, nome } : c)));
  }

  async function moverColuna(id, direcao) {
    const idx = colunas.findIndex((c) => c.id === id);
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= colunas.length) return;
    const novas = [...colunas];
    [novas[idx], novas[novoIdx]] = [novas[novoIdx], novas[idx]];
    await salvarColunas(novas);
  }

  async function removerColuna(id) {
    if (colunas.length <= 1) return;
    const restantes = colunas.filter((c) => c.id !== id);
    // Tarefas órfãs da coluna removida migram pra primeira coluna restante,
    // pra não sumirem do quadro.
    const orfas = tarefas.filter((t) => t.colunaId === id);
    await Promise.all(orfas.map((t) => atualizarDocumento(`clinicas/${clinicaId}/tarefas`, t.id, { colunaId: restantes[0].id })));
    await salvarColunas(restantes);
  }

  async function criarTarefaRapida(colunaId, titulo) {
    if (!titulo.trim()) return;
    const lista = tarefasDaColuna(colunaId);
    const maxOrdem = lista.length ? Math.max(...lista.map((t) => t.ordem ?? 0)) : 0;
    await criarDocumento(`clinicas/${clinicaId}/tarefas`, {
      titulo: titulo.trim(),
      atribuidoA: profissionalId,
      atribuidoNome: "Você",
      prioridade: "media",
      prazo: null,
      colunaId,
      ordem: maxOrdem + 1,
      criadoPor: profissionalId,
    });
  }

  async function moverTarefaParaFim(tarefaId, colunaId) {
    const lista = tarefasDaColuna(colunaId);
    const maxOrdem = lista.length ? Math.max(...lista.map((t) => t.ordem ?? 0)) : 0;
    await atualizarDocumento(`clinicas/${clinicaId}/tarefas`, tarefaId, { colunaId, ordem: maxOrdem + 1 });
  }

  async function moverTarefaRelativo(tarefaId, colunaId, alvo, antes) {
    if (tarefaId === alvo.id) return;
    const lista = tarefasDaColuna(colunaId).filter((t) => t.id !== tarefaId);
    const idx = lista.findIndex((t) => t.id === alvo.id);
    const anterior = antes ? lista[idx - 1] : lista[idx];
    const posterior = antes ? lista[idx] : lista[idx + 1];
    const ordemAnterior = anterior ? (anterior.ordem ?? 0) : (posterior ? (posterior.ordem ?? 0) - 1 : 0);
    const ordemPosterior = posterior ? (posterior.ordem ?? 0) : (anterior ? (anterior.ordem ?? 0) + 1 : 1);
    await atualizarDocumento(`clinicas/${clinicaId}/tarefas`, tarefaId, { colunaId, ordem: (ordemAnterior + ordemPosterior) / 2 });
  }

  const carregando = loadingQuadro || loadingTarefas;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Lista de Tarefas" />
      <main className="flex-1 p-4 lg:p-6 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <button
            onClick={() => setSomenteMinhas((s) => !s)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg focus-ring ${somenteMinhas ? "bg-brand-600 text-white" : "bg-white border border-black/10 text-ink-700 hover:bg-gray-50"}`}
          >
            Só minhas tarefas
          </button>
        </div>

        {carregando && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

        {!carregando && colunas.length === 0 && (
          <div className="card p-8 text-center max-w-sm mx-auto">
            <LayoutGrid size={26} className="mx-auto text-ink-400 mb-2" />
            <p className="text-sm text-ink-700 font-medium">Nenhum quadro criado ainda.</p>
            <button onClick={criarQuadroPadrao} className="mt-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg focus-ring">
              Criar quadro (A Fazer / Em Andamento / Feito)
            </button>
          </div>
        )}

        {!carregando && colunas.length > 0 && (
          <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 pb-2">
            {colunas.map((coluna, i) => (
              <ColunaKanban
                key={coluna.id}
                coluna={coluna}
                corAccent={CORES_COLUNA[i % CORES_COLUNA.length]}
                tarefas={tarefasDaColuna(coluna.id)}
                podeMoverEsquerda={i > 0}
                podeMoverDireita={i < colunas.length - 1}
                onRenomear={(nome) => renomearColuna(coluna.id, nome)}
                onMover={(dir) => moverColuna(coluna.id, dir)}
                onRemover={() => removerColuna(coluna.id)}
                onCriarTarefa={(titulo) => criarTarefaRapida(coluna.id, titulo)}
                onAbrirTarefa={setTarefaSelecionada}
                onDropNaColuna={(tarefaId) => moverTarefaParaFim(tarefaId, coluna.id)}
                onDropNoCard={(tarefaId, alvo, antes) => moverTarefaRelativo(tarefaId, coluna.id, alvo, antes)}
              />
            ))}

            <div className="w-64 shrink-0">
              {novaColunaAberta ? (
                <form onSubmit={adicionarColuna} className="card p-2.5 space-y-2">
                  <input
                    autoFocus
                    value={nomeNovaColuna}
                    onChange={(e) => setNomeNovaColuna(e.target.value)}
                    onBlur={() => !nomeNovaColuna.trim() && setNovaColunaAberta(false)}
                    placeholder="Nome da lista"
                    className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg focus-ring">Adicionar</button>
                    <button type="button" onClick={() => setNovaColunaAberta(false)} className="text-xs text-ink-500 px-2">Cancelar</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setNovaColunaAberta(true)} className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900 bg-black/[0.03] hover:bg-black/5 w-full px-3 py-2.5 rounded-lg focus-ring">
                  <Plus size={13} /> Adicionar lista
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {tarefaSelecionada && (
        <TarefaDetalheModal
          clinicaId={clinicaId}
          tarefa={tarefaSelecionada}
          colunas={colunas}
          membros={membros}
          onClose={() => setTarefaSelecionada(null)}
        />
      )}
    </div>
  );
}

function ColunaKanban({ coluna, corAccent, tarefas, podeMoverEsquerda, podeMoverDireita, onRenomear, onMover, onRemover, onCriarTarefa, onAbrirTarefa, onDropNaColuna, onDropNoCard }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(coluna.nome);
  const [novoCartaoAberto, setNovoCartaoAberto] = useState(false);
  const [tituloNovoCartao, setTituloNovoCartao] = useState("");
  const [arrastandoSobre, setArrastandoSobre] = useState(false);

  function salvarNome() {
    setEditandoNome(false);
    if (nomeEdit.trim() && nomeEdit.trim() !== coluna.nome) onRenomear(nomeEdit.trim());
    else setNomeEdit(coluna.nome);
  }

  function handleCriarCartao(e) {
    e.preventDefault();
    if (!tituloNovoCartao.trim()) { setNovoCartaoAberto(false); return; }
    onCriarTarefa(tituloNovoCartao);
    setTituloNovoCartao("");
  }

  return (
    <div
      className={`w-72 shrink-0 flex flex-col bg-gray-50 rounded-xl2 border ${arrastandoSobre ? "border-brand-400 bg-brand-50/40" : "border-black/5"}`}
      onDragOver={(e) => { e.preventDefault(); setArrastandoSobre(true); }}
      onDragLeave={() => setArrastandoSobre(false)}
      onDrop={(e) => { e.preventDefault(); setArrastandoSobre(false); onDropNaColuna(e.dataTransfer.getData("text/plain")); }}
    >
      <div className={`h-1.5 rounded-t-xl2 ${corAccent}`} />
      <div className="flex items-center gap-2 px-3 py-2.5">
        {editandoNome ? (
          <input
            autoFocus
            value={nomeEdit}
            onChange={(e) => setNomeEdit(e.target.value)}
            onBlur={salvarNome}
            onKeyDown={(e) => e.key === "Enter" && salvarNome()}
            className="flex-1 text-sm font-semibold border border-black/10 rounded px-1.5 py-0.5 focus-ring"
          />
        ) : (
          <button onClick={() => setEditandoNome(true)} className="flex-1 text-left text-sm font-display font-semibold text-ink-900 truncate">{coluna.nome}</button>
        )}
        <span className="text-[11px] text-ink-500 font-medium">{tarefas.length}</span>
        <div className="relative">
          <button onClick={() => setMenuAberto((m) => !m)} className="p-1 rounded hover:bg-black/5 text-ink-500 focus-ring"><MoreVertical size={14} /></button>
          {menuAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-pop border border-black/5 py-1 z-20">
                <button onClick={() => { onMover(-1); setMenuAberto(false); }} disabled={!podeMoverEsquerda} className="w-full flex items-center gap-2 text-xs text-ink-700 hover:bg-gray-50 disabled:opacity-40 px-3 py-1.5 text-left">
                  <ChevronLeft size={12} /> Mover pra esquerda
                </button>
                <button onClick={() => { onMover(1); setMenuAberto(false); }} disabled={!podeMoverDireita} className="w-full flex items-center gap-2 text-xs text-ink-700 hover:bg-gray-50 disabled:opacity-40 px-3 py-1.5 text-left">
                  <ChevronRight size={12} /> Mover pra direita
                </button>
                <button onClick={() => { onRemover(); setMenuAberto(false); }} className="w-full flex items-center gap-2 text-xs text-rose-600 hover:bg-rose-50 px-3 py-1.5 text-left">
                  <Trash2 size={12} /> Excluir lista
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-2 min-h-[40px]">
        {tarefas.map((t) => (
          <CartaoTarefa key={t.id} tarefa={t} onAbrir={() => onAbrirTarefa(t)} onDropNoCard={onDropNoCard} />
        ))}
      </div>

      <div className="p-2">
        {novoCartaoAberto ? (
          <form onSubmit={handleCriarCartao}>
            <textarea
              autoFocus
              value={tituloNovoCartao}
              onChange={(e) => setTituloNovoCartao(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCriarCartao(e); } }}
              onBlur={handleCriarCartao}
              placeholder="Título do cartão…"
              rows={2}
              className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none bg-white"
            />
          </form>
        ) : (
          <button onClick={() => setNovoCartaoAberto(true)} className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900 hover:bg-black/5 w-full px-2 py-1.5 rounded-lg focus-ring">
            <Plus size={13} /> Adicionar cartão
          </button>
        )}
      </div>
    </div>
  );
}

function CartaoTarefa({ tarefa, onAbrir, onDropNoCard }) {
  const [sobre, setSobre] = useState(null); // "cima" | "baixo" | null

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSobre(e.clientY < rect.top + rect.height / 2 ? "cima" : "baixo");
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const tarefaId = e.dataTransfer.getData("text/plain");
    onDropNoCard(tarefaId, tarefa, sobre === "cima");
    setSobre(null);
  }

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", tarefa.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={handleDragOver}
      onDragLeave={() => setSobre(null)}
      onDrop={handleDrop}
      onClick={onAbrir}
      className={`bg-white rounded-lg border border-black/5 p-2.5 cursor-pointer hover:shadow-sm transition-shadow ${sobre === "cima" ? "border-t-2 border-t-brand-500" : ""} ${sobre === "baixo" ? "border-b-2 border-b-brand-500" : ""}`}
    >
      <div className="text-sm text-ink-900 leading-snug">{tarefa.titulo}</div>
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${prioridadeTone[tarefa.prioridade] || prioridadeTone.media}`}>{prioridadeLabel[tarefa.prioridade] || "Média"}</span>
        {tarefa.atribuidoNome && <span className="text-[10px] text-ink-500">{tarefa.atribuidoNome}</span>}
        {tarefa.prazo && <span className="text-[10px] text-ink-500">· {tarefa.prazo.split("-").reverse().join("/")}</span>}
      </div>
    </div>
  );
}
