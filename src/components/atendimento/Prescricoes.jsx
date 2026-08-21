import { useEffect, useRef, useState } from "react";
import { Pill, ExternalLink, Send, CheckCircle2, Loader2, AlertTriangle, X } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, useFirestoreDoc, criarDocumento, atualizarDocumento } from "../../lib/firestore";
import { memedObterToken } from "../../lib/memed";

// Ambiente de testes/sandbox da Memed por padrão. Em produção, defina
// VITE_MEMED_SCRIPT_URL=https://partners.memed.com.br/integration.js no .env
// (confirmado na doc oficial "Configurações" — homologação e produção usam
// URLs diferentes).
const MEMED_SCRIPT_URL = import.meta.env.VITE_MEMED_SCRIPT_URL || "https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js";

const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export default function Prescricoes() {
  const { clinicaId, pacientePath, pacienteId, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: rows, loading } = useFirestoreCollection(`${pacientePath}/prescricoes`);
  const { data: paciente } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, pacienteId);

  const [status, setStatus] = useState("idle"); // idle | carregando | completar_cadastro | abrindo_modulo | modulo_aberto | erro
  const [erro, setErro] = useState("");
  const [camposFaltando, setCamposFaltando] = useState([]);
  const [form, setForm] = useState({ sobrenome: "", cpf: "", dataNascimento: "", boardNumber: "", boardState: "SP" });
  const [salvandoForm, setSalvandoForm] = useState(false);

  const scriptRef = useRef(null);
  const moduloProntoPromiseRef = useRef(null); // resolve quando core:moduleInit disparar
  const eventosConectadosRef = useRef(false); // evita registrar o listener de prescricaoImpressa mais de uma vez

  useEffect(() => {
    return () => {
      // Some com o script da Memed ao sair da tela, pra não ficar duplicado
      // se o usuário voltar e clicar em "Nova receita" de novo.
      scriptRef.current?.remove();
    };
  }, []);

  async function iniciarReceita() {
    setErro("");
    setStatus("carregando");
    try {
      const token = await memedObterToken(clinicaId);
      await abrirReceita(token);
    } catch (err) {
      if (err.code === "functions/failed-precondition") {
        setCamposFaltando(err.details?.camposFaltando || []);
        setStatus("completar_cadastro");
      } else {
        console.error("Erro ao obter token da Memed:", err);
        setErro(err.message || "Não foi possível iniciar a receita digital.");
        setStatus("erro");
      }
    }
  }

  async function salvarCadastroEContinuar() {
    setSalvandoForm(true);
    setErro("");
    try {
      await atualizarDocumento(`clinicas/${clinicaId}/membros`, profissionalId, {
        sobrenome: form.sobrenome,
        cpf: form.cpf.replace(/\D/g, ""),
        dataNascimento: form.dataNascimento,
        boardCode: "CRM",
        boardNumber: form.boardNumber.replace(/\D/g, ""),
        boardState: form.boardState,
      });
      const token = await memedObterToken(clinicaId, true);
      await abrirReceita(token);
    } catch (err) {
      console.error("Erro ao completar cadastro / obter token:", err);
      setErro(err.message || "Não foi possível concluir. Confira os dados e tente de novo.");
      setStatus("completar_cadastro");
    } finally {
      setSalvandoForm(false);
    }
  }

  /** Garante o script carregado + o módulo inicializado, depois manda os
   * dados do paciente e só então mostra o módulo — nessa ordem, como a doc
   * "Configurar Paciente (setPaciente)" recomenda (setPaciente antes de
   * abrir; module.show() no clique do botão, não dentro do core:moduleInit). */
  async function abrirReceita(token) {
    setStatus("abrindo_modulo");
    try {
      await garantirScriptEModuloProntos(token);

      await window.MdHub.command.send("plataforma.prescricao", "setPaciente", {
        idExterno: pacienteId,
        nome: paciente?.nome,
        sexo: paciente?.sexo || "Não informado",
        cpf: paciente?.cpf ? String(paciente.cpf).replace(/\D/g, "") : undefined,
        telefone: paciente?.telefone ? String(paciente.telefone).replace(/\D/g, "") : undefined,
        data_nascimento: paciente?.nascimento || undefined,
      });

      if (!eventosConectadosRef.current) {
        window.MdHub.event.add("prescricaoImpressa", (prescriptionData) => {
          salvarPrescricaoNoFirestore(prescriptionData);
        });
        eventosConectadosRef.current = true;
      }

      await window.MdHub.module.show("plataforma.prescricao");
      setStatus("modulo_aberto");
    } catch (err) {
      console.error("Erro ao abrir o módulo da Memed:", err);
      setErro("Não foi possível abrir o módulo de prescrição. Tente novamente.");
      setStatus("erro");
    }
  }

  /** Injeta o script (uma vez só) e devolve uma Promise que resolve quando
   * o módulo "plataforma.prescricao" terminar de inicializar. Chamadas
   * seguintes reaproveitam a mesma Promise (já resolvida, se for o caso). */
  function garantirScriptEModuloProntos(token) {
    if (moduloProntoPromiseRef.current) return moduloProntoPromiseRef.current;

    moduloProntoPromiseRef.current = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = MEMED_SCRIPT_URL;
      script.setAttribute("token", token);
      script.onerror = () => reject(new Error("Não foi possível carregar o script da Memed."));
      document.body.appendChild(script);
      scriptRef.current = script;

      // MdSinapsePrescricao só fica disponível depois do script carregar.
      const aguardarBiblioteca = setInterval(() => {
        if (window.MdSinapsePrescricao && window.MdHub) {
          clearInterval(aguardarBiblioteca);
          window.MdSinapsePrescricao.event.add("core:moduleInit", (moduleData) => {
            if (moduleData.name === "plataforma.prescricao") resolve();
          });
          window.MdSinapsePrescricao.event.add("core:moduleHide", (moduleData) => {
            if (moduleData.moduleName === "plataforma.prescricao") setStatus("idle");
          });
        }
      }, 200);
      setTimeout(() => {
        clearInterval(aguardarBiblioteca);
        reject(new Error("A Memed demorou demais para responder."));
      }, 15000);
    });

    return moduloProntoPromiseRef.current;
  }

  async function salvarPrescricaoNoFirestore(prescriptionData) {
    const prescricao = prescriptionData?.prescricao;
    const itens = prescricao?.medicamentos || [];
    try {
      await Promise.all(
        itens.map((item) =>
          criarDocumento(`${pacientePath}/prescricoes`, {
            medicamento: item.nome,
            posologia: item.sanitized_posology || item.posologia || "",
            status: "Emitida via Memed",
            origemMemed: true,
            memedPrescriptionUuid: prescricao.prescriptionUuid || null,
            atendimentoId,
            profissionalId,
            ativo: true,
          })
        )
      );
    } catch (err) {
      console.error("Erro ao salvar prescrição vinda da Memed:", err);
    }
  }

  function fecharModulo() {
    window.MdHub?.command?.send("plataforma.prescricao", "hide", {});
    setStatus("idle");
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Pill size={20} /></div>
        <div className="flex-1">
          <div className="font-display font-semibold text-sm">Receita Digital — integração Memed</div>
          <div className="text-xs text-white/80 mt-0.5">Prescreva com segurança digital e mantenha o histórico sincronizado com o prontuário.</div>
        </div>
        <button
          onClick={iniciarReceita}
          disabled={status === "carregando" || status === "abrindo_modulo" || !firebaseConfigured}
          className="shrink-0 flex items-center gap-2 bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-70 text-xs font-semibold px-4 py-2.5 rounded-lg focus-ring"
        >
          {(status === "carregando" || status === "abrindo_modulo") ? (<><Loader2 size={14} className="animate-spin" /> Abrindo Memed…</>) : (<><ExternalLink size={14} /> Nova receita</>)}
        </button>
      </div>

      {status === "modulo_aberto" && (
        <div className="card p-3 flex items-center justify-between bg-emerald-50 border-emerald-100">
          <span className="text-xs text-emerald-700 font-medium">Módulo da Memed aberto — a receita finalizada será salva aqui automaticamente.</span>
          <button onClick={fecharModulo} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            <X size={13} /> Fechar
          </button>
        </div>
      )}

      {erro && (
        <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      {status === "completar_cadastro" && (
        <div className="card p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            A Memed exige alguns dados do seu cadastro profissional antes da primeira prescrição. Preencha abaixo — só precisa fazer isso uma vez.
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Sobrenome" value={form.sobrenome} onChange={(v) => setForm({ ...form, sobrenome: v })} />
            <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} placeholder="Somente números" />
            <Field label="Data de nascimento" value={form.dataNascimento} onChange={(v) => setForm({ ...form, dataNascimento: v })} placeholder="dd/mm/aaaa" />
            <Field label="Número do CRM" value={form.boardNumber} onChange={(v) => setForm({ ...form, boardNumber: v })} />
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">UF do CRM</span>
              <select value={form.boardState} onChange={(e) => setForm({ ...form, boardState: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                {ESTADOS_BR.map((uf) => <option key={uf}>{uf}</option>)}
              </select>
            </label>
          </div>
          <button
            onClick={salvarCadastroEContinuar}
            disabled={salvandoForm || !form.sobrenome || !form.cpf || !form.dataNascimento || !form.boardNumber}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring"
          >
            {salvandoForm && <Loader2 size={15} className="animate-spin" />} Salvar e continuar para a Memed
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-500 border-b border-black/5">
              <Th>Data</Th><Th>Medicamento</Th><Th>Posologia</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-6 text-ink-500"><Loader2 size={16} className="animate-spin inline" /> Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-ink-500">Nenhuma prescrição ainda.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0">
                <Td className="whitespace-nowrap">{formatarData(r.criadoEm)}</Td>
                <Td className="font-medium text-ink-900">{r.medicamento}</Td>
                <Td>{r.posologia}</Td>
                <Td><span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> {r.status}</span></Td>
                <Td><button title="Reenviar" className="p-1.5 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 focus-ring"><Send size={13} /></button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
function formatarData(ts) { return ts?.toDate ? ts.toDate().toLocaleDateString("pt-BR") : "—"; }
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px]">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 text-ink-700 ${className}`}>{children}</td>; }
