import { useEffect, useRef, useState } from "react";
import { Mic, Square, Wand2, FileText, Check, AlertTriangle } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { atualizarDocumento } from "../lib/firestore";
import { transcreverAudio, sumarizarConsulta } from "../lib/ia";

export default function AITranscriber({ onInsertNote }) {
  const { clinicaId, atendimentoId, firebaseConfigured } = useTenant();
  const [state, setState] = useState("idle"); // idle | recording | transcrevendo | sumarizando | done | erro
  const [erro, setErro] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [resultado, setResultado] = useState(null); // { queixaResumo, sugestoes }

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setErro("");
    setResultado(null);
    if (!firebaseConfigured) {
      setErro("Firebase não configurado — a transcrição real precisa da Cloud Function publicada.");
      setState("erro");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = handleStop;
      mediaRecorderRef.current = recorder;
      recorder.start();

      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      console.error("Erro ao acessar o microfone:", err);
      setErro("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      setState("erro");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function handleStop() {
    setState("transcrevendo");
    try {
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      const texto = await transcreverAudio(audioBlob, "pt");

      setState("sumarizando");
      const resumo = await sumarizarConsulta(texto);
      setResultado(resumo);

      // Persiste as sugestões no atendimento atual, para o painel
      // "Percepções da IA" (aberto pelo cabeçalho do paciente) conseguir lê-las.
      if (clinicaId && atendimentoId) {
        await atualizarDocumento(`clinicas/${clinicaId}/atendimentos`, atendimentoId, {
          transcricaoBruta: texto,
          sugestoesIA: resumo.sugestoes,
          sugestoesGeradasEm: new Date().toISOString(),
        });
      }
      setState("done");
    } catch (err) {
      console.error("Erro no fluxo de transcrição/sumarização:", err);
      setErro(err.message || "Não foi possível processar o áudio. Tente novamente.");
      setState("erro");
    }
  }

  function insertNote() {
    if (resultado?.queixaResumo) onInsertNote?.(resultado.queixaResumo);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-display font-semibold text-ink-900">
          <Wand2 size={16} className="text-brand-500" /> Transcrição por IA
        </div>
        {state === "recording" && (
          <span className="text-xs font-mono text-rose-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> {mm}:{ss}
          </span>
        )}
      </div>

      {state === "idle" && (
        <button
          onClick={startRecording}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring animate-pulseRing"
        >
          <Mic size={16} /> Iniciar gravação da consulta
        </button>
      )}

      {state === "recording" && (
        <>
          <div className="flex items-end justify-center gap-1 h-10">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className="w-1 bg-brand-400 rounded-full animate-wave" style={{ height: "100%", animationDelay: `${(i % 6) * 0.12}s` }} />
            ))}
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring"
          >
            <Square size={14} /> Encerrar e gerar registro
          </button>
        </>
      )}

      {(state === "transcrevendo" || state === "sumarizando") && (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-sm text-ink-500">
          <div className="w-6 h-6 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
          {state === "transcrevendo" ? "Transcrevendo o áudio…" : "Sumarizando o atendimento…"}
        </div>
      )}

      {state === "erro" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
          </div>
          <button onClick={() => setState("idle")} className="w-full text-xs font-semibold text-ink-500 hover:text-ink-900 py-2 rounded-lg focus-ring border border-black/10">
            Tentar de novo
          </button>
        </div>
      )}

      {state === "done" && resultado && (
        <div className="space-y-3 animate-slideIn">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> Transcrição concluída · registro gerado automaticamente
          </div>
          <div className="text-xs bg-brand-50/60 rounded-lg p-3 text-ink-700 leading-relaxed">
            {resultado.queixaResumo || "A IA não encontrou uma queixa clara nessa gravação."}
          </div>
          {resultado.sugestoes?.length > 0 && (
            <p className="text-[11px] text-ink-500">
              {resultado.sugestoes.length} sugestão(ões) clínica(s) geradas — veja em "Percepções da IA", no topo do atendimento.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={insertNote}
              disabled={!resultado.queixaResumo}
              className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg focus-ring"
            >
              <FileText size={14} /> Inserir na Queixa do Paciente
            </button>
            <button onClick={() => setState("idle")} className="text-xs font-semibold text-ink-500 hover:text-ink-900 px-3 rounded-lg focus-ring">
              Nova gravação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
