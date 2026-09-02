import { useState } from "react";
import { useParams } from "react-router-dom";
import { Star, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useFirestoreDoc, atualizarDocumento } from "../lib/firestore";

export default function AvaliarConsulta() {
  const { clinicaId, avaliacaoId } = useParams();
  const { data: avaliacao, loading } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/avaliacoes` : null, avaliacaoId);

  const [nota, setNota] = useState(0);
  const [hoverNota, setHoverNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setErro("");
    if (nota === 0) { setErro("Toque em uma estrela pra dar sua nota."); return; }
    setEnviando(true);
    try {
      await atualizarDocumento(`clinicas/${clinicaId}/avaliacoes`, avaliacaoId, {
        nota, comentario: comentario.trim() || null, status: "respondida", respondidoEm: new Date().toISOString(),
      });
      setEnviado(true);
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
      setErro("Não foi possível enviar. Tente novamente em alguns instantes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f8f8] p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-display font-bold text-white text-sm">DP</div>
          <span className="font-display font-semibold tracking-wide text-ink-900">Doctor<span className="text-brand-500">PEP</span></span>
        </div>

        <div className="card p-7 text-center">
          {loading && <div className="flex items-center justify-center gap-2 text-sm text-ink-500 py-8"><Loader2 size={16} className="animate-spin" /> Carregando…</div>}

          {!loading && !avaliacao && (
            <div className="py-6">
              <AlertTriangle size={26} className="mx-auto text-amber-500 mb-2" />
              <p className="text-sm font-semibold text-ink-900">Link inválido ou expirado</p>
              <p className="text-xs text-ink-500 mt-1">Esse link de avaliação não existe mais.</p>
            </div>
          )}

          {!loading && avaliacao && (avaliacao.status === "respondida" || enviado) && (
            <div className="py-6">
              <CheckCircle2 size={30} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-ink-900">Obrigado pela sua avaliação!</p>
              <p className="text-xs text-ink-500 mt-1">Sua opinião ajuda a {avaliacao.clinicaNome || "clínica"} a melhorar.</p>
            </div>
          )}

          {!loading && avaliacao && avaliacao.status === "pendente" && !enviado && (
            <>
              <h1 className="font-display font-semibold text-lg text-ink-900">Como foi sua consulta?</h1>
              <p className="text-sm text-ink-500 mt-1 mb-5">{avaliacao.clinicaNome}</p>

              <div className="flex items-center justify-center gap-1.5 mb-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHoverNota(n)}
                    onMouseLeave={() => setHoverNota(0)}
                    onClick={() => setNota(n)}
                    className="focus-ring rounded"
                  >
                    <Star size={32} className={(hoverNota || nota) >= n ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
                  </button>
                ))}
              </div>

              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Quer contar mais alguma coisa? (opcional)"
                rows={3}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 focus-ring resize-none"
              />

              {erro && <div className="mt-3 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>}

              <button onClick={enviar} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring mt-4">
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null} Enviar avaliação
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
