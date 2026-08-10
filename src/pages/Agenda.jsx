import { useState } from "react";
import Topbar from "../components/Topbar";
import AgendaGrid from "../components/agenda/AgendaGrid";
import AgendaWhatsapp from "../components/agenda/AgendaWhatsapp";
import CadastrarHorariosModal from "../components/CadastrarHorariosModal";
import { CalendarDays, MessageCircle } from "lucide-react";

export default function Agenda() {
  const [tab, setTab] = useState("agenda");
  const [openHorarios, setOpenHorarios] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Agenda" />
      <main className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex gap-2">
          <TabBtn active={tab === "agenda"} onClick={() => setTab("agenda")} icon={CalendarDays}>
            Agenda do dia
          </TabBtn>
          <TabBtn active={tab === "whatsapp"} onClick={() => setTab("whatsapp")} icon={MessageCircle}>
            Lembretes WhatsApp
          </TabBtn>
        </div>

        {tab === "agenda" ? (
          <AgendaGrid onOpenHorarios={() => setOpenHorarios(true)} />
        ) : (
          <AgendaWhatsapp />
        )}
      </main>
      <CadastrarHorariosModal open={openHorarios} onClose={() => setOpenHorarios(false)} />
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg focus-ring transition-colors
        ${active ? "bg-brand-600 text-white" : "bg-white text-ink-500 border border-black/10 hover:text-ink-900"}`}
    >
      <Icon size={15} /> {children}
    </button>
  );
}
