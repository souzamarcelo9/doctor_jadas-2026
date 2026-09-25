import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { Search, Plus, UserRound, Stethoscope, Loader2, X, Pencil } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../lib/firestore";
import { maskCPF, maskCelular, cpfValido, celularValido, limparNome, LIMITES } from "../lib/masks";
import EditarPacienteModal from "../components/EditarPacienteModal";

export default function Pacientes() {
  const { clinicaId, firebaseConfigured, loadingClinicas, clinicasDisponiveis } = useTenant();
  const navigate = useNavigate();
  const { data: pacientes, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, "nome", "asc");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pacienteEditando, setPacienteEditando] = useState(null);

  const filtrados = pacientes.filter((p) =>
    p.nome?.toLowerCase().includes(query.toLowerCase()) || p.cpf?.includes(query)
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Pacientes" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        {!loadingClinicas && clinicasDisponiveis.length === 0 && (
          <div className="card p-6 text-center text-sm text-ink-500">
            Seu usuário ainda não tem vínculo ativo com nenhuma clínica. Peça para um administrador te cadastrar em <code className="font-mono text-xs">clinicas/&#123;id&#125;/membros</code>.
          </div>
        )}

        {clinicaId && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou CPF…"
                  className="w-full text-sm border border-black/10 rounded-lg pl-9 pr-3 py-2 focus-ring"
                />
              </div>
              <button
                onClick={() => setShowForm(true)}
                disabled={!firebaseConfigured}
                className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg focus-ring"
              >
                <Plus size={15} /> Novo paciente
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-ink-500 py-10 justify-center">
                <Loader2 size={18} className="animate-spin" /> Carregando pacientes…
              </div>
            )}

            {!loading && filtrados.length === 0 && (
              <div className="card p-10 text-center text-sm text-ink-500">Nenhum paciente encontrado.</div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtrados.map((p) => (
                <div key={p.id} className="card p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center text-white font-display font-semibold shrink-0">
                    {p.nome?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate">{p.nome}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5">{p.cpf}</div>
                    <div className="text-[11px] text-ink-500">{p.convenioId || "Particular"}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => navigate(`/atendimento/${p.id}`)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <Stethoscope size={13} /> Iniciar atendimento
                      </button>
                      <button
                        onClick={() => setPacienteEditando(p)}
                        disabled={!firebaseConfigured}
                        className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900 disabled:opacity-50"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showForm && <NovoPacienteModal clinicaId={clinicaId} onClose={() => setShowForm(false)} />}
      {pacienteEditando && (
        <EditarPacienteModal
          clinicaId={clinicaId}
          paciente={pacienteEditando}
          onClose={() => setPacienteEditando(null)}
        />
      )}
    </div>
  );
}

function NovoPacienteModal({ clinicaId, onClose }) {
  const { profissionalId } = useTenant();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", nascimento: "", sexo: "Feminino", cpf: "", telefone: "", convenioId: "" });
  const [consentimento, setConsentimento] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setErro("");
    if (!form.nome.trim()) return;
    if (form.cpf && !cpfValido(form.cpf)) { setErro("CPF inválido — confira os dígitos informados."); return; }
    if (!celularValido(form.telefone)) { setErro("Telefone inválido — informe DDD + número (10 ou 11 dígitos)."); return; }
    if (!consentimento) { setErro("É preciso confirmar que o paciente foi informado sobre o tratamento de dados antes de cadastrar."); return; }
    setSalvando(true);
    try {
      const ref = await criarDocumento(`clinicas/${clinicaId}/pacientes`, {
        ...form,
        alergiasResumo: false,
        criadoPor: profissionalId,
        consentimentoLgpd: {
          aceito: true,
          aceitoEm: new Date().toISOString(),
          aceitoPor: profissionalId,
        },
      });
      onClose();
      navigate(`/atendimento/${ref.id}`);
    } catch (err) {
      console.error("Erro ao cadastrar paciente:", err);
      setErro(err.message || "Não foi possível cadastrar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-xl2 shadow-pop overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><UserRound size={18} /> Novo paciente</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Nome completo" value={form.nome} maxLength={LIMITES.nome} onChange={(v) => setForm({ ...form, nome: limparNome(v) })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nascimento" type="date" value={form.nascimento} onChange={(v) => setForm({ ...form, nascimento: v })} />
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Sexo</span>
              <select value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
                <option>Feminino</option><option>Masculino</option><option>Outro</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF" value={form.cpf} maxLength={LIMITES.cpf} placeholder="000.000.000-00" onChange={(v) => setForm({ ...form, cpf: maskCPF(v) })} />
            <Field label="Telefone" value={form.telefone} maxLength={LIMITES.celular} placeholder="(00) 00000-0000" onChange={(v) => setForm({ ...form, telefone: maskCelular(v) })} />
          </div>
          <Field label="Convênio" value={form.convenioId} onChange={(v) => setForm({ ...form, convenioId: v })} placeholder="Particular" />

          <label className="flex items-start gap-2.5 bg-brand-50/60 border border-brand-100 rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 rounded focus-ring" />
            <span className="text-[11px] text-ink-700">
              Confirmo que o paciente foi informado sobre o tratamento de seus dados pessoais e de saúde nesta clínica, conforme a Política de Privacidade, e consente com isso (LGPD, art. 11).
            </span>
          </label>

          {erro && <p className="text-xs text-rose-600">{erro}</p>}
        </div>
        <div className="px-5 py-4 border-t border-black/5 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !form.nome.trim()} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando && <Loader2 size={14} className="animate-spin" />} Cadastrar e atender
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
      <input {...props} onChange={(e) => props.onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}
