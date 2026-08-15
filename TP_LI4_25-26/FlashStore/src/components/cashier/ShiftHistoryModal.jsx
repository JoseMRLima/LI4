import React, { useCallback, useEffect, useState } from 'react';
import { X, Ban, ChevronDown, ChevronRight, Printer, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, formatApiError } from '@/api/apiClient';
import { toast } from 'sonner';
import { printReceipt } from '@/lib/receiptPrinter';
import ReturnModal from './ReturnModal';
import ManagerAuthFields from './ManagerAuthFields';

const METHOD_LABELS = {
  Numerário: '💵',
  Multibanco: '💳',
  'MB Way': '📱',
  Cartão: '💜',
};

/**
 * @param {{ user: any, activeShift: any, onClose: () => void, onSaleCancelled?: () => void }} props
 */
export default function ShiftHistoryModal({ user, activeShift, onClose, onSaleCancelled }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [returnSale, setReturnSale] = useState(null);
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');

  const loadSales = useCallback(async () => {
    if (!user?.email || !user?.store || !activeShift?.id) return;
    setLoading(true);
    try {
      const rows = await api.entities.Sale.filter({
        cashier_email: user.email,
        store: user.store,
        shift_closure_id: activeShift.id,
      });
      setSales((rows || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch {
      toast.error('Erro ao carregar histórico do turno.');
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.store, activeShift?.id]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleCancel = async (saleId) => {
    if (confirmCancelId !== saleId) {
      setConfirmCancelId(saleId);
      setTimeout(() => setConfirmCancelId(null), 3000);
      return;
    }

    if (user?.role === 'cashier' && (!mgrEmail.trim() || !mgrPassword)) {
      toast.error('Indique email e palavra-passe do gerente para anular a venda.');
      return;
    }

    setCancelling(true);
    try {
      const body = { status: 'cancelled' };
      if (user?.role === 'cashier') {
        body.manager_email = mgrEmail.trim();
        body.manager_password = mgrPassword;
      }
      await api.entities.Sale.update(saleId, body);
      setSales((prev) => prev.map((s) => (s.id === saleId ? { ...s, status: 'cancelled' } : s)));
      toast.success('Venda anulada e stock reposto.');
      onSaleCancelled?.();
      setMgrPassword('');
    } catch (err) {
      toast.error(formatApiError(err, 'Erro ao anular venda.'));
    } finally {
      setCancelling(false);
      setConfirmCancelId(null);
    }
  };

  const handleReturned = () => {
    loadSales();
    onSaleCancelled?.();
  };

  const completedSales = sales.filter((s) => s.status === 'completed');
  const totalTurno = completedSales.reduce((sum, s) => sum + Number(s.total || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Histórico do Turno</h2>
            <p className="text-xs text-muted-foreground">
              {completedSales.length} vendas · {totalTurno.toFixed(2)}€
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {user?.role === 'cashier' && (
          <div className="px-3 pt-3">
            <ManagerAuthFields
              email={mgrEmail}
              password={mgrPassword}
              onEmailChange={setMgrEmail}
              onPasswordChange={setMgrPassword}
              disabled={cancelling}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <p className="text-center text-muted-foreground text-sm py-8">A carregar...</p>
          )}

          {!loading && sales.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Sem vendas neste turno.</p>
          )}

          {!loading &&
            sales.map((sale) => {
              const isCancelled = sale.status === 'cancelled';
              const isExpanded = expandedId === sale.id;
              const time = new Date(sale.created_date).toLocaleTimeString('pt-PT', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const items = sale.items || [];

              return (
                <div
                  key={sale.id}
                  className={`rounded-xl border ${isCancelled ? 'opacity-50 border-dashed border-muted' : 'border-border'}`}
                >
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{sale.invoice_number}</span>
                        {isCancelled && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">
                            Anulada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {time} · {METHOD_LABELS[sale.payment_method] || ''} {sale.payment_method}
                        {items.length > 0 && ` · ${items.length} artigo${items.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-sm font-bold ${isCancelled ? 'line-through text-muted-foreground' : 'text-primary'}`}
                      >
                        {Number(sale.total).toFixed(2)}€
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                      {items.length > 0 && (
                        <div className="space-y-1">
                          {items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {item.quantity}× {item.product_name}
                              </span>
                              <span>{Number(item.subtotal).toFixed(2)}€</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {sale.customer_nif && (
                        <p className="text-xs text-muted-foreground">NIF: {sale.customer_nif}</p>
                      )}

                      {sale.receipt_text && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          type="button"
                          onClick={() =>
                            printReceipt(sale.receipt_text, sale.receipt_number || sale.invoice_number)
                          }
                        >
                          <Printer className="w-3.5 h-3.5 mr-1.5" />
                          Imprimir talão
                        </Button>
                      )}

                      {!isCancelled && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                            type="button"
                            onClick={() => setReturnSale(sale)}
                          >
                            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                            Devolução parcial
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                            disabled={cancelling}
                            type="button"
                            onClick={() => handleCancel(sale.id)}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1.5" />
                            {confirmCancelId === sale.id ? 'Confirmar anulação?' : 'Anular venda'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="p-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full" type="button">
            Fechar
          </Button>
        </div>
      </div>

      {returnSale && (
        <ReturnModal
          sale={returnSale}
          user={user}
          onClose={() => setReturnSale(null)}
          onReturned={() => handleReturned(returnSale.id)}
        />
      )}
    </div>
  );
}
