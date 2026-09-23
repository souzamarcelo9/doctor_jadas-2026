import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ClipboardCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useFirestoreDoc, atualizarDocumento } from "../lib/firestore";
import { paraArray } from "../lib/arrays";
import logoNucleo from "../assets/logo-nucleo.png";

export default function TriagemPublica() {
  const { clinicaId, conviteId } = useParams();
  const { data: convite, loading } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/convitesFormulario` : null, conviteId);

  const [valores, setValores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  const campos = useMemo(() => paraArray(convite?.campos), [convite?.campos]);

  const scoreTotal = useMemo(() => {
    let total = 0;
    for (const campo of campos) {
      const v = valores[campo.id];
      if (campo.tipo === "numero") total += Number(v) || 0;
      if (campo.tipo === "opcoes") {
        const opcao = paraArray(campo.opcoes).find((o) => o.label === v);
        total += opcao?.valor || 0;
      }
    }
    return total;
  }, [valores, campos]);

  async function enviar() {
    setErro("");
    const faltando = campos.filter((c) => c.tipo !== "texto" && (valores[c.id] === undefined || valores[c.id] === ""));
    if (faltando.length > 0) { setErro("Responda todas as perguntas antes de enviar."); return; }
    setEnviando(true);
    try {
      const respostas = campos.map((c) => {
        const v = valores[c.id] ?? "";
        const pontos = c.tipo === "numero" ? (Number(v) || 0) : c.tipo === "opcoes" ? (paraArray(c.opcoes).find((o) => o.label === v)?.valor || 0) : 0;
        return { campoId: c.id, label: c.label, tipo: c.tipo, valor: v, pontos };
      });
      await atualizarDocumento(`clinicas/${clinicaId}/convitesFormulario`, conviteId, {
        respostas,
        scoreTotal: convite.pontuavel === false ? null : scoreTotal,
        status: "respondido",
        respondidoEm: new Date().toISOString(),
      });
      setEnviado(true);
    } catch (err) {
      console.error("Erro ao enviar formulário de triagem:", err);
      setErro("Não foi possível enviar. Tente novamente em alguns instantes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f8f8] p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 justify-center mb-8">
          <img src={logoNucleo} alt="Núcleo" className="w-9 h-9 object-contain" />
          <span className="font-display font-semibold tracking-wide text-ink-900">Doctor<span className="text-brand-500">JADS</span></span>
        </div>

        <div className="card p-7">
          {loading && <div className="flex items-center justify-center gap-2 text-sm text-ink-500 py-8"><Loader2 size={16} className="animate-spin" /> Carregando…</div>}

          {!loading && !convite && (
            <div className="py-6 text-center">
              <AlertTriangle size={26} className="mx-auto text-amber-500 mb-2" />
              <p className="text-sm font-semibold text-ink-900">Link inválido ou expirado</p>
              <p className="text-xs text-ink-500 mt-1">Esse link de formulário não existe mais.</p>
            </div>
          )}

          {!loading && convite && (convite.status === "respondido" || enviado) && (
            <div className="py-6 text-center">
              <CheckCircle2 size={30} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-ink-900">Obrigado por preencher!</p>
              <p className="text-xs text-ink-500 mt-1">Suas respostas já chegaram na {convite.clinicaNome || "clínica"} — pode fechar esta página.</p>
            </div>
          )}

          {!loading && convite && convite.status === "pendente" && !enviado && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardCheck size={18} className="text-brand-600" />
                <h1 className="font-display font-semibold text-lg text-ink-900">{convite.formularioNome}</h1>
              </div>
              <p className="text-sm text-ink-500 mb-5">
                Olá{convite.pacienteNome ? `, ${convite.pacienteNome.split(" ")[0]}` : ""}! Preencha antes da sua consulta na {convite.clinicaNome || "clínica"} — isso ajuda o médico a te atender melhor.
              </p>

              <div className="space-y-4">
                {campos.map((campo) => (
                  <div key={campo.id} className="space-y-1.5">
                    <span className="text-xs font-medium text-ink-700">{campo.label}</span>
                    {campo.tipo === "numero" && (
                      <input
                        type="number"
                        value={valores[campo.id] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                        className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
                      />
                    )}
                    {campo.tipo === "texto" && (
                      <textarea
                        value={valores[campo.id] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                        rows={2}
                        className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring resize-none"
                      />
                    )}
                    {campo.tipo === "opcoes" && (
                      <div className="flex flex-wrap gap-2">
                        {paraArray(campo.opcoes).map((o) => (
                          <button
                            key={o.label}
                            type="button"
                            onClick={() => setValores((v) => ({ ...v, [campo.id]: o.label }))}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg border focus-ring ${valores[campo.id] === o.label ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-700 border-black/10 hover:bg-gray-50"}`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {erro && <div className="mt-4 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>}

              <button onClick={enviar} disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring mt-5">
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null} Enviar respostas
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
