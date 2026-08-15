import React, { useState } from 'react';
import { api } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAYMENT_METHODS } from '@/lib/constants';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { printReceipt } from '@/lib/receiptPrinter';

export default function SalesHistory() {
  const [paymentFilter, setPaymentFilter] = useState('all');
  const { user } = useAuth();
  const managerStore = user?.store || user?.store_name || 'Braga Centro';

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.entities.Sale.list('-created_date', 500),
  });

  const filtered = sales.filter(s => {
    const matchStore = s.store === managerStore;
    const matchPayment = paymentFilter === 'all' || s.payment_method === paymentFilter;
    return matchStore && matchPayment;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + (s.total || 0), 0);

  const paymentColors = {
    'Numerário': 'bg-green-100 text-green-800',
    'Multibanco': 'bg-blue-100 text-blue-800',
    'MB Way': 'bg-red-100 text-red-800',
    'Cartão': 'bg-purple-100 text-purple-800'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Histórico de Vendas</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} vendas em {managerStore} — Total: {totalRevenue.toFixed(2)}€</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Métodos</SelectItem>
            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Loja</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Operador</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Talão</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Artigos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Pagamento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">NIF</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(sale => (
                <tr key={sale.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">
                    {sale.created_date ? format(new Date(sale.created_date), "dd/MM/yyyy HH:mm", { locale: pt }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{sale.store}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{sale.cashier_name || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {sale.receipt_text ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                        onClick={() => printReceipt(sale.receipt_text, sale.receipt_number || sale.invoice_number)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {sale.receipt_number || 'Imprimir'}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{sale.items?.length || 0} artigos</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${paymentColors[sale.payment_method] || ''}`}>{sale.payment_method}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{sale.customer_nif || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">{sale.total?.toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhuma venda encontrada</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
