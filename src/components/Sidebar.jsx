import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  Home, CalendarDays, Users, Settings, FileSignature,
  ListTodo, BarChart3, Wallet, Sparkles, Receipt, X,
} from "lucide-react";
import logoNucleo from "../assets/logo-nucleo.png";
import { useSidebar } from "../context/SidebarContext";

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
  const { mobileOpen, fechar } = useSidebar();
  const location = useLocation();

  // Troca de página fecha a gaveta sozinha — sem isso, navegar pelo menu
  // no celular deixaria a gaveta aberta por cima da tela nova.
  useEffect(() => { fechar(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Overlay — some por trás da gaveta em telas pequenas, clicar fora fecha */}
      {mobileOpen && <div className="md:hidden fixed inset-0 bg-ink-900/50 z-40" onClick={fechar} />}

      <aside
        className={`fixed md:sticky top-0 z-50 md:z-auto flex flex-col w-64 md:w-16 lg:w-56 shrink-0 bg-brand-900 text-white h-screen transition-transform duration-200 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="h-16 flex items-center justify-between md:justify-center lg:justify-start px-5 md:px-0 lg:px-5 gap-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <img src={logoNucleo} alt="Núcleo" className="w-8 h-8 object-contain" />
            <span className="inline md:hidden lg:inline font-display font-semibold tracking-wide text-sm">
              Doctor<span className="text-brand-300">NÚCLEO</span>
            </span>
          </div>
          <button onClick={fechar} className="md:hidden p-1.5 rounded-lg hover:bg-white/10 focus-ring"><X size={18} /></button>
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
              <span className="inline md:hidden lg:inline truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="block md:hidden lg:block px-4 py-4 text-[11px] text-brand-200/60 border-t border-white/10 shrink-0">
          DOCTOR-NÚCLEO 2026
        </div>
      </aside>
    </>
  );
}
