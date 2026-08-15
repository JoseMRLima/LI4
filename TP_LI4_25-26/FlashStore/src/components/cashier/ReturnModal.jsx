import React, { useEffect, useMemo, useState } from 'react';
import { X, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, formatApiError } from '@/api/apiClient';
import { toast } from 'sonner';

import ManagerAuthFields from './ManagerAuthFields';

/**
 * @param {{ sale: any, user?: any, onClose: () => void, onReturned?: (result: any) => void }} props
 */
export default function ReturnModal({ sale, user, onClose, onReturned }) {
  const [items, setItems] = useState([]);
  const [returnsInfo, setReturnsInfo] = useState([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');

  useEffect(() => {
    if (!sale?.id) return;
    let cancelled = false;
    api.returns.forSale(sale.id)
      .then((data) => {
        if (cancelled) return;
        setReturnsInfo(data || []);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [sale?.id]);

  const previousReturnsByItem = useMemo(() => {
    const map = {};
    for (const r of returnsInfo) {
      for (const it of (r.items || [])) {
        map[it.sale_item_id] = (map[it.sale_item_id] || 0) + Number(it.quantity || 0);
      }
    }
    return map;
  }, [returnsInfo]);

  useEffect(() => {
    if (!sale?.items) return;
    const initial = sale.items.map((item) => ({
      sale_item_id: item.id,
      product_name: item.product_name,
      max: Math.max(0, Number(item.quantity || 0) - (previousReturnsByItem[item.id] || 0)),
      unit_price: Number(item.unit_price || 0),
      quantity: 0,
    }));
    setItems(initial);
  }, [sale?.items, previousReturnsByItem]);

  const totalRefund = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price), 0),
    [items]
  );

  const updateQty = (id, value) => {
    setItems((prev) => prev.map((it) => {
      if (it.sale_item_id !== id) return it;
      const num = Math.max(0, Math.min(Number(value || 0), it.max));
      return { ...it, quantity: num };
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const toReturn = items.filter((it) => Number(it.quantity || 0) > 0);
    if (toReturn.length === 0) {
      toast.error('Indique pelo menos um item para devolver.');
      return;
    }

    if (user?.role === 'cashier') {
      if (!mgrEmail.trim() || !mgrPassword) {
        toast.error('A devolução requer autorização do gerente (email e palavra-passe).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        reason: reason || null,
        items: toReturn.map((it) => ({ sale_item_id: it.sale_item_id, quantity: it.quantity })),
      };
      if (user?.role === 'cashier') {
        payload.manager_email = mgrEmail.trim();
        payload.manager_password = mgrPassword;
      }
      const result = await api.returns.create(sale.id, payload);
      toast.success(`Devolução registada · reembolso ${Number(result.total_refunded).toFixed(2)}€`);
      onReturned?.(result);
      onClose();
    } catch (err) {
      toast.error(formatApiError(err, 'Erro ao registar devolução.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-card flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-primary" />
              Devolução parcial
            </h2>
            <p className="text-xs text-muted-foreground">
              Documento {sale?.invoice_number || sale?.id}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Indique a quantidade a devolver de cada item. O stock é reposto e a venda é marcada como anulada se for devolvida na totalidade.
            </p>

            {items.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Esta venda não tem items disponíveis.</p>
            )}

            {items.map((item) => {
              const previouslyReturned = previousReturnsByItem[item.sale_item_id] || 0;
              const lineTotal = Number(item.quantity) * Number(item.unit_price);
              return (
                <div key={item.sale_item_id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.unit_price.toFixed(2)}€/un · disponível: {item.max} un.
                        {previouslyReturned > 0 ? ` · já devolvido: ${previouslyReturned}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-primary">{lineTotal.toFixed(2)}€</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => updateQty(item.sale_item_id, Math.max(0, item.quantity - 1))}
                      disabled={item.quantity <= 0}
                    >−</Button>
                    <Input
                      type="number"
                      min="0"
                      max={item.max}
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.sale_item_id, e.target.value)}
                      className="h-9 text-center w-20"
                      disabled={item.max === 0}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => updateQty(item.sale_item_id, Math.min(item.max, item.quantity + 1))}
                      disabled={item.quantity >= item.max}
                    >+</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => updateQty(item.sale_item_id, item.max)}
                      disabled={item.max === 0}
                    >Tudo</Button>
                  </div>
                </div>
              );
            })}

            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: produto danificado, troca, engano no preço..."
              />
            </div>

            {user?.role === 'cashier' && (
              <ManagerAuthFields
                email={mgrEmail}
                password={mgrPassword}
                onEmailChange={setMgrEmail}
                onPasswordChange={setMgrPassword}
                disabled={submitting}
              />
            )}
          </div>

          <div className="border-t p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total a reembolsar</span>
              <span className="text-lg font-bold">{totalRefund.toFixed(2)}€</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting || totalRefund === 0}>
                {submitting ? 'A processar...' : 'Confirmar devolução'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
