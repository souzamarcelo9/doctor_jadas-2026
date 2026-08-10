import { useState } from "react";
import Topbar from "../components/Topbar";
import PreferenciasModal from "../components/PreferenciasModal";
import { SlidersHorizontal, FileSignature, ListTodo, UserCog, FileText } from "lucide-react";

const cards = [
  { icon: SlidersHorizontal, title: "Preferências", desc: "Ajuste suas configurações de trabalho e o layout do prontuário." },
  { icon: FileSignature, title: "Certificado Digital", desc: "Configure aqui seu certificado digital para assinaturas e NFS-e." },
  { icon: ListTodo, title: "Lista de Tarefas", desc: "Distribua e controle suas tarefas." },
  { icon: UserCog, title: "Editar Usuário", desc: "Ajuste o seu usuário." },
  { icon: FileText, title: "Termos de Uso", desc: "Termos e condições gerais de uso." },
];

export default function Config() {
  const [openPref, setOpenPref] = useState(false);
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title="Configurações" />
      <main className="flex-1 p-4 lg:p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map(({ icon: Icon, title, desc }) => (
            <button
              key={title}
              onClick={() => title === "Preferências" && setOpenPref(true)}
              className="card p-4 text-left hover:shadow-pop transition-shadow focus-ring"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2.5">
                <Icon size={18} />
              </div>
              <div className="text-sm font-semibold text-ink-900">{title}</div>
              <div className="text-xs text-ink-500 mt-1">{desc}</div>
            </button>
          ))}
        </div>
      </main>
      <PreferenciasModal open={openPref} onClose={() => setOpenPref(false)} />
    </div>
  );
}
