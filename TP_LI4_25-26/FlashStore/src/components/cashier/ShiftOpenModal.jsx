import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, formatApiError } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { getPosTerminalId, setPosTerminalId as persistPosTerminal } from '@/lib/posTerminal';

export default function ShiftOpenModal({ user, onPosChange, onShiftOpened }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [posTerminalId, setTerminal] = useState('');
  const [declared, setDeclared] = useState('');
  const [expectedFromManager, setExpectedFromManager] = useState(null);
  const [loadingFloat, setLoadingFloat] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data: terminals = [], isLoading: loadingTerminals } = useQuery({
    queryKey: ['posTerminals', user?.store],
    queryFn: () => api.posTerminals.list(user.store),
    enabled: Boolean(user?.store),
  });

  useEffect(() => {
    if (!terminals.length) {
      setTerminal('');
      return;
    }
    const saved = getPosTerminalId();
    const bySaved = saved
      ? terminals.find((t) => t.code.toUpperCase() === String(saved).toUpperCase())
      : null;
    const code = bySaved ? bySaved.code : terminals[0].code;
    setTerminal(code);
    persistPosTerminal(code);
    onPosChange?.(code);
  }, [terminals, onPosChange]);

  useEffect(() => {
    if (!user?.store || !posTerminalId) {
      setLoadingFloat(false);
      return;
    }
    let cancelled = false;
    setLoadingFloat(true);
    api.registerFloats
      .list(user.store, today)
      .then((rows) => {
        if (cancelled) return;
        const row = (rows || []).find(
          (r) => String(r.terminal_id).toUpperCase() === String(posTerminalId).toUpperCase()
        );
        if (!row || row.opening_float === undefined || row.opening_float === null || row.opening_float === '') {
          setExpectedFromManager(null);
        } else {
          const n = Number(row.opening_float);
          setExpectedFromManager(Number.isNaN(n) ? null : n);
        }
      })
      .catch(() => {
        if (!cancelled) setExpectedFromManager(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFloat(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.store, today, posTerminalId]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('flashstore_token') || ''}`,
        },
      });
    } catch {
      /* ignored */
    }
    logout();
    navigate('/login', { replace: true });
  };

  const logoutControl = (
    <div className="absolute top-4 right-4 z-[61]">
      <Button type="button" variant="outline" size="sm" onClick={handleLogout} className="gap-2 shadow-sm">
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </div>
  );

  const handleOpen = async (e) => {
    e.preventDefault();
    if (!user?.store) return;
    if (!posTerminalId) {
      toast.error('Seleccione um caixa registado para a loja.');
      return;
    }
    const amount = parseFloat(String(declared).replace(',', '.'));
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Indique o numerário contado na gaveta (≥ 0).');
      return;
    }
    setSubmitting(true);
    try {
      const row = await api.shifts.open({
        store: user.store,
        pos_terminal_id: posTerminalId.trim(),
        opening_declared_cash: amount,
        shift_date: today,
      });
      if (row.opening_warning) toast.warning(row.opening_warning);
      else toast.success('Turno aberto. Pode iniciar vendas.');
      if (row.pos_terminal_id) onPosChange?.(row.pos_terminal_id);
      onShiftOpened?.(row);
    } catch (err) {
      toast.error(formatApiError(err, 'Não foi possível abrir o turno.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTerminals) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-4 text-sm text-muted-foreground">
        {logoutControl}
        <span>A carregar caixas da loja…</span>
      </div>
    );
  }

  if (!terminals.length) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-4">
        {logoutControl}
        <div className="max-w-md rounded-2xl border bg-card p-6 shadow-xl text-center space-y-3">
          <h2 className="text-lg font-bold">Sem caixas configurados</h2>
          <p className="text-sm text-muted-foreground">
            Não há caixas POS para esta loja na base de dados. É preciso configurá-los (por exemplo em{' '}
            <strong>Fecho de dia</strong>) antes de abrir turnos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-4">
      {logoutControl}
      <form
        onSubmit={handleOpen}
        className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-xl"
      >
        <div>
          <h2 className="text-xl font-bold">Abertura de turno</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha o caixa e indique o numerário contado na gaveta para abrir o turno.
          </p>
        </div>

        <div className="space-y-1">
          <Label>Caixa (POS)</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={posTerminalId}
            onChange={(e) => {
              const v = e.target.value;
              setTerminal(v);
              persistPosTerminal(v);
              onPosChange?.(v);
            }}
          >
            {terminals.map((t) => (
              <option key={t.id} value={t.code}>
                {t.code}
                {t.label ? ` — ${t.label}` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Caixas disponíveis para esta loja. Em build estática pode usar <span className="font-mono">VITE_POS_TERMINAL_ID</span>.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="text-muted-foreground text-xs">Fundo para hoje</p>
          <p className="text-lg font-semibold">
            {loadingFloat ? '…' : expectedFromManager !== null ? `${Number(expectedFromManager).toFixed(2)}€` : '0€'}
          </p>
        </div>

        <div className="space-y-1">
          <Label>Numerário contado na gaveta</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={declared}
            onChange={(e) => setDeclared(e.target.value)}
            placeholder="Ex: 120.00"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting || !posTerminalId}>
          {submitting ? 'A abrir…' : 'Abrir turno'}
        </Button>
      </form>
    </div>
  );
}
