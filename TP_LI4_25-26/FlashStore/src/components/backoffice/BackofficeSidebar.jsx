import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Store,
  Tag,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasModuleAccess } from '@/lib/permissions';

const managerItems = [
  { label: 'Dashboard Loja', icon: LayoutDashboard, path: '/manager', permissionKey: 'dashboard' },
  { label: 'Produtos', icon: Package, path: '/manager/products', permissionKey: 'products' },
  { label: 'Stock Local', icon: Store, path: '/manager/stock', permissionKey: 'stock' },
  { label: 'Vendas', icon: BarChart3, path: '/manager/sales', permissionKey: 'sales' },
  { label: 'Encomendas', icon: ClipboardList, path: '/manager/orders', permissionKey: 'orders' },
  { label: 'Fornecedores', icon: Truck, path: '/manager/suppliers', permissionKey: 'suppliers' },
  { label: 'Funcionários', icon: Users, path: '/manager/employees', permissionKey: 'employees' },
  { label: 'Relatórios', icon: FileText, path: '/manager/reports', permissionKey: 'reports' },
  { label: 'Fecho de Dia', icon: FileCheck2, path: '/manager/day-closure', permissionKey: 'day_closure' },
];

const adminItems = [
  { label: 'Dashboard Global', icon: LayoutDashboard, path: '/admin' },
  { label: 'Produtos', icon: Boxes, path: '/admin/products' },
  { label: 'Lojas', icon: Store, path: '/admin/stores' },
  { label: 'Utilizadores', icon: Users, path: '/admin/users' },
  { label: 'Promoções', icon: Tag, path: '/admin/promotions' },
  { label: 'Encomendas', icon: ClipboardList, path: '/admin/orders' },
  { label: 'Fornecedores', icon: Truck, path: '/admin/suppliers' },
  { label: 'Relatórios', icon: BarChart3, path: '/admin/reports' },
  { label: 'Fecho de Dia', icon: FileCheck2, path: '/admin/day-closure' },
  { label: 'Auditoria', icon: FileText, path: '/admin/audit' },
];

export default function BackofficeSidebar({ variant = 'manager' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const items = variant === 'admin'
    ? adminItems
    : managerItems.filter((item) => hasModuleAccess(user?.role || 'manager', item.permissionKey));
  const roleLabel = variant === 'admin' ? 'Admin Central' : 'Gerente de Loja';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex flex-col items-center px-4 py-7">
        <img src="/images/Flashstore.png" alt="FlashStore" className="h-16 w-16 object-contain mb-3" />
        <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide">FlashStore</h1>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-orange-400/80">{roleLabel}</span>
      </div>
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== `/${variant}` && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
      <div className="p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/50 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Terminar Sessão
        </button>
      </div>
    </aside>
  );
}
