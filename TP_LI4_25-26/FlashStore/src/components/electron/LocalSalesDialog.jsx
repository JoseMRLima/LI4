import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

function formatWhen(iso) {
  if (!iso) return '—';
  return String(iso).replace('T', ' ').slice(0, 16);
}

function syncLabel(status) {
  if (status === 'pending_local') return 'Na BD local · a aguardar sincronização';
  if (status === 'synced') return 'Sincronizada com o servidor central';
  if (status === 'synced') return 'Sincronizada';
  return status || '—';
}

/**
 * Lista vendas gravadas na BD local (abre após venda offline).
 */
export default function LocalSalesDialog({ open, onOpenChange }) {
  const [sales, setSales] = useState([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const api = window.flashstore?.db;
    if (!api?.getRecentSales) return;
    setLoading(true);
    try {
      const [ping, recent] = await Promise.all([
        api.ping?.() ?? Promise.resolve({ outboxPending: 0 }),
        api.getRecentSales({ limit: 25 }),
      ]);
      setPending(ping?.outboxPending ?? 0);
      setSales(recent?.sales || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Venda guardada na base de dados local</DialogTitle>
          <DialogDescription>
            A venda foi registada neste computador. Quando a rede voltar, use
            &quot;Recarregar&quot; no aviso amarelo para tentar ligar ao servidor e sincronizar
            {pending > 0 ? ` (${pending} pendente(s)).` : '.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={load}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar lista
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border min-h-[180px]">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">A carregar…</p>
          ) : sales.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-2 font-medium">Data</th>
                  <th className="p-2 font-medium">Total</th>
                  <th className="p-2 font-medium">Pagamento</th>
                  <th className="p-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{formatWhen(sale.created_date)}</td>
                    <td className="p-2 font-medium">{Number(sale.total).toFixed(2)}€</td>
                    <td className="p-2">{sale.payment_method}</td>
                    <td className="p-2 text-xs">
                      <span
                        className={
                          sale.sync_status === 'pending_local'
                            ? 'text-amber-700 font-medium'
                            : 'text-muted-foreground'
                        }
                      >
                        {syncLabel(sale.sync_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
