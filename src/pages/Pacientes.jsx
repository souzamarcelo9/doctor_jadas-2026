import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { Search, Plus, UserRound, Stethoscope, Loader2, X } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreCollection, criarDocumento } from "../lib/firestore";

export default function Pacientes() {
  const { clinicaId, firebaseConfigured, loadingClinicas, clinicasDisponiveis } = useTenant();
  const navigate = useNavigate();
  const { data: pacientes, loading } = useFirestoreCollection(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, "nome", "asc");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

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
                    <button
                      onClick={() => navigate(`/atendimento/${p.id}`)}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      <Stethoscope size={13} /> Iniciar atendimento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showForm && <NovoPacienteModal clinicaId={clinicaId} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function NovoPacienteModal({ clinicaId, onClose }) {
  const { profissionalId } = useTenant();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", nascimento: "", sexo: "Feminino", cpf: "", telefone: "", convenioId: "" });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const ref = await criarDocumento(`clinicas/${clinicaId}/pacientes`, {
        ...form, alergiasResumo: false, criadoPor: profissionalId,
      });
      onClose();
      navigate(`/atendimento/${ref.id}`);
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
          <Field label="Nome completo" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
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
            <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
            <Field label="Telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
          </div>
          <Field label="Convênio" value={form.convenioId} onChange={(v) => setForm({ ...form, convenioId: v })} placeholder="Particular" />
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
