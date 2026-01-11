import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/dashboard/Produtos";
import ProdutoGerenciar from "./pages/dashboard/ProdutoGerenciar";
import Marketplace from "./pages/dashboard/Marketplace";
import Afiliados from "./pages/dashboard/Afiliados";
import Vendas from "./pages/dashboard/Vendas";
import Assinaturas from "./pages/dashboard/Assinaturas";
import Carteira from "./pages/dashboard/Carteira";
import Relatorios from "./pages/dashboard/Relatorios";
import Integracoes from "./pages/dashboard/Integracoes";
import Suporte from "./pages/dashboard/Suporte";
import Configuracoes from "./pages/dashboard/Configuracoes";
import Documentos from "./pages/dashboard/Documentos";
import Checkout from "./pages/Checkout";
import CheckoutClean from "./pages/CheckoutClean";
import ShortLinkCheckout from "./pages/ShortLinkCheckout";

import CheckoutSuccess from "./pages/CheckoutSuccess";
import UpsellOffer from "./pages/UpsellOffer";
import DownsellOffer from "./pages/DownsellOffer";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./components/MaintenancePage";
import useMaintenanceMode from "./hooks/useMaintenanceMode";
import ImpersonationBar from "./components/admin/ImpersonationBar";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminPermissoes from "./pages/admin/AdminPermissoes";
import AdminProdutos from "./pages/admin/AdminProdutos";
import AdminVendas from "./pages/admin/AdminVendas";
import AdminSaques from "./pages/admin/AdminSaques";
import AdminContas from "./pages/admin/AdminContas";
import AdminRelatorios from "./pages/admin/AdminRelatorios";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import AdminDocumentos from "./pages/admin/AdminDocumentos";
import AdminSuporte from "./pages/admin/AdminSuporte";
import AdminGateway from "./pages/admin/AdminGateway";
import AdminGerentes from "./pages/admin/AdminGerentes";
import AdminVisualizarUsuario from "./pages/admin/AdminVisualizarUsuario";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminTaxas from "./pages/admin/AdminTaxas";
import AdminFaturamento from "./pages/admin/AdminFaturamento";
import GerenteDashboard from "./pages/gerente/GerenteDashboard";

// Student area pages
import AlunoDashboard from "./pages/aluno/AlunoDashboard";
import AlunoCurso from "./pages/aluno/AlunoCurso";
import AlunoPerfil from "./pages/aluno/AlunoPerfil";

// Landing pages
import Funcionalidades from "./pages/landing/Funcionalidades";
import Taxas from "./pages/landing/Taxas";
import AreaMembros from "./pages/landing/AreaMembros";
import IntegracoesPagina from "./pages/landing/Integracoes";
import Sobre from "./pages/landing/Sobre";
import Blog from "./pages/landing/Blog";
import Carreiras from "./pages/landing/Carreiras";
import Contato from "./pages/landing/Contato";
import CentralAjuda from "./pages/landing/CentralAjuda";
import Documentacao from "./pages/landing/Documentacao";
import Status from "./pages/landing/Status";
import API from "./pages/landing/API";
import TermosDeUso from "./pages/landing/TermosDeUso";
import PoliticaDePrivacidade from "./pages/landing/PoliticaDePrivacidade";

const queryClient = new QueryClient();

// Routes that are exempt from maintenance mode
const MAINTENANCE_EXEMPT_ROUTES = [
  '/login',
  '/admin',
  '/checkout',
  '/p/',
];

const MaintenanceWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isMaintenanceMode, isAdmin, loading, message } = useMaintenanceMode();
  const location = useLocation();

  // Check if current route is exempt from maintenance mode
  const isExemptRoute = MAINTENANCE_EXEMPT_ROUTES.some(route => 
    location.pathname.startsWith(route) || location.pathname === '/'
  );

  // Don't block while loading
  if (loading) {
    return <>{children}</>;
  }

  // Show maintenance page if in maintenance mode, not admin, and not on exempt route
  if (isMaintenanceMode && !isAdmin && !isExemptRoute) {
    return <MaintenancePage message={message} />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <MaintenanceWrapper>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/clean" element={<CheckoutClean />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/offer/upsell" element={<UpsellOffer />} />
        <Route path="/offer/downsell" element={<DownsellOffer />} />
        <Route path="/p/:shortId" element={<Checkout />} />
        <Route path="/p/:shortId/:slug" element={<Checkout />} />
        <Route path="/c/:shortId" element={<Checkout />} />
        <Route path="/c/:shortId/:slug" element={<Checkout />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/produtos" element={<Produtos />} />
        <Route path="/dashboard/produtos/:id" element={<ProdutoGerenciar />} />
        <Route path="/dashboard/marketplace" element={<Marketplace />} />
        <Route path="/dashboard/afiliados" element={<Afiliados />} />
        <Route path="/dashboard/vendas" element={<Vendas />} />
        <Route path="/dashboard/assinaturas" element={<Assinaturas />} />
        <Route path="/dashboard/carteira" element={<Carteira />} />
        <Route path="/dashboard/relatorios" element={<Relatorios />} />
        <Route path="/dashboard/integracoes" element={<Integracoes />} />
        <Route path="/dashboard/suporte" element={<Suporte />} />
        <Route path="/dashboard/configuracoes" element={<Configuracoes />} />
        <Route path="/dashboard/documentos" element={<Documentos />} />
        
        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/usuarios" element={<AdminUsuarios />} />
        <Route path="/admin/permissoes" element={<AdminPermissoes />} />
        <Route path="/admin/produtos" element={<AdminProdutos />} />
        <Route path="/admin/vendas" element={<AdminVendas />} />
        <Route path="/admin/saques" element={<AdminSaques />} />
        <Route path="/admin/contas" element={<AdminContas />} />
        <Route path="/admin/gateway" element={<AdminGateway />} />
        <Route path="/admin/relatorios" element={<AdminRelatorios />} />
        <Route path="/admin/configuracoes" element={<AdminConfiguracoes />} />
        <Route path="/admin/documentos" element={<AdminDocumentos />} />
        <Route path="/admin/suporte" element={<AdminSuporte />} />
        <Route path="/admin/gerentes" element={<AdminGerentes />} />
        <Route path="/admin/banners" element={<AdminBanners />} />
        <Route path="/admin/taxas" element={<AdminTaxas />} />
        <Route path="/admin/faturamento" element={<AdminFaturamento />} />
        <Route path="/admin/visualizar-usuario/:userId" element={<AdminVisualizarUsuario />} />
        
        {/* Manager routes */}
        <Route path="/gerente" element={<GerenteDashboard />} />
        
        {/* Student area routes */}
        <Route path="/aluno" element={<AlunoDashboard />} />
        <Route path="/aluno/curso/:courseId" element={<AlunoCurso />} />
        <Route path="/aluno/perfil" element={<AlunoPerfil />} />
        
        {/* Landing pages */}
        <Route path="/funcionalidades" element={<Funcionalidades />} />
        <Route path="/taxas" element={<Taxas />} />
        <Route path="/area-membros" element={<AreaMembros />} />
        <Route path="/integracoes" element={<IntegracoesPagina />} />
        <Route path="/sobre" element={<Sobre />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/carreiras" element={<Carreiras />} />
        <Route path="/contato" element={<Contato />} />
        <Route path="/central-ajuda" element={<CentralAjuda />} />
        <Route path="/documentacao" element={<Documentacao />} />
        <Route path="/status" element={<Status />} />
        <Route path="/api" element={<API />} />
        <Route path="/termos-de-uso" element={<TermosDeUso />} />
        <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
        
        {/* Short link checkout - must be before catch-all */}
        <Route path="/:code" element={<ShortLinkCheckout />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MaintenanceWrapper>
  );
};

const App = () => {
  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem('app-theme');
    const root = document.documentElement;
    
    if (stored === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ImpersonationBar />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
