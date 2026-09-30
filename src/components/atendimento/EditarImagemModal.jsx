import { useEffect, useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { X, Loader2, RotateCcw, RotateCw, Pencil, Undo2, Save, AlertTriangle, Maximize2 } from "lucide-react";
import { storage } from "../../firebase";
import { criarDocumento } from "../../lib/firestore";

const CORES = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff", "#111111"];

/** Editor de imagem simples (resize, rotação, marcação à mão livre) usando
 * só a Canvas API nativa do navegador — não precisa de nenhuma biblioteca
 * externa pra isso. Nunca sobrescreve a imagem original: salva o
 * resultado como um NOVO anexo, com `imagemOrigemId` apontando de volta
 * pro original, pra manter a integridade do prontuário (a foto que o
 * médico viu na hora não pode virar uma foto diferente depois). */
export default function EditarImagemModal({ imagem, clinicaId, pacienteId, pacientePath, atendimentoId, profissionalId, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const desenhandoRef = useRef(false);
  const blobUrlRef = useRef(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [escala, setEscala] = useState(100);
  const [rotacao, setRotacao] = useState(0);
  const [modoDesenho, setModoDesenho] = useState(false);
  const [cor, setCor] = useState(CORES[0]);
  const [historico, setHistorico] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const jaDesenhou = historico.length > 0;

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        // Baixa via fetch->blob (URL local, mesma origem) em vez de apontar
        // o <img> direto pro Storage — evita "tainted canvas" ao exportar
        // depois (canvas.toBlob falha silenciosamente/lança erro de
        // segurança se a imagem veio de outra origem sem CORS liberado).
        const resp = await fetch(imagem.url);
        if (!resp.ok) throw new Error("Falha ao baixar a imagem.");
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        const img = new Image();
        img.onload = () => {
          if (cancelado) return;
          imgRef.current = img;
          setCarregando(false);
        };
        img.onerror = () => { if (!cancelado) { setErro("Não foi possível carregar a imagem para edição."); setCarregando(false); } };
        img.src = blobUrl;
      } catch (err) {
        console.error("Erro ao carregar imagem para edição:", err);
        if (!cancelado) { setErro("Não foi possível carregar a imagem para edição."); setCarregando(false); }
      }
    }
    carregar();
    return () => {
      cancelado = true;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagem.url]);

  // Redesenha do zero (imagem + escala + rotação) sempre que um desses
  // parâmetros muda. Isso reseta qualquer marcação já feita — por isso os
  // controles de tamanho/rotação ficam desabilitados assim que existe
  // pelo menos um traço desenhado (aviso explícito na UI).
  useEffect(() => {
    if (carregando || !imgRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const fator = escala / 100;
    const girado90 = rotacao % 180 !== 0;
    const w = Math.round(img.width * fator);
    const h = Math.round(img.height * fator);
    canvas.width = girado90 ? h : w;
    canvas.height = girado90 ? w : h;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotacao * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    setHistorico([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, escala, rotacao]);

  function coordsRelativas(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * escalaX, y: (clientY - rect.top) * escalaY };
  }

  function iniciarDesenho(e) {
    if (!modoDesenho) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    setHistorico((h) => [...h, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    desenhandoRef.current = true;
    const { x, y } = coordsRelativas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function desenhar(e) {
    if (!modoDesenho || !desenhandoRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = coordsRelativas(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  function pararDesenho() { desenhandoRef.current = false; }

  function desfazer() {
    setHistorico((h) => {
      if (h.length === 0) return h;
      const anterior = h[h.length - 1];
      canvasRef.current.getContext("2d").putImageData(anterior, 0, 0);
      return h.slice(0, -1);
    });
  }

  async function salvarComoNova() {
    setSalvando(true);
    setErro("");
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
      if (!blob) throw new Error("Não foi possível gerar o arquivo da imagem editada.");
      const nomeBase = (imagem.titulo || "imagem").replace(/\.[^.]+$/, "");
      const nomeArquivo = `${nomeBase}_editada_${Date.now()}.png`;
      const path = `clinicas/${clinicaId}/pacientes/${pacienteId}/imagens/${Date.now()}_${nomeArquivo}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await criarDocumento(`${pacientePath}/imagens`, {
        titulo: nomeArquivo,
        categoria: imagem.categoria || "Documento",
        tag: "Editada",
        storagePath: path,
        url,
        imagemOrigemId: imagem.id,
        atendimentoId,
        profissionalId,
        ativo: true,
      });
      onClose(true);
    } catch (err) {
      console.error("Erro ao salvar imagem editada:", err);
      setErro(err.message || "Não foi possível salvar a imagem editada.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60" onClick={() => onClose(false)} />
      <div className="relative bg-white w-full max-w-3xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold text-sm flex items-center gap-2"><Maximize2 size={16} /> Editar imagem — {imagem.titulo}</span>
          <button onClick={() => onClose(false)} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-b border-black/5 bg-gray-50/60 shrink-0">
          <label className="flex items-center gap-2 text-xs text-ink-700">
            Tamanho
            <input
              type="range" min="25" max="150" step="5"
              value={escala} disabled={jaDesenhou}
              onChange={(e) => setEscala(Number(e.target.value))}
              className="w-28 disabled:opacity-40"
            />
            <span className="font-mono text-[11px] w-10">{escala}%</span>
          </label>

          <div className="flex items-center gap-1">
            <button onClick={() => setRotacao((r) => (r - 90 + 360) % 360)} disabled={jaDesenhou} title="Girar à esquerda" className="p-1.5 rounded-lg border border-black/10 text-ink-600 hover:bg-white disabled:opacity-40 focus-ring">
              <RotateCcw size={14} />
            </button>
            <button onClick={() => setRotacao((r) => (r + 90) % 360)} disabled={jaDesenhou} title="Girar à direita" className="p-1.5 rounded-lg border border-black/10 text-ink-600 hover:bg-white disabled:opacity-40 focus-ring">
              <RotateCw size={14} />
            </button>
          </div>

          <div className="w-px h-5 bg-black/10" />

          <button
            onClick={() => setModoDesenho((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg focus-ring ${modoDesenho ? "bg-brand-600 text-white" : "border border-black/10 text-ink-600 hover:bg-white"}`}
          >
            <Pencil size={13} /> Marcar na imagem
          </button>

          {modoDesenho && (
            <div className="flex items-center gap-1.5">
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-5 h-5 rounded-full border-2 ${cor === c ? "border-ink-900" : "border-white"}`}
                  style={{ backgroundColor: c, boxShadow: "0 0 0 1px rgba(0,0,0,0.15)" }}
                />
              ))}
              <button onClick={desfazer} disabled={!jaDesenhou} title="Desfazer último traço" className="p-1.5 rounded-lg border border-black/10 text-ink-600 hover:bg-white disabled:opacity-40 focus-ring ml-1">
                <Undo2 size={14} />
              </button>
            </div>
          )}
        </div>

        {jaDesenhou && (
          <p className="text-[11px] text-amber-700 bg-amber-50 px-5 py-1.5 border-b border-amber-100 shrink-0">Tamanho e rotação ficam bloqueados depois que você começa a marcar — desfaça as marcações (ou recomece) se precisar ajustar.</p>
        )}

        <div className="flex-1 overflow-auto p-5 flex items-center justify-center bg-gray-100/60 min-h-[300px]">
          {carregando && <div className="flex items-center gap-2 text-sm text-ink-500"><Loader2 size={16} className="animate-spin" /> Carregando imagem…</div>}
          {erro && !carregando && <div className="flex items-center gap-2 text-sm text-rose-600"><AlertTriangle size={16} /> {erro}</div>}
          <canvas
            ref={canvasRef}
            className={`max-w-full shadow-pop bg-white ${carregando || erro ? "hidden" : ""} ${modoDesenho ? "cursor-crosshair" : ""}`}
            onMouseDown={iniciarDesenho}
            onMouseMove={desenhar}
            onMouseUp={pararDesenho}
            onMouseLeave={pararDesenho}
            onTouchStart={iniciarDesenho}
            onTouchMove={desenhar}
            onTouchEnd={pararDesenho}
          />
        </div>

        <div className="px-5 py-3.5 border-t border-black/5 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-ink-500">Salva como um anexo novo — a imagem original não é alterada.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => onClose(false)} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
            <button onClick={salvarComoNova} disabled={salvando || carregando || !!erro} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar como novo anexo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
