import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import BackofficeSidebar from './BackofficeSidebar';
import { Button } from '@/components/ui/button';

export default function BackofficeLayout({ variant = 'manager' }) {
  const location = useLocation();
  const basePath = variant === 'admin' ? '/admin' : '/manager';

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/60 via-white to-slate-50">
      <BackofficeSidebar variant={variant} />
      {/* Mobile top bar */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/Flashstore.png" alt="FlashStore" className="h-7 w-7 object-contain" />
            <Link to={basePath} className="text-sm font-bold text-white">FlashStore</Link>
          </div>
          <Button variant="ghost" size="icon" aria-label="Menu" className="text-white/70 hover:text-white hover:bg-white/10">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <main className="p-4 lg:ml-64 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
