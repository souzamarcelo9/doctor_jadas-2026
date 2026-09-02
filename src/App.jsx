import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TenantProvider } from "./context/TenantContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Onboarding from "./pages/Onboarding";
import AvaliarConsulta from "./pages/AvaliarConsulta";
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import Atendimento from "./pages/Atendimento";
import IAClinica from "./pages/IAClinica";
import NotasFiscais from "./pages/NotasFiscais";
import Config from "./pages/Config";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Placeholder from "./pages/Placeholder";
import AssinaturasPendentes from "./pages/AssinaturasPendentes";
import Tarefas from "./pages/Tarefas";

function AppLayout() {
  return (
    <ProtectedRoute>
      <TenantProvider>
        <div className="flex min-h-screen bg-[#f4f8f8]">
          <Sidebar />
          <Outlet />
        </div>
      </TenantProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/avaliar/:clinicaId/:avaliacaoId" element={<AvaliarConsulta />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/atendimento/:pacienteId" element={<Atendimento />} />
            <Route path="/ia" element={<IAClinica />} />
            <Route path="/notas-fiscais" element={<NotasFiscais />} />
            <Route path="/config" element={<Config />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/assinaturas" element={<AssinaturasPendentes />} />
            <Route path="*" element={<Placeholder title="Página não encontrada" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
