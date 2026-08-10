import { FileStack } from "lucide-react";

export default function GenericTab({ name }) {
  return (
    <div className="card p-10 flex flex-col items-center justify-center text-center gap-2">
      <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center">
        <FileStack size={22} />
      </div>
      <p className="text-sm font-semibold text-ink-900">{name}</p>
      <p className="text-xs text-ink-500 max-w-xs">
        Seção reservada para a próxima leva do protótipo — mesma estrutura de cabeçalho, filtros e tabela das demais abas.
      </p>
    </div>
  );
}
