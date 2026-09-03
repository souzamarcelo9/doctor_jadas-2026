import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { buscarCid10 } from "../../lib/cid10";

/** Campo de busca de CID-10 com autocomplete. Ao selecionar um resultado,
 * chama `onSelect({ codigo, descricao })` — quem usa decide o que fazer
 * com isso (preencher outros campos, etc). */
export default function Cid10Picker({ onSelect, placeholder = "Buscar por código ou descrição…" }) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (termo.trim().length < 2) return;

    async function buscar() {
      setBuscando(true);
      await new Promise((r) => setTimeout(r, 150)); // pequeno debounce — evita rebuscar a cada tecla digitada
      if (cancelado) return;
      const r = await buscarCid10(termo);
      if (!cancelado) { setResultados(r); setBuscando(false); }
    }
    buscar();

    return () => { cancelado = true; };
  }, [termo]);

  function selecionar(item) {
    onSelect(item);
    setTermo(`${item.codigo} — ${item.descricao}`);
    setAberto(false);
  }

  return (
    <div className="relative">
      {buscando ? <Loader2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500 animate-spin" /> : <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />}
      <input
        value={termo}
        onChange={(e) => { setTermo(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        className="w-full text-xs border border-black/10 rounded-lg pl-7 pr-2.5 py-1.5 focus-ring"
      />
      {aberto && termo.trim().length >= 2 && resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-black/10 rounded-lg shadow-pop divide-y divide-black/5">
          {resultados.map((item) => (
            <button
              key={item.codigo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionar(item)}
              className="w-full text-left text-xs px-3 py-2 hover:bg-brand-50 focus-ring"
            >
              <span className="font-semibold text-brand-700">{item.codigo}</span>{" "}
              <span className="text-ink-700">{item.descricao}</span>
            </button>
          ))}
        </div>
      )}
      {aberto && !buscando && termo.trim().length >= 2 && resultados.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-black/10 rounded-lg shadow-pop px-3 py-2 text-xs text-ink-500">
          Nenhum código encontrado.
        </div>
      )}
    </div>
  );
}
