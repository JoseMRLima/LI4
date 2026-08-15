import React, { useState } from 'react';
import { X, Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const methods = [
  { id: 'Numerário', label: 'Numerário', icon: Banknote, color: 'bg-green-500' },
  { id: 'Multibanco', label: 'Multibanco', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'MB Way', label: 'MB Way', icon: Smartphone, color: 'bg-red-500' },
  { id: 'Cartão', label: 'Cartão', icon: Wallet, color: 'bg-purple-500' },
];

export default function PaymentModal({ total, onComplete, onClose }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [nif, setNif] = useState('');
  const [processing, setProcessing] = useState(false);

  const change = selectedMethod === 'Numerário' ? Math.max(0, parseFloat(amountPaid || 0) - total) : 0;
  const canPay = selectedMethod && (selectedMethod !== 'Numerário' || parseFloat(amountPaid || 0) >= total);

  const handlePay = async () => {
    setProcessing(true);
    await onComplete({
      method: selectedMethod,
      amountPaid: selectedMethod === 'Numerário' ? parseFloat(amountPaid) : total,
      change,
      nif
    });
    setProcessing(false);
  };

  const quickAmounts = [5, 10, 20, 50];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Pagamento</h2>
            <p className="text-3xl font-extrabold text-primary mt-1">{total.toFixed(2)}€</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment method selection */}
          <div className="grid grid-cols-2 gap-3">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMethod(m.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  selectedMethod === m.id ? 'border-primary bg-accent' : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${m.color} flex items-center justify-center`}>
                  <m.icon className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-sm">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Cash amount input */}
          {selectedMethod === 'Numerário' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Montante recebido</label>
                <Input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00€"
                  className="h-14 text-2xl font-bold text-center mt-1"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmountPaid(String(amt))}
                    className="flex-1 py-2 rounded-lg bg-muted hover:bg-muted/80 font-semibold text-sm"
                  >
                    {amt}€
                  </button>
                ))}
                <button
                  onClick={() => setAmountPaid(String(Math.ceil(total)))}
                  className="flex-1 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 font-semibold text-sm text-primary"
                >
                  Exacto
                </button>
              </div>
              {parseFloat(amountPaid) >= total && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-green-700">Troco a devolver</p>
                  <p className="text-3xl font-extrabold text-green-600">{change.toFixed(2)}€</p>
                </div>
              )}
            </div>
          )}

          {/* NIF */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">NIF do cliente (opcional)</label>
            <Input
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              placeholder="Contribuinte (9 dígitos)"
              className="mt-1"
              maxLength={9}
            />
          </div>
        </div>

        <div className="p-5 border-t border-border">
          <Button
            onClick={handlePay}
            disabled={!canPay || processing}
            className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90"
          >
            {processing ? 'A processar...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </div>
    </div>
  );
}