import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, formatApiError } from '@/api/apiClient';
import { toast } from 'sonner';
import { isElectronApp } from '@/lib/connectivity';

/**
 * @param {{ user: any, activeShift: any, isOnline: boolean, onClose: () => void, onShiftClosed?: (row: any) => void }} props
 */
export default function ShiftCloseModal({ user, activeShift, isOnline, onClose, onShiftClosed }) {
  const [countedCash, setCountedCash] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [shiftSales, setShiftSales] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const offline = !isOnline && isElectronApp();

  const loadShiftData = useCallback(async () => {
    if (!user?.email || !user?.store || !activeShift?.id) {
      setShiftSales([]);
      setCashSummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (offline) {
        // Carregar vendas do turno a partir da BD local
        const local = await window.flashstore.db.getShiftSales({ shift_id: activeShift.id });
        setShiftSales(local?.sales || []);
        setCashSummary(null); // fallback: openingCash + cashSalesThisShift
        return;
      }

      const [sales, summary] = await Promise.all([
        api.entities.Sale.filter({
          store: user.store,
          shift_closure_id: activeShift.id,
          status: 'completed',
        }),
        api.shifts.cashSummary(activeShift.id),
      ]);
      setShiftSales(sales || []);
      setCashSummary(summary);
    } catch (error) {
      console.error(error);
      toast.error(formatApiError(error, 'Erro ao carregar dados do turno.'));
    } finally {
      setLoading(false);
    }
  }, [user, activeShift?.id, offline]);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  const openingCash = Number(
    activeShift?.opening_declared_cash ?? activeShift?.opening_expected_cash ?? 0
  );

  const cashSalesThisShift = useMemo(() => {
    return shiftSales
      .filter((sale) => sale.payment_method === 'Numerário')
      .reduce((sum, sale) => {
        const amountPaid = Number(sale.amount_paid || 0);
        const total = Number(sale.total || 0);
        const changeGiven = Number(sale.change_given || 0);
        if (amountPaid > 0) return sum + (amountPaid - changeGiven);
        return sum + total;
      }, 0);
  }, [shiftSales]);

  const totalSales = useMemo(() => {
    return shiftSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }, [shiftSales]);

  const expectedCash = cashSummary?.expected_drawer_cash ?? openingCash + cashSalesThisShift;
  const counted = parseFloat(countedCash || 0);
  const withdrawn = parseFloat(withdrawAmount || 0);
  const cashLeftInStore = Math.max(0, counted - withdrawn);
  const discrepancy = counted - expectedCash;

  const handleClose = async () => {
    if (countedCash === '') {
      toast.error('Indica o numerário contado.');
      return;
    }

    if (withdrawn > counted) {
      toast.error('O valor a retirar não pode ser maior do que o numerário contado.');
      return;
    }

    try {
      setProcessing(true);

      if (offline) {
        // Fechar turno offline — fica no outbox para sincronizar depois
        await window.flashstore.db.closeShift({
          shift_id: activeShift.id,
          store: user.store,
          cashier_email: user.email,
          closing_cash: counted,
          notes: '',
        });
        onShiftClosed?.({ ...activeShift, status: 'pending_approval' });
        toast.success('Turno fechado offline. Será sincronizado quando o servidor estiver disponível.');
        onClose();
        return;
      }

      const now = new Date();
      const endTime = now.toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const updated = await api.entities.ShiftClosure.update(activeShift.id, {
        end_time: endTime,
        expected_cash: expectedCash,
        counted_cash: counted,
        withdrawn_cash: withdrawn,
        cash_left_in_store: cashLeftInStore,
        discrepancy,
        total_sales: totalSales,
        num_transactions: shiftSales.length,
        status: 'pending_approval',
      });

      onShiftClosed?.(updated);
      toast.success('Turno fechado e enviado para aprovação do gerente.');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(formatApiError(error, 'Erro ao fechar turno.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-contain bg-black/60">
      <div className="flex min-h-full items-center justify-center p-3 py-6 sm:p-4 sm:py-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shift-close-title"
          className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col min-h-0 my-auto"
        >
          <div className="p-4 border-b flex shrink-0 items-center justify-between">
            <h2 id="shift-close-title" className="font-bold text-lg">
              Fechar Turno
            </h2>
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div className="text-xs text-muted-foreground">
            Caixa <span className="font-mono font-medium text-foreground">{activeShift?.pos_terminal_id || '—'}</span>
            {activeShift?.opening_mismatch ? (
              <span className="ml-2 text-amber-700 font-medium">· Abertura com diferença (informar gerente)</span>
            ) : null}
            {offline && (
              <span className="ml-2 text-orange-600 font-medium">· Modo offline — fecho ficará pendente de sincronização</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Vendas do Turno</p>
              <p className="text-lg font-bold">{loading ? '...' : shiftSales.length}</p>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Vendido</p>
              <p className="text-lg font-bold">{loading ? '...' : `${totalSales.toFixed(2)}€`}</p>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Fundo inicial (abertura)</p>
              <p className="text-lg font-bold">{loading ? '...' : `${openingCash.toFixed(2)}€`}</p>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Numerário vendido</p>
              <p className="text-lg font-bold">{loading ? '...' : `${cashSalesThisShift.toFixed(2)}€`}</p>
            </div>
          </div>

          {cashSummary && Number(cashSummary.approved_drops || 0) > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              Sangrias aprovadas: −{Number(cashSummary.approved_drops).toFixed(2)}€
            </p>
          )}

          <div className="bg-orange-100 p-4 rounded-xl text-center">
            <p className="text-sm">Numerário Esperado na Gaveta</p>
            <p className="text-2xl font-bold text-orange-600">
              {loading ? '...' : `${expectedCash.toFixed(2)}€`}
            </p>
          </div>

          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Numerário contado"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            disabled={loading || processing}
          />

          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Valor a retirar"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            disabled={loading || processing}
          />

          <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
            <div className="flex justify-between">
              <span>Numerário esperado</span>
              <strong>{expectedCash.toFixed(2)}€</strong>
            </div>
            <div className="flex justify-between">
              <span>Numerário contado</span>
              <strong>{counted.toFixed(2)}€</strong>
            </div>
            <div className="flex justify-between">
              <span>Valor a retirar</span>
              <strong>{withdrawn.toFixed(2)}€</strong>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span>Fica em caixa</span>
              <strong>{cashLeftInStore.toFixed(2)}€</strong>
            </div>
          </div>

          {countedCash !== '' && (
            <div
              className={`p-3 rounded-lg text-center ${
                Math.abs(discrepancy) < 0.01 ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <p className="text-sm">Discrepância</p>
              <p className="font-bold">
                {discrepancy >= 0 ? '+' : ''}
                {discrepancy.toFixed(2)}€
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t shrink-0 bg-card rounded-b-2xl">
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading || countedCash === '' || processing || withdrawn > counted}
            className="w-full"
          >
            {processing
              ? 'A fechar...'
              : offline
              ? 'Confirmar Fecho (offline)'
              : 'Confirmar Fecho'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
