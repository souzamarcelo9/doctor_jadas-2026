import { useEffect, useState } from "react";
import { X, Camera, Loader2, UserRound, AlertTriangle } from "lucide-react";
import { useFirestoreCollection, atualizarDocumento } from "../lib/firestore";
import { enviarFotoPaciente } from "../lib/storage";
import { ESTADOS_BR, buscarCidadesPorUf, buscarEnderecoPorCep } from "../lib/enderecoBr";
import { maskCPF, maskCEP, maskCelular, cpfValido, emailValido, celularValido, cepValido, limparNome, LIMITES } from "../lib/masks";

// Edição de paciente fora do fluxo de agendamento — antes só dava pra
// editar os dados do paciente na hora de marcar uma consulta
// (AgendamentoModal); esse modal cobre o mesmo conjunto de campos, só que
// acessível direto da lista de Pacientes (o "CRM" pedido).

export default function EditarPacienteModal({ clinicaId, paciente, onClose }) {
  const [form, setForm] = useState({
    nome: paciente.nome || "", nomeMae: paciente.nomeMae || "", cpf: paciente.cpf || "",
    fichaPaciente: paciente.fichaPaciente || "", sexo: paciente.sexo || "Feminino",
    celular: paciente.celular || paciente.telefone || "", nascimento: paciente.nascimento || "", email: paciente.email || "",
    cep: paciente.cep || "", logradouro: paciente.logradouro || "", numero: paciente.numero || "",
    bairro: paciente.bairro || "", estado: paciente.estado || "", cidade: paciente.cidade || "",
    convenioId: paciente.convenioId || "", carteirinha: paciente.carteirinha || "",
    observacoesGerais: paciente.observacoesGerais || "",
  });
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(paciente.fotoUrl || "");
  const [cidades, setCidades] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const { data: convenios } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/convenios` : null, "nome", "asc");

  useEffect(() => {
    let cancelado = false;
    if (!form.estado) { setCidades([]); return; }
    buscarCidadesPorUf(form.estado).then((lista) => { if (!cancelado) setCidades(lista); });
    return () => { cancelado = true; };
  }, [form.estado]);

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

  function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function salvar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Informe o nome do paciente."); return; }
    if (form.cpf && !cpfValido(form.cpf)) { setErro("CPF inválido — confira os dígitos informados."); return; }
    if (!celularValido(form.celular)) { setErro("Celular inválido — informe DDD + número (10 ou 11 dígitos)."); return; }
    if (!emailValido(form.email)) { setErro("E-mail inválido."); return; }
    if (!cepValido(form.cep)) { setErro("CEP inválido — deve ter 8 dígitos."); return; }

    setSalvando(true);
    try {
      const dados = { ...form };
      if (fotoFile) {
        dados.fotoUrl = await enviarFotoPaciente(clinicaId, paciente.id, fotoFile);
      }
      await atualizarDocumento(`clinicas/${clinicaId}/pacientes`, paciente.id, dados);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar paciente:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const iniciais = (form.nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-xl2 shadow-pop overflow-hidden animate-slideIn flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white shrink-0">
          <span className="font-display font-semibold flex items-center gap-2"><UserRound size={18} /> Editar paciente</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

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
              <Field label="Nome" value={form.nome} maxLength={LIMITES.nome} onChange={(v) => setForm({ ...form, nome: limparNome(v) })} />
              <Field label="Nome da Mãe" value={form.nomeMae} maxLength={LIMITES.nomeMae} onChange={(v) => setForm({ ...form, nomeMae: limparNome(v) })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="CPF" value={form.cpf} maxLength={LIMITES.cpf} placeholder="000.000.000-00" onChange={(v) => setForm({ ...form, cpf: maskCPF(v) })} />
            <Field label="Ficha do Paciente" value={form.fichaPaciente} maxLength={LIMITES.fichaPaciente} onChange={(v) => setForm({ ...form, fichaPaciente: v })} />
            <SelectField label="Sexo" value={form.sexo} onChange={(v) => setForm({ ...form, sexo: v })} options={["Feminino", "Masculino", "Outro"]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Celular" value={form.celular} maxLength={LIMITES.celular} placeholder="(00) 00000-0000" onChange={(v) => setForm({ ...form, celular: maskCelular(v) })} />
            <Field label="Data de nascimento" type="date" value={form.nascimento} onChange={(v) => setForm({ ...form, nascimento: v })} />
            <Field label="Email" type="email" value={form.email} maxLength={LIMITES.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="CEP" value={form.cep} maxLength={LIMITES.cep} placeholder="00000-000" onChange={(v) => setForm({ ...form, cep: maskCEP(v) })} />
            <Field label="Logradouro" value={form.logradouro} maxLength={LIMITES.logradouro} onChange={(v) => setForm({ ...form, logradouro: v })} />
            <Field label="Nº" value={form.numero} maxLength={LIMITES.numero} onChange={(v) => setForm({ ...form, numero: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bairro" value={form.bairro} maxLength={LIMITES.bairro} onChange={(v) => setForm({ ...form, bairro: v })} />
            <SelectField label="Estado" value={form.estado} onChange={(v) => setForm({ ...form, estado: v, cidade: "" })} options={ESTADOS_BR.map((e) => e.sigla)} placeholder="UF" />
            <SelectField label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} options={cidades} placeholder={form.estado ? (cidades.length ? "Selecione" : "Nenhuma cidade encontrada") : "Selecione o estado"} disabled={!form.estado} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Convênio" value={form.convenioId} onChange={(v) => setForm({ ...form, convenioId: v })} options={convenios.map((c) => c.id)} labels={Object.fromEntries(convenios.map((c) => [c.id, c.nome]))} placeholder="Particular" />
            <Field label="Carteirinha" value={form.carteirinha} maxLength={LIMITES.carteirinha} onChange={(v) => setForm({ ...form, carteirinha: v })} />
          </div>
          <Field label="Observações gerais do paciente" value={form.observacoesGerais} maxLength={LIMITES.observacoesGerais} onChange={(v) => setForm({ ...form, observacoesGerais: v })} />
        </div>

        <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar alterações
          </button>
        </div>
      </div>
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
