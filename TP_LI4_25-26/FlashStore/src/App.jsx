import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { hasModuleAccess } from '@/lib/permissions';

// Pages
import Login from './pages/Login';
import RoleRouter from './pages/RoleRouter';
import CashierPOS from './pages/cashier/CashierPOS';
import ManagerLayout from './components/layout/ManagerLayout';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './pages/manager/Dashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSuppliers from './pages/admin/AdminSuppliers';
import AdminReports from './pages/admin/AdminReports';
import AdminFranchiseProducts from './pages/admin/AdminFranchiseProducts';
import AdminAudit from './pages/admin/AdminAudit';
import AdminStores from './pages/admin/AdminStores';
import Products from './pages/manager/Products';
import StockManagement from './pages/manager/StockManagement';
import SalesHistory from './pages/manager/SalesHistory';
import Suppliers from './pages/manager/Suppliers';
import Orders from './pages/manager/Orders';
import Employees from './pages/manager/Employees';
import Reports from './pages/manager/Reports';
import DayClosure from './pages/manager/DayClosure';
import AlertsPage from './pages/manager/AlertsPage';

/**
 * Guard de autenticação.
 * - Enquanto verifica o token: mostra spinner
 * - Sem token válido: redireciona para /login
 * - Com token válido: renderiza as rotas protegidas
 */
const PrivateRoutes = () => {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar FlashStore...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Guarda o URL atual para redirecionar após login
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const roleHome = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'manager'
      ? '/manager'
      : '/cashier';
  const isManagerLike = user?.role === 'manager';
  const managerRoute = (moduleKey, element) => (
    hasModuleAccess(user?.role || 'manager', moduleKey) ? element : <Navigate to="/manager" replace />
  );

  return (
    <Routes>
      <Route path="/" element={<RoleRouter />} />
      <Route path="/cashier" element={<CashierPOS />} />
      <Route element={user?.role === 'admin' ? <AdminLayout /> : <Navigate to={roleHome} replace />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<AdminFranchiseProducts />} />
        <Route path="/admin/stores" element={<AdminStores />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/promotions" element={<AdminPromotions />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/suppliers" element={<AdminSuppliers />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
        <Route path="/admin/day-closure" element={<DayClosure />} />
      </Route>
      <Route element={isManagerLike ? <ManagerLayout /> : <Navigate to={roleHome} replace />}>
        <Route path="/manager" element={managerRoute('dashboard', <Dashboard />)} />
        <Route path="/manager/products" element={managerRoute('products', <Products />)} />
        <Route path="/manager/stock" element={managerRoute('stock', <StockManagement />)} />
        <Route path="/manager/sales" element={managerRoute('sales', <SalesHistory />)} />
        <Route path="/manager/suppliers" element={managerRoute('suppliers', <Suppliers />)} />
        <Route path="/manager/orders" element={managerRoute('orders', <Orders />)} />
        <Route path="/manager/promotions" element={<Navigate to="/manager" replace />} />
        <Route path="/manager/employees" element={managerRoute('employees', <Employees />)} />
        <Route path="/manager/reports" element={managerRoute('reports', <Reports />)} />
        <Route path="/manager/day-closure" element={managerRoute('day_closure', <DayClosure />)} />
        <Route path="/manager/alerts" element={managerRoute('alerts', <AlertsPage />)} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* /login é pública — renderiza sempre, sem guard */}
            <Route path="/login" element={<Login />} />
            {/* Todas as outras rotas passam pelo PrivateRoutes */}
            <Route path="/*" element={<PrivateRoutes />} />
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
