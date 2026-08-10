import Topbar from "../components/Topbar";
import { Construction } from "lucide-react";

export default function Placeholder({ title }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title={title} />
      <main className="flex-1 p-4 lg:p-6">
        <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center">
            <Construction size={24} />
          </div>
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          <p className="text-xs text-ink-500 max-w-sm">
            Módulo previsto para a próxima release do protótipo, seguindo o mesmo padrão visual e de navegação das demais telas.
          </p>
        </div>
      </main>
    </div>
  );
}
