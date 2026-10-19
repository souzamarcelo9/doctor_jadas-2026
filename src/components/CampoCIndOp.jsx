import { useState } from "react";
import { CIND_OP_OPCOES } from "../lib/nfseCodigos";

// Seletor do Indicador de Operação (cIndOp). value "" = automático/padrão.
export default function CampoCIndOp({ value, onChange, rotuloVazio, className = "" }) {
  const conhecido = CIND_OP_OPCOES.some((o) => o.valor === value);
  const [outro, setOutro] = useState(!!value && !conhecido);
  const selecionado = outro ? "__outro__" : value;

  function aoSelecionar(v) {
    if (v === "__outro__") { setOutro(true); onChange(""); return; }
    setOutro(false);
    onChange(v);
  }

  return (
    <div className={className}>
      <select value={selecionado} onChange={(e) => aoSelecionar(e.target.value)} className="w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring">
        <option value="">{rotuloVazio}</option>
        {CIND_OP_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        <option value="__outro__">Outro código (digitar)…</option>
      </select>
      {outro && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" placeholder="6 dígitos (ex: 030101)"
          className="mt-1.5 w-full text-sm border border-black/10 rounded-lg px-2.5 py-1.5 focus-ring"
        />
      )}
    </div>
  );
}
