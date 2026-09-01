import { useState } from "react";
import { Bell, HelpCircle, ThumbsUp, Maximize2, LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";
import { useFirestoreDoc } from "../lib/firestore";
import ClinicSwitcher from "./ClinicSwitcher";
import { currentUser as demoUser } from "../data/mockData";

export default function Topbar({ title, timer }) {
  const { user, profile, logout, firebaseConfigured } = useAuth();
  const { clinicaId, profissionalId } = useTenant();
  const { data: membro } = useFirestoreDoc(clinicaId ? `clinicas/${clinicaId}/membros` : null, profissionalId);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = membro?.nome || profile?.nome || user?.displayName || user?.email || demoUser.name;
  const displayStatus = firebaseConfigured ? (profile?.status || "Disponível") : `${demoUser.status} (modo demo)`;
  const fotoUrl = membro?.fotoUrl || "";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="font-display font-semibold text-ink-900 text-base lg:text-lg truncate">{title}</h1>
        {timer && (
          <span className="hidden sm:inline text-xs text-ink-500 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
            Tempo de atendimento: <span className="font-semibold text-brand-700">{timer}</span>
          </span>
        )}
        <ClinicSwitcher />
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <label className="hidden sm:flex items-center gap-2 text-xs text-ink-500">
          Assinatura Digital
          <span className="w-9 h-5 rounded-full bg-gray-200 relative cursor-pointer">
            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
          </span>
        </label>
        <button className="p-2 rounded-lg hover:bg-black/5 text-ink-500 focus-ring"><Maximize2 size={17} /></button>
        <button className="p-2 rounded-lg hover:bg-black/5 text-ink-500 relative focus-ring">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>
        <button className="p-2 rounded-lg hover:bg-black/5 text-ink-500 focus-ring"><HelpCircle size={17} /></button>
        <button className="p-2 rounded-lg hover:bg-black/5 text-ink-500 focus-ring"><ThumbsUp size={17} /></button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-black/10 focus-ring rounded-lg"
          >
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
              {fotoUrl ? <img src={fotoUrl} alt="" className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <div className="text-xs font-semibold text-ink-900 max-w-[140px] truncate">{displayName}</div>
              <div className="text-[11px] text-emerald-600">{displayStatus}</div>
            </div>
            <ChevronDown size={14} className="hidden sm:block text-ink-500" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-pop border border-black/5 py-1.5 z-20">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 focus-ring"
                >
                  <LogOut size={14} /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
