import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import {
  Search, X, Loader2, Camera, ChevronDown, ChevronUp, Sparkles,
  UserCheck, XCircle, Stethoscope, MessageCircle, ExternalLink,
} from "lucide-react";
import {
  useFirestoreCollection, useFirestoreQuery, where, orderBy,
  criarDocumento, atualizarDocumento,
} from "../../lib/firestore";
import { enviarFotoPaciente } from "../../lib/storage";
import { ESTADOS_BR, buscarCidadesPorUf, buscarEnderecoPorCep } from "../../lib/enderecoBr";
import { abrirLinkWhatsapp, montarMensagemConfirmacao } from "../../lib/whatsapp";

const TIPOS_CONSULTA = ["CONSULTA", "RETORNO", "PROCEDIMENTO", "EXAME", "TELECONSULTA"];
const TIPOS_ATENDIMENTO = ["Consulta simples", "Consulta + procedimento", "Encaixe", "Teleconsulta"];

const statusAcoes = [
  { valor: "confirmado", label: "Confirmado", icon: UserCheck, tone: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { valor: "presente", label: "Presença", icon: UserCheck, tone: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
  { valor: "faltou", label: "Falta", icon: XCircle, tone: "bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { valor: "cancelado", label: "Cancelamento", icon: XCircle, tone: "bg-gray-100 text-gray-600 hover:bg-gray-200" },
];

function diasEntre(a, b) {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}
function formatarDataBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function pacienteVazio() {
  return {
    nome: "", nomeMae: "", cpf: "", fichaPaciente: "", sexo: "Feminino",
    celular: "", nascimento: "", email: "",
    cep: "", logradouro: "", numero: "", bairro: "", estado: "", cidade: "",
    convenioId: "", carteirinha: "", observacoesGerais: "", fotoUrl: "",
  };
}

export default function AgendamentoModal({ slot, dateISO, clinicaId, profissionalId, pacientes, onClose, onIrParaAtendimento, pacientePreSelecionado, forcarEncaixe, listaEsperaId }) {
  const editandoExistente = Boolean(slot.agendamento);

  const [novoPaciente, setNovoPaciente] = useState(false);
  const [busca, setBusca] = useState("");
  const [pacienteSel, setPacienteSel] = useState(() => {
    if (editandoExistente) return pacientes.find((p) => p.id === slot.agendamento.pacienteId) || null;
    if (pacientePreSelecionado) return pacientes.find((p) => p.id === pacientePreSelecionado.pacienteId) || null;
    return null;
  });
  const [form, setForm] = useState(() => (pacienteSel ? { ...pacienteVazio(), ...pacienteSel } : { ...pacienteVazio(), nome: pacientePreSelecionado?.pacienteNome || "", celular: pacientePreSelecionado?.celular || "" }));
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(pacienteSel?.fotoUrl || "");
  const [showComplementares, setShowComplementares] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [cidades, setCidades] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [agendaForm, setAgendaForm] = useState(() => ({
    data: dateISO,
    hora: slot.hora,
    tipoConsulta: slot.agendamento?.tipoAtendimento || "CONSULTA",
    especialidade: slot.agendamento?.especialidade || "",
    tipoAtendimento: slot.agendamento?.tipoAtendimentoDetalhe || (forcarEncaixe ? "Encaixe" : "Consulta simples"),
    convenioId: slot.agendamento?.convenioId || pacientePreSelecionado?.convenioId || "",
    carteirinha: slot.agendamento?.carteirinha || "",
    servicoId: slot.agendamento?.servicoId || "",
    servicoNome: slot.agendamento?.servicoNome || "",
    valor: slot.agendamento?.valor ?? "",
    observacao: slot.agendamento?.observacao || "",
  }));

  const { data: convenios } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/convenios` : null, "nome", "asc");
  const { data: servicos } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/servicos` : null, "nome", "asc");

  // Histórico de agendamentos do paciente selecionado — alimenta os
  // indicadores (1ª consulta, dias desde a última, faltas, cancelamentos).
  const { data: historicoBruto } = useFirestoreQuery(
    clinicaId && pacienteSel ? `clinicas/${clinicaId}/agendamentos` : null,
    [where("pacienteId", "==", pacienteSel?.id || "__none__"), orderBy("dataHora", "desc")],
    [clinicaId, pacienteSel?.id]
  );
  const historico = useMemo(
    () => historicoBruto.filter((a) => a.id !== slot.agendamento?.id),
    [historicoBruto, slot.agendamento?.id]
  );

  const indicadores = useMemo(() => {
    const agora = new Date();
    const ultimaValida = historico.find((a) => a.status !== "cancelado" && a.dataHora?.toDate?.() < agora);
    return {
      primeiraConsulta: historico.length === 0,
      ultimaConsulta: ultimaValida?.dataHora?.toDate?.() || null,
      cancelamentos: historico.filter((a) => a.status === "cancelado").length,
      faltas: historico.filter((a) => a.status === "faltou").length,
    };
  }, [historico]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const soDigitos = busca.replace(/\D/g, "");
    if (q.length < 5 && soDigitos.length < 11) return [];
    return pacientes.filter((p) => p.nome?.toLowerCase().includes(q) || (soDigitos.length === 11 && p.cpf?.replace(/\D/g, "") === soDigitos));
  }, [busca, pacientes]);

  // Autocompleta cidades quando o estado muda.
  useEffect(() => {
    let cancelado = false;
    if (!form.estado) { setCidades([]); return; }
    buscarCidadesPorUf(form.estado).then((lista) => { if (!cancelado) setCidades(lista); });
    return () => { cancelado = true; };
  }, [form.estado]);

  // Autopreenche o endereço quando um CEP completo (8 dígitos) é digitado.
  useEffect(() => {
    let cancelado = false;
    const digitos = form.cep.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    buscarEnderecoPorCep(digitos).then((end) => {
      if (cancelado || !end) return;
      setForm((f) => ({ ...f, logradouro: end.logradouro || f.logradouro, bairro: end.bairro || f.bairro, cidade: end.cidade || f.cidade, estado: end.estado || f.estado }));
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cep]);

  function selecionarPaciente(p) {
    setPacienteSel(p);
    setForm({ ...pacienteVazio(), ...p });
    setFotoPreview(p.fotoUrl || "");
    setBusca(p.nome);
  }

  function limparSelecao() {
    setPacienteSel(null);
    setForm(pacienteVazio());
    setFotoPreview("");
    setBusca("");
  }

  function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function selecionarServico(servicoId) {
    const s = servicos.find((sv) => sv.id === servicoId);
    setAgendaForm((f) => ({ ...f, servicoId, servicoNome: s?.nome || "", valor: s ? s.valor : f.valor }));
  }

  async function salvar() {
    setErro("");
    if (!novoPaciente && !pacienteSel) { setErro("Selecione um paciente existente ou marque \"Novo Paciente\"."); return; }
    if (!form.nome.trim()) { setErro("Informe o nome do paciente."); return; }
    if (!agendaForm.data || !agendaForm.hora) { setErro("Informe data e hora do agendamento."); return; }

    setSalvando(true);
    try {
      const dadosPaciente = { ...form };
      delete dadosPaciente.id;

      let pacienteId = pacienteSel?.id;
      if (!pacienteId) {
        const ref = await criarDocumento(`clinicas/${clinicaId}/pacientes`, {
          ...dadosPaciente, alergiasResumo: false, criadoPor: profissionalId,
        });
        pacienteId = ref.id;
      }

      if (fotoFile) {
        const url = await enviarFotoPaciente(clinicaId, pacienteId, fotoFile);
        dadosPaciente.fotoUrl = url;
      }
      await atualizarDocumento(`clinicas/${clinicaId}/pacientes`, pacienteId, dadosPaciente);

      const [h, m] = agendaForm.hora.split(":").map(Number);
      const d = new Date(`${agendaForm.data}T00:00:00`);
      d.setHours(h, m, 0, 0);

      const convenioNome = convenios.find((c) => c.id === agendaForm.convenioId)?.nome || "Particular";
      const valorNumerico = Number(agendaForm.valor) || 0;

      const dadosAgendamento = {
        profissionalId,
        pacienteId,
        pacienteNome: dadosPaciente.nome,
        pacienteTelefone: dadosPaciente.celular || null,
        dataHora: Timestamp.fromDate(d),
        duracaoMinutos: 30,
        status: slot.agendamento?.status || "agendado",
        tipoAtendimento: agendaForm.tipoConsulta,
        tipoAtendimentoDetalhe: agendaForm.tipoAtendimento,
        especialidade: agendaForm.especialidade || null,
        convenioId: agendaForm.convenioId || null,
        convenioNome,
        carteirinha: agendaForm.carteirinha || null,
        servicoId: agendaForm.servicoId || null,
        servicoNome: agendaForm.servicoNome || null,
        valor: valorNumerico,
        observacao: agendaForm.observacao || null,
        encaixe: Boolean(forcarEncaixe) || slot.agendamento?.encaixe || false,
      };

      let agendamentoId = slot.agendamento?.id;
      if (agendamentoId) {
        await atualizarDocumento(`clinicas/${clinicaId}/agendamentos`, agendamentoId, dadosAgendamento);
      } else {
        const ref = await criarDocumento(`clinicas/${clinicaId}/agendamentos`, dadosAgendamento);
        agendamentoId = ref.id;
      }

      // Lançamento automático no financeiro — nada de cadastro manual: se
      // há valor vinculado ao serviço, a conta a receber nasce (ou é
      // atualizada) junto com o agendamento.
      if (valorNumerico > 0) {
        const contaPath = `clinicas/${clinicaId}/contasReceber`;
        const descricao = `${agendaForm.servicoNome || agendaForm.tipoConsulta} — ${dadosPaciente.nome}`;
        if (slot.agendamento?.contaReceberId) {
          await atualizarDocumento(contaPath, slot.agendamento.contaReceberId, {
            descricao, valor: valorNumerico, vencimento: agendaForm.data, convenioId: agendaForm.convenioId || null,
          });
        } else {
          const contaRef = await criarDocumento(contaPath, {
            descricao, valor: valorNumerico, vencimento: agendaForm.data, status: "pendente",
            pacienteId, pacienteNome: dadosPaciente.nome, convenioId: agendaForm.convenioId || null,
            agendamentoId, origem: "agendamento",
          });
          await atualizarDocumento(`clinicas/${clinicaId}/agendamentos`, agendamentoId, { contaReceberId: contaRef.id });
        }
      }

      if (listaEsperaId) {
        await atualizarDocumento(`clinicas/${clinicaId}/listaEspera`, listaEsperaId, { status: "atendido" });
      }

      onClose();
    } catch (err) {
      console.error("Erro ao salvar agendamento:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(novoStatus) {
    await atualizarDocumento(`clinicas/${clinicaId}/agendamentos`, slot.agendamento.id, { status: novoStatus });
    onClose();
  }

  function enviarConfirmacaoWhatsapp() {
    const telefone = form.celular || pacienteSel?.telefone;
    const ok = abrirLinkWhatsapp(telefone, montarMensagemConfirmacao({ dataHora: Timestamp.fromDate(new Date(`${agendaForm.data}T${agendaForm.hora}:00`)), pacienteNome: form.nome }));
    if (!ok) setErro("Paciente não tem celular cadastrado — preencha o campo Celular antes de enviar.");
  }

  const iniciais = (form.nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2">
            Agendamento de paciente · {agendaForm.hora} · {formatarDataBR(dateISO)}
            {(forcarEncaixe || slot.agendamento?.encaixe) && (
              <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">Encaixe</span>
            )}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {erro && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3">{erro}</div>}

          {editandoExistente && (
            <div className="card p-3 space-y-2 bg-brand-50/40 border-brand-100">
              <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide">Status do agendamento</div>
              <div className="flex flex-wrap gap-2">
                {statusAcoes.map(({ valor, label, icon: Icon, tone }) => (
                  <button key={valor} onClick={() => mudarStatus(valor)} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg focus-ring ${tone}`}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
                <button onClick={enviarConfirmacaoWhatsapp} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-ring">
                  <MessageCircle size={13} /> Link de confirmação <ExternalLink size={10} />
                </button>
                <button onClick={() => onIrParaAtendimento(slot.agendamento.pacienteId)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 focus-ring ml-auto">
                  <Stethoscope size={13} /> Ir para o atendimento
                </button>
              </div>
            </div>
          )}

          {/* Busca / novo paciente */}
          {!editandoExistente && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  value={busca}
                  disabled={novoPaciente}
                  onChange={(e) => { setBusca(e.target.value); if (pacienteSel) limparSelecao(); }}
                  placeholder="Busca por nome, mínimo de 5 caracteres, ou CPF completo"
                  className="w-full text-sm border border-black/10 rounded-lg pl-8 pr-3 py-2 focus-ring disabled:bg-gray-50 disabled:text-ink-500"
                />
                {filtrados.length > 0 && !pacienteSel && (
                  <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-black/10 rounded-lg shadow-pop divide-y divide-black/5">
                    {filtrados.map((p) => (
                      <button key={p.id} onClick={() => selecionarPaciente(p)} className="w-full text-left text-xs px-3 py-2 hover:bg-brand-50 focus-ring">
                        {p.nome} {p.cpf ? <span className="text-ink-500">· {p.cpf}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-700 shrink-0">
                <input type="checkbox" checked={novoPaciente} onChange={(e) => { setNovoPaciente(e.target.checked); limparSelecao(); }} className="rounded focus-ring" />
                Novo Paciente
              </label>
            </div>
          )}

          {/* Foto + dados principais */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center text-white font-display font-semibold text-lg overflow-hidden">
                {fotoPreview ? <img src={fotoPreview} alt="" className="w-full h-full object-cover" /> : iniciais}
              </div>
              <label className="flex items-center gap-1 text-[10px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
                <Camera size={11} /> Selecionar foto
                <input type="file" accept="image/*" onChange={handleFoto} className="hidden" />
              </label>
            </div>
            <div className="flex-1 space-y-2.5">
              <Field label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
              <Field label="Nome da Mãe" value={form.nomeMae} onChange={(v) => setForm({ ...form, nomeMae: v })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
            <Field label="Ficha do Paciente" value={form.fichaPaciente} onChange={(v) => setForm({ ...form, fichaPaciente: v })} />
            <SelectField label="Sexo" value={form.sexo} onChange={(v) => setForm({ ...form, sexo: v })} options={["Feminino", "Masculino", "Outro"]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Celular" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} placeholder="(00) 00000-0000" />
            <Field label="Data de nascimento" type="date" value={form.nascimento} onChange={(v) => setForm({ ...form, nascimento: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="CEP" value={form.cep} onChange={(v) => setForm({ ...form, cep: v })} placeholder="00000-000" />
            <Field label="Logradouro" value={form.logradouro} onChange={(v) => setForm({ ...form, logradouro: v })} />
            <Field label="Nº" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bairro" value={form.bairro} onChange={(v) => setForm({ ...form, bairro: v })} />
            <SelectField label="Estado" value={form.estado} onChange={(v) => setForm({ ...form, estado: v, cidade: "" })} options={ESTADOS_BR.map((e) => e.sigla)} placeholder="UF" />
            <SelectField label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} options={cidades} placeholder={form.estado ? (cidades.length ? "Selecione" : "Nenhuma cidade encontrada") : "Selecione o estado"} disabled={!form.estado} />
          </div>

          <p className="text-[11px] text-ink-500">**Campos importantes para identificação inequívoca do paciente</p>

          <Collapsible label="Informações complementares" open={showComplementares} onToggle={() => setShowComplementares((o) => !o)}>
            <Field label="Observações gerais do paciente" value={form.observacoesGerais} onChange={(v) => setForm({ ...form, observacoesGerais: v })} />
          </Collapsible>

          {/* Indicadores do paciente */}
          {pacienteSel && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 uppercase tracking-wide">
                Indicadores do paciente
                {indicadores.primeiraConsulta && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full normal-case">
                    <Sparkles size={10} /> 1ª consulta
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <IndicadorBox label="Última consulta" value={indicadores.ultimaConsulta ? indicadores.ultimaConsulta.toLocaleDateString("pt-BR") : "—"} tone="bg-sky-500" />
                <IndicadorBox label="Dias últ. consulta" value={indicadores.ultimaConsulta ? diasEntre(indicadores.ultimaConsulta, new Date()) : "—"} tone="bg-emerald-500" />
                <IndicadorBox label="Cancelamentos" value={indicadores.cancelamentos} tone="bg-amber-500" />
                <IndicadorBox label="Faltas" value={indicadores.faltas} tone="bg-rose-500" />
              </div>
            </div>
          )}

          {pacienteSel && historico.length > 0 && (
            <Collapsible label="Histórico de atendimentos" open={showHistorico} onToggle={() => setShowHistorico((o) => !o)}>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {historico.slice(0, 15).map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="text-ink-700">{h.dataHora?.toDate ? h.dataHora.toDate().toLocaleDateString("pt-BR") : "—"} · {h.tipoAtendimento}</span>
                    <span className="text-[10px] font-semibold text-ink-500 capitalize">{h.status}</span>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {/* Dados do agendamento */}
          <div className="pt-1 border-t border-black/5" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Agendamento" type="date" value={agendaForm.data} onChange={(v) => setAgendaForm({ ...agendaForm, data: v })} />
            <Field label="Hora" type="time" value={agendaForm.hora} onChange={(v) => setAgendaForm({ ...agendaForm, hora: v })} />
            <SelectField label="Tipo consulta" value={agendaForm.tipoConsulta} onChange={(v) => setAgendaForm({ ...agendaForm, tipoConsulta: v })} options={TIPOS_CONSULTA} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Especialidade" value={agendaForm.especialidade} onChange={(v) => setAgendaForm({ ...agendaForm, especialidade: v })} />
            <SelectField label="Tipo atendimento" value={agendaForm.tipoAtendimento} onChange={(v) => setAgendaForm({ ...agendaForm, tipoAtendimento: v })} options={TIPOS_ATENDIMENTO} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Convênio" value={agendaForm.convenioId} onChange={(v) => setAgendaForm({ ...agendaForm, convenioId: v })} options={convenios.map((c) => c.id)} labels={Object.fromEntries(convenios.map((c) => [c.id, c.nome]))} placeholder="Particular" />
            <Field label="Carteirinha" value={agendaForm.carteirinha} onChange={(v) => setAgendaForm({ ...agendaForm, carteirinha: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Consulta / Serviço" value={agendaForm.servicoId} onChange={selecionarServico} options={servicos.map((s) => s.id)} labels={Object.fromEntries(servicos.map((s) => [s.id, s.nome]))} placeholder="Selecione um serviço" />
            <Field label="Valor (R$)" type="number" value={agendaForm.valor} onChange={(v) => setAgendaForm({ ...agendaForm, valor: v })} />
          </div>
          {servicos.length === 0 && (
            <p className="text-[11px] text-ink-500 -mt-2">Nenhum serviço cadastrado ainda — cadastre em Configurações para preencher o valor automaticamente, ou informe o valor manualmente acima.</p>
          )}
          <Field label="Observações" value={agendaForm.observacao} onChange={(v) => setAgendaForm({ ...agendaForm, observacao: v })} />
        </div>

        <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando && <Loader2 size={14} className="animate-spin" />} {editandoExistente ? "Salvar alterações" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IndicadorBox({ label, value, tone }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-ink-500 text-center">{label}</span>
      <span className={`w-full text-center text-white text-xs font-semibold rounded-lg py-1.5 ${tone}`}>{value}</span>
    </div>
  );
}

function Collapsible({ label, open, onToggle, children }) {
  return (
    <div>
      <button onClick={onToggle} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 focus-ring">
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {label}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <input {...props} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}

function SelectField({ label, value, onChange, options, labels, placeholder, disabled }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring disabled:bg-gray-50 disabled:text-ink-500">
        <option value="">{placeholder || "Selecione"}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{labels ? labels[opt] : opt}</option>
        ))}
      </select>
    </label>
  );
}
