import { NavLink } from "react-router-dom";
import {
  Home, CalendarDays, Users, Settings, FileSignature,
  ListTodo, BarChart3, Wallet, Sparkles, Receipt,
} from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Página inicial" },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  { to: "/pacientes", icon: Users, label: "Pacientes" },
  { to: "/ia", icon: Sparkles, label: "IA Clínica" },
  { to: "/notas-fiscais", icon: Receipt, label: "Notas Fiscais" },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios" },
  { to: "/financeiro", icon: Wallet, label: "Financeiro" },
  { to: "/tarefas", icon: ListTodo, label: "Tarefas" },
  { to: "/assinaturas", icon: FileSignature, label: "Assinaturas" },
  { to: "/config", icon: Settings, label: "Configurações" },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-16 lg:w-56 shrink-0 bg-brand-900 text-white h-screen sticky top-0">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 gap-2 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center font-display font-bold text-brand-950 text-sm">
          DP
        </div>
        <span className="hidden lg:inline font-display font-semibold tracking-wide text-sm">
          Doctor<span className="text-brand-300">PEP</span>
        </span>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-lg text-sm transition-colors focus-ring
               ${isActive ? "bg-brand-600 text-white" : "text-brand-100/80 hover:bg-white/5 hover:text-white"}`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden lg:inline truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="hidden lg:block px-4 py-4 text-[11px] text-brand-200/60 border-t border-white/10">
        Protótipo v0.1 · uso interno
      </div>
    </aside>
  );
}
