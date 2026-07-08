import { createBrowserRouter, Navigate } from "react-router-dom"
import AppLayout from "../layouts/AppLayout"
import AuthLayout from "../layouts/AuthLayout"
import ProtectedRoute from "./ProtectedRoute"

import LandingPage from "../pages/lp/LandingPage"
import LoginPage from "../pages/auth/LoginPage"
import CadastroPage from "../pages/auth/CadastroPage"
import InicioPage from "../pages/inicio/InicioPage"
import ClientesPage from "../pages/clientes/ClientesPage"
import ConsentPage from "../pages/openfinance/ConsentPage"
import DashboardPage from "../pages/dashboard/DashboardPage"
import AssinaturaPage from "../pages/assinatura/AssinaturaPage"
import CrmPage from "../pages/crm/CrmPage"
import OnboardingPage from "../pages/onboarding/OnboardingPage"
import FaturasPage from "../pages/faturas/FaturasPage"
import MarcaPage from "../pages/marca/MarcaPage"
import ConfiguracoesPage from "../pages/configuracoes/ConfiguracoesPage"
import PainelAnaliticoPage from "../pages/painelAnalitico/PainelAnaliticoPage"
import ImportarExtratoPage from "../pages/importExtrato/ImportarExtratoPage"
import CadastrosPage from "../pages/cadastros/CadastrosPage"
import ClienteLoginPage from "../pages/clienteFinal/ClienteLoginPage"
import ClienteLayout from "../layouts/ClienteLayout"
import ClienteDashboardPage from "../pages/clienteFinal/ClienteDashboardPage"
import ClienteImportarPage from "../pages/clienteFinal/ClienteImportarPage"
import NegocioLayout from "../layouts/NegocioLayout"
import NegocioLoginPage from "../pages/negocio/NegocioLoginPage"
import PainelNegocioPage from "../pages/negocio/PainelNegocioPage"
import PlanejadoresPage from "../pages/negocio/PlanejadoresPage"
import CarteiraPlanejadorPage from "../pages/negocio/CarteiraPlanejadorPage"
import FinanceiroPlataformaPage from "../pages/negocio/FinanceiroPlataformaPage"
import MeuPerfilNegocioPage from "../pages/negocio/MeuPerfilNegocioPage"

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/cadastro", element: <CadastroPage /> },
      { path: "/cliente/login", element: <ClienteLoginPage /> },
      { path: "/negocio/login", element: <NegocioLoginPage /> },
    ],
  },
  {
    element: <ClienteLayout />,
    children: [
      { path: "/cliente/dashboard", element: <ClienteDashboardPage /> },
      { path: "/cliente/importar", element: <ClienteImportarPage /> },
    ],
  },
  {
    element: <NegocioLayout />,
    children: [
      { path: "/negocio", element: <PainelNegocioPage /> },
      { path: "/negocio/planejadores", element: <PlanejadoresPage /> },
      { path: "/negocio/planejadores/:planejadorId", element: <CarteiraPlanejadorPage /> },
      { path: "/negocio/financeiro", element: <FinanceiroPlataformaPage /> },
      { path: "/negocio/perfil", element: <MeuPerfilNegocioPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/inicio", element: <InicioPage /> },
          { path: "/dashboard/:clienteId", element: <DashboardPage /> },
          { path: "/clientes", element: <ClientesPage /> },
          { path: "/consentimento", element: <ConsentPage /> },
          { path: "/assinatura", element: <AssinaturaPage /> },
          { path: "/crm", element: <CrmPage /> },
          { path: "/onboarding", element: <OnboardingPage /> },
          { path: "/faturas", element: <FaturasPage /> },
          { path: "/marca", element: <MarcaPage /> },
          { path: "/configuracoes", element: <ConfiguracoesPage /> },
          { path: "/painel-analitico", element: <PainelAnaliticoPage /> },
          { path: "/importar-extrato", element: <ImportarExtratoPage /> },
          { path: "/cadastros", element: <CadastrosPage /> },
          { path: "/cadastros/:subtab", element: <CadastrosPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/inicio" replace /> },
])
