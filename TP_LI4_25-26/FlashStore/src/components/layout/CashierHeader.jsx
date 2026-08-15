import React from 'react';
import { CircleDot, LogOut, User, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function CashierHeader({
  user,
  posTerminalId,
  activeShift,
  expectedDrawerCash,
  pendingDropsTotal,
  isOnline = true,
  connectivityChecking = false,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const shiftOpen = !!activeShift && activeShift.status === 'open';

  const indicatorTone = shiftOpen
    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
    : 'bg-white/10 text-white/60 border-white/20';

  const indicatorLabel = shiftOpen ? 'Turno aberto' : 'Sem turno aberto';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('flashstore_token') || ''}`,
        },
      });
    } catch { /* ignored */ }
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-6 shadow-lg border-b-2 border-orange-500/30">
      <div className="flex items-center gap-3">
        <img src="/images/Flashstore.png" alt="FlashStore" className="h-9 w-9 object-contain" />
        <div>
          <h1 className="text-base font-bold text-white">FlashStore</h1>
          <p className="text-xs text-white/60 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{user?.store || 'Ponto de Venda'}</span>
            {posTerminalId ? (
              <span className="text-white/80">
                · <span className="font-mono">{posTerminalId}</span>
              </span>
            ) : null}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                connectivityChecking
                  ? 'border-white/25 bg-white/10 text-white/70'
                  : isOnline
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100'
                    : 'border-amber-400/50 bg-amber-500/20 text-amber-100'
              }`}
            >
              {connectivityChecking ? (
                'A verificar…'
              ) : isOnline ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </span>
          </p>
        </div>
      </div>
      {shiftOpen && expectedDrawerCash != null && (
        <div className="hidden md:flex items-center gap-1 text-xs text-white/85">
          <span className="text-white/60">Dinheiro Esperado na Gaveta:</span>
          <span className="font-mono font-semibold text-white">
            {Number(expectedDrawerCash).toFixed(2)}€
          </span>
          {(pendingDropsTotal || 0) > 0 && (
            <span className="ml-2 text-[11px] text-amber-200/90">
              Sangrias: {Number(pendingDropsTotal).toFixed(2)}€
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${indicatorTone}`}>
          <CircleDot className={`h-3 w-3 ${shiftOpen ? 'text-emerald-300' : 'text-white/40'}`} />
          <span>{indicatorLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-white/80">
          <User className="w-4 h-4" />
          <span className="text-sm">{user?.full_name || 'Operador'}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
