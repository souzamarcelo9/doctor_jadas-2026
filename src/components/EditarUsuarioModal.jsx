import { useEffect, useState } from "react";
import { X, UserCog, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc, atualizarDocumento } from "../lib/firestore";
import { enviarFotoProfissional } from "../lib/storage";

export default function EditarUsuarioModal({ open, onClose }) {
  const { clinicaId, profissionalId } = useTenant();
  const { data: membro, loading } = useFirestoreDoc(open && clinicaId ? `clinicas/${clinicaId}/membros` : null, profissionalId);

  const [form, setForm] = useState({ nome: "", especialidade: "", celular: "" });
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (membro) {
      setForm({ nome: membro.nome || "", especialidade: membro.especialidade || "", celular: membro.celular || "" });
      setFotoPreview(membro.fotoUrl || "");
    }
  }, [membro]);

  if (!open) return null;

  function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function salvar() {
    setErro(""); setSucesso(false);
    setSalvando(true);
    try {
      const dados = { ...form };
      if (fotoFile) {
        dados.fotoUrl = await enviarFotoProfissional(clinicaId, profissionalId, fotoFile);
      }
      await atualizarDocumento(`clinicas/${clinicaId}/membros`, profissionalId, dados);
      setFotoFile(null);
      setSucesso(true);
    } catch (err) {
      console.error("Erro ao salvar usuário:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const iniciais = (form.nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><UserCog size={18} /> Editar usuário</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-500 justify-center py-10"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center text-white font-display font-semibold text-lg overflow-hidden shrink-0">
                {fotoPreview ? <img src={fotoPreview} alt="" className="w-full h-full object-cover" /> : iniciais}
              </div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
                <Camera size={13} /> {fotoPreview ? "Trocar foto" : "Selecionar foto"}
                <input type="file" accept="image/*" onChange={handleFoto} className="hidden" />
              </label>
            </div>

            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Nome</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Especialidade</span>
              <input value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Celular</span>
              <input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} placeholder="(00) 00000-0000" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>

            {erro && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>}
            {sucesso && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-3">
                <CheckCircle2 size={14} /> Dados salvos com sucesso.
              </div>
            )}

            <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
              {salvando && <Loader2 size={15} className="animate-spin" />} Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
