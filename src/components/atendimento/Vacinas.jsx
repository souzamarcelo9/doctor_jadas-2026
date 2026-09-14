import { useMemo, useState } from "react";
import { Syringe, ChevronDown, ChevronUp, Plus, Loader2, AlertTriangle, Info } from "lucide-react";
import { useTenant } from "../../context/TenantContext";
import { useFirestoreCollection, useFirestoreDoc, criarDocumento, alternarAtivo } from "../../lib/firestore";
import { paraArray } from "../../lib/arrays";
import { CALENDARIO_VACINACAO } from "../../data/calendarioVacinacao";

function calcularIdadeAnos(nascimentoStr) {
  if (!nascimentoStr) return null;
  const nasc = new Date(nascimentoStr);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const aindaNaoFezAniversario = hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

function grupoSugerido(idade) {
  if (idade === null) return null;
  if (idade < 10) return "crianca";
  if (idade < 25) return "adolescenteJovem";
  if (idade < 60) return "adulto";
  return "idoso";
}

function formularioVazio() {
  return { vacina: "", dose: "", data: new Date().toISOString().slice(0, 10), lote: "", observacao: "" };
}

export default function Vacinas() {
  const { clinicaId, pacienteId, pacientePath, atendimentoId, profissionalId, firebaseConfigured } = useTenant();
  const { data: paciente } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/pacientes` : null, pacienteId);
  const { data: registros, loading } = useFirestoreCollection(`${pacientePath}/vacinas`, "data", "desc");

  const idade = calcularIdadeAnos(paciente?.nascimento);
  const grupoAtivo = grupoSugerido(idade);

  const [grupoAberto, setGrupoAberto] = useState(grupoAtivo || "crianca");
  const [form, setForm] = useState(formularioVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const registrosAtivos = useMemo(() => paraArray(registros).filter((r) => r.ativo !== false), [registros]);

  function aplicarDoCalendario(nomeVacina) {
    setForm((f) => ({ ...f, vacina: nomeVacina }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (!form.vacina.trim()) { setErro("Informe a vacina aplicada."); return; }
    setSalvando(true);
    try {
      await criarDocumento(`${pacientePath}/vacinas`, {
        ...form,
        atendimentoId,
        profissionalId,
        ativo: true,
      });
      setForm(formularioVazio());
    } catch (err) {
      console.error("Erro ao registrar vacina:", err);
      setErro(err.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Coluna esquerda: registro de vacinas aplicadas */}
      <div className="space-y-3">
        <form onSubmit={salvar} className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Syringe size={16} className="text-brand-600" />
            <span className="text-sm font-display font-semibold text-ink-900">Registrar vacina aplicada</span>
          </div>

          <label className="block text-xs">
            <span className="text-ink-500 font-medium">Vacina</span>
            <input value={form.vacina} onChange={(e) => setForm({ ...form, vacina: e.target.value })} placeholder="Ex: dT, Influenza, Covid-19…" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Dose</span>
              <input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Ex: 1ª dose, reforço…" className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
            <label className="block text-xs">
              <span className="text-ink-500 font-medium">Data de aplicação</span>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
            </label>
          </div>

          <label className="block text-xs">
            <span className="text-ink-500 font-medium">Lote (opcional)</span>
            <input value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
          </label>

          {erro && <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg p-3"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {erro}</div>}

          <button type="submit" disabled={salvando || !firebaseConfigured} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg focus-ring">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Registrar
          </button>
        </form>

        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-black/5 text-xs font-semibold text-ink-700">Histórico do paciente</div>
          {loading && <div className="p-4 text-xs text-ink-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
          {!loading && registrosAtivos.length === 0 && <p className="p-4 text-xs text-ink-500">Nenhuma vacina registrada ainda.</p>}
          <div className="divide-y divide-black/5">
            {registrosAtivos.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink-900 truncate">{r.vacina} {r.dose && <span className="text-ink-500 font-normal">— {r.dose}</span>}</div>
                  <div className="text-[11px] text-ink-500">{r.data ? r.data.split("-").reverse().join("/") : "—"}{r.lote ? ` · lote ${r.lote}` : ""}</div>
                </div>
                <button onClick={() => alternarAtivo(`${pacientePath}/vacinas`, r.id, false)} className="text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md focus-ring shrink-0">
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coluna direita: calendário nacional de vacinação, como referência */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Info size={16} className="text-brand-500" />
          <span className="text-sm font-display font-semibold text-ink-900">Calendário Nacional de Vacinação</span>
        </div>
        <p className="text-[11px] text-ink-500 mb-3">
          Referência do Ministério da Saúde/PNI{idade !== null && <> — paciente tem {idade} anos{grupoAtivo && <>, categoria sugerida destacada abaixo</>}</>}. Isso é só consulta; o registro ao lado é livre.
        </p>

        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {CALENDARIO_VACINACAO.map((g) => {
            const aberto = grupoAberto === g.grupo;
            const sugerido = g.grupo === grupoAtivo;
            return (
              <div key={g.grupo} className={`border rounded-lg overflow-hidden ${sugerido ? "border-brand-300" : "border-black/10"}`}>
                <button
                  onClick={() => setGrupoAberto(aberto ? null : g.grupo)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left ${sugerido ? "bg-brand-50" : "bg-gray-50"}`}
                >
                  <span className="text-xs font-semibold text-ink-900">
                    {g.titulo} <span className="font-normal text-ink-500">({g.faixaEtaria})</span>
                    {sugerido && <span className="ml-1.5 text-[10px] font-semibold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded-full">sugerido</span>}
                  </span>
                  {aberto ? <ChevronUp size={14} className="text-ink-500 shrink-0" /> : <ChevronDown size={14} className="text-ink-500 shrink-0" />}
                </button>
                {aberto && (
                  <div className="divide-y divide-black/5">
                    {g.itens.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => aplicarDoCalendario(item.vacina)}
                        title="Clique pra preencher o registro ao lado"
                        className="w-full text-left px-3 py-2 hover:bg-brand-50/50 focus-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-ink-900">{item.vacina}</span>
                          <span className="text-[10px] text-ink-500 shrink-0">{item.momento}</span>
                        </div>
                        <div className="text-[11px] text-ink-500 mt-0.5">{item.doses}</div>
                        {item.obs && <div className="text-[10px] text-ink-400 mt-0.5">{item.obs}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
