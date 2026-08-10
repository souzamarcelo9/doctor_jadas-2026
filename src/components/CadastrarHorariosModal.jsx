import { useEffect, useState } from "react";
import { X, Clock, Plus, Info, Loader2 } from "lucide-react";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc, atualizarDocumento } from "../lib/firestore";

const diasSemana = [
  { chave: "domingo", label: "Domingo" }, { chave: "segunda", label: "Segunda-feira" },
  { chave: "terca", label: "Terça-feira" }, { chave: "quarta", label: "Quarta-feira" },
  { chave: "quinta", label: "Quinta-feira" }, { chave: "sexta", label: "Sexta-feira" },
  { chave: "sabado", label: "Sábado" },
];

export default function CadastrarHorariosModal({ open, onClose }) {
  const { clinicaId, profissionalId } = useTenant();
  const { data: membro, loading } = useFirestoreDoc(open ? `clinicas/${clinicaId}/membros` : null, profissionalId);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ primeira: "", ultima: "", inicioIntervalo: "", fimIntervalo: "", tempo: "00:30", dias: {} });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (membro?.horariosTrabalho) setRows(membro.horariosTrabalho);
  }, [membro]);

  if (!open) return null;

  function toggleDia(chave) {
    setForm((f) => ({ ...f, dias: { ...f.dias, [chave]: !f.dias[chave] } }));
  }
  function toggleAtivo(dia) {
    setRows((r) => r.map((row) => (row.dia === dia ? { ...row, ativo: !row.ativo } : row)));
  }
  function remover(dia) {
    setRows((r) => r.filter((row) => row.dia !== dia));
  }
  function adicionar() {
    if (!form.primeira || !form.ultima) return;
    const selecionados = diasSemana.filter((d) => form.dias[d.chave]);
    if (selecionados.length === 0) return;
    const novas = selecionados.map((d) => ({
      dia: d.chave, primeiraConsulta: form.primeira, ultimaConsulta: form.ultima,
      inicioIntervalo: form.inicioIntervalo || null, fimIntervalo: form.fimIntervalo || null,
      tempoConsulta: form.tempo || "00:30", ativo: true,
    }));
    setRows((r) => [...r.filter((row) => !selecionados.some((d) => d.chave === row.dia)), ...novas].sort(
      (a, b) => diasSemana.findIndex((d) => d.chave === a.dia) - diasSemana.findIndex((d) => d.chave === b.dia)
    ));
    setForm({ primeira: "", ultima: "", inicioIntervalo: "", fimIntervalo: "", tempo: "00:30", dias: {} });
  }

  async function salvar() {
    setSalvando(true);
    try {
      await atualizarDocumento(`clinicas/${clinicaId}/membros`, profissionalId, { horariosTrabalho: rows });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-xl2 shadow-pop flex flex-col overflow-hidden animate-slideIn">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white">
          <span className="font-display font-semibold flex items-center gap-2"><Clock size={18} /> Cadastrar horários</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 focus-ring"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center text-ink-500 gap-2"><Loader2 size={18} className="animate-spin" /> Carregando…</div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="px-5 py-4 border-b border-black/5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                <Info size={13} /> Defina a janela de atendimento e replique para os dias que desejar
              </div>
              <div className="grid sm:grid-cols-5 gap-3">
                <Field label="Primeira Consulta" type="time" value={form.primeira} onChange={(v) => setForm({ ...form, primeira: v })} />
                <Field label="Última Consulta" type="time" value={form.ultima} onChange={(v) => setForm({ ...form, ultima: v })} />
                <Field label="Início Intervalo" type="time" value={form.inicioIntervalo} onChange={(v) => setForm({ ...form, inicioIntervalo: v })} />
                <Field label="Fim Intervalo" type="time" value={form.fimIntervalo} onChange={(v) => setForm({ ...form, fimIntervalo: v })} />
                <Field label="Tempo da Consulta" type="time" value={form.tempo} onChange={(v) => setForm({ ...form, tempo: v })} />
              </div>
              <div>
                <span className="text-xs text-ink-500 font-medium">Selecionar dias úteis</span>
                <div className="flex flex-wrap gap-3 mt-2">
                  {diasSemana.map((d) => (
                    <label key={d.chave} className="flex items-center gap-1.5 text-xs text-ink-700">
                      <input type="checkbox" checked={!!form.dias[d.chave]} onChange={() => toggleDia(d.chave)} className="rounded accent-brand-600" />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={adicionar} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg focus-ring ml-auto">
                <Plus size={14} /> Adicionar agenda
              </button>
            </div>

            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-black/5">
                <tr className="text-left text-ink-500">
                  <Th>Dia</Th><Th>Primeira Consulta</Th><Th>Última Consulta</Th><Th>Início intervalo</Th><Th>Fim intervalo</Th><Th>Tempo Consulta</Th><Th>Ativo</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.dia} className="border-b border-black/5">
                    <Td className="font-medium text-ink-900">{diasSemana.find((d) => d.chave === r.dia)?.label || r.dia}</Td>
                    <Td>{r.primeiraConsulta}</Td>
                    <Td>{r.ultimaConsulta}</Td>
                    <Td className="text-ink-500">{r.inicioIntervalo || "—"}</Td>
                    <Td className="text-ink-500">{r.fimIntervalo || "—"}</Td>
                    <Td>{r.tempoConsulta}</Td>
                    <Td><input type="checkbox" checked={r.ativo} onChange={() => toggleAtivo(r.dia)} className="rounded accent-brand-600" /></Td>
                    <Td>
                      <button onClick={() => remover(r.dia)} className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold px-3 py-1 rounded-md focus-ring">Remover</button>
                    </Td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="text-center text-ink-500 py-6">Nenhum horário cadastrado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-black/5 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm font-semibold text-ink-500 hover:text-ink-900 px-4 py-2 rounded-lg focus-ring">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg focus-ring">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar horários
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange }) {
  return (
    <label className="block text-xs">
      <span className="text-ink-500 font-medium">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring" />
    </label>
  );
}
function Th({ children }) { return <th className="px-3 py-2.5 font-semibold text-[11px] whitespace-nowrap">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2.5 text-ink-700 whitespace-nowrap ${className}`}>{children}</td>; }
