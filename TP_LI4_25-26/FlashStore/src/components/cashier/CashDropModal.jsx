import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, formatApiError } from '@/api/apiClient';
import { toast } from 'sonner';

export default function CashDropModal({ shiftId, onClose, onCreated }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const val = parseFloat(String(amount).replace(',', '.'));
    if (!shiftId || Number.isNaN(val) || val <= 0) {
      toast.error('Indique um valor válido para a sangria.');
      return;
    }
    setSubmitting(true);
    try {
      await api.cashDrops.create({
        shift_closure_id: shiftId,
        amount: val,
        reason: reason.trim() || null,
      });
      toast.success('Pedido de sangria enviado.');
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(formatApiError(err, 'Erro ao registar sangria.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-lg">Sangria para cofre</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Retirada de numerário excedente da gaveta para o cofre.
          </p>
          <div className="space-y-1">
            <Label>Valor (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: excesso em caixa"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'A enviar…' : 'Pedir sangria'}
          </Button>
        </form>
      </div>
    </div>
  );
}
