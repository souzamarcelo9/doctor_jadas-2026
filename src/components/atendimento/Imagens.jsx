import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Upload, Image as ImageIcon, FileText, Stethoscope, ScissorsLineDashed, X, Loader2 } from "lucide-react";
import { storage } from "../../firebase";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../../lib/firestore";

const categoriaIcon = {
  Dermatologia: ImageIcon, Exame: Stethoscope, "Exame de imagem": ImageIcon,
  Documento: FileText, Procedimento: ScissorsLineDashed,
};
const categoriaTone = {
  Dermatologia: "from-rose-200 to-rose-300", Exame: "from-brand-200 to-brand-300",
  "Exame de imagem": "from-indigo-200 to-indigo-300", Documento: "from-amber-200 to-amber-300",
  Procedimento: "from-emerald-200 to-emerald-300",
};

export default function Imagens() {
  const { clinicaId, pacienteId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: items, loading } = useFirestoreCollection(`${pacientePath}/imagens`);
  const [preview, setPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !firebaseConfigured) return;
    setEnviando(true);
    try {
      const path = `clinicas/${clinicaId}/pacientes/${pacienteId}/imagens/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await criarDocumento(`${pacientePath}/imagens`, {
        titulo: file.name,
        categoria: "Documento",
        tag: "Upload manual",
        storagePath: path,
        url,
        atendimentoId,
        profissionalId,
        ativo: true,
      });
    } catch (err) {
      console.error("Erro no upload:", err);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">Imagens clínicas, exames de imagem e documentos anexados ao prontuário do paciente.</p>
        <label className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg focus-ring shrink-0 cursor-pointer">
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {enviando ? "Enviando…" : "Enviar arquivo"}
          <input ref={inputRef} type="file" onChange={handleFile} disabled={enviando || !firebaseConfigured} className="hidden" />
        </label>
      </div>

      {loading && <div className="text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
      {!loading && items.length === 0 && <p className="text-xs text-ink-500">Nenhuma imagem ou documento anexado ainda.</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((img) => {
          const Icon = categoriaIcon[img.categoria] || ImageIcon;
          return (
            <button key={img.id} onClick={() => setPreview(img)} className="card overflow-hidden text-left hover:shadow-pop transition-shadow focus-ring">
              {img.url && img.titulo?.match(/\.(jpe?g|png|webp|gif)$/i) ? (
                <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${img.url})` }} />
              ) : (
                <div className={`h-28 bg-gradient-to-br ${categoriaTone[img.categoria] || "from-gray-200 to-gray-300"} flex items-center justify-center`}>
                  <Icon size={28} className="text-white/90" />
                </div>
              )}
              <div className="p-3">
                <div className="text-xs font-semibold text-ink-900 truncate">{img.titulo}</div>
                <div className="text-[11px] text-ink-500 mt-0.5">{formatarData(img.criadoEm)}</div>
                <span className="inline-block mt-1.5 text-[10px] font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{img.tag}</span>
              </div>
            </button>
          );
        })}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-xl2 shadow-pop max-w-md w-full overflow-hidden animate-slideIn">
            {preview.url && preview.titulo?.match(/\.(jpe?g|png|webp|gif)$/i) ? (
              <img src={preview.url} alt={preview.titulo} className="w-full h-48 object-cover" />
            ) : (
              <div className={`h-48 bg-gradient-to-br ${categoriaTone[preview.categoria] || "from-gray-200 to-gray-300"} flex items-center justify-center relative`}>
                {(() => { const Icon = categoriaIcon[preview.categoria] || ImageIcon; return <Icon size={44} className="text-white/90" />; })()}
              </div>
            )}
            <button onClick={() => setPreview(null)} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 hover:bg-black/40 text-white focus-ring">
              <X size={16} />
            </button>
            <div className="p-4">
              <div className="text-sm font-semibold text-ink-900">{preview.titulo}</div>
              <div className="text-xs text-ink-500 mt-1">{preview.categoria} · {formatarData(preview.criadoEm)}</div>
              <span className="inline-block mt-2 text-[10px] font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{preview.tag}</span>
              {preview.url && (
                <a href={preview.url} target="_blank" rel="noreferrer" className="block mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Abrir arquivo original ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleDateString("pt-BR") : "—"; }
