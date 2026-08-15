/**
 * RoleRouter — redireciona o utilizador autenticado para a área correta
 * com base no seu role: admin → /admin | manager → /manager | cashier → /cashier
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function RoleRouter() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A redirecionar...</p>
        </div>
      </div>
    );
  }

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === 'manager') {
    return <Navigate to="/manager" replace />;
  }

  return <Navigate to="/cashier" replace />;
}
