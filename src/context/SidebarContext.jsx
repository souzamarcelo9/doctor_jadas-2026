import { createContext, useContext, useState } from "react";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ mobileOpen, abrir: () => setMobileOpen(true), fechar: () => setMobileOpen(false), alternar: () => setMobileOpen((o) => !o) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  // Fora do provider (ex: telas fora do AppLayout), devolve um estado
  // inofensivo em vez de quebrar — nenhuma dessas telas tem sidebar mesmo.
  return ctx || { mobileOpen: false, abrir: () => {}, fechar: () => {}, alternar: () => {} };
}
