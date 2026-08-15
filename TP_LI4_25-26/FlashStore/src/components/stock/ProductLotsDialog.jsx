import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';

export function isExpired(expiryDate) {
  if (!expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(expiryDate) < today;
}

export function lotStatus(lot) {
  if (Number(lot.quantity || 0) <= 0) return 'Esgotado';
  if (isExpired(lot.expiry_date)) return 'Expirado';
  return 'Ativo';
}

function lotKey(lot) {
  return [
    lot.product_id || '',
    lot.store || '',
    lot.serial_number || 'SEM-LOTE',
  ].join('|');
}

export function mergeStockLots(lots) {
  const grouped = new Map();

  for (const lot of lots) {
    const key = lotKey(lot);
    const quantity = Number(lot.quantity || 0);

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...lot,
        id: key,
        sourceIds: [lot.id],
        quantity,
      });
      continue;
    }

    const current = grouped.get(key);
    current.sourceIds.push(lot.id);
    current.quantity += quantity;

    if (lot.expiry_date && (!current.expiry_date || lot.expiry_date < current.expiry_date)) {
      current.expiry_date = lot.expiry_date;
    }

    if (lot.created_date && (!current.created_date || lot.created_date < current.created_date)) {
      current.created_date = lot.created_date;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aExpiry = a.expiry_date || '9999-12-31';
    const bExpiry = b.expiry_date || '9999-12-31';
    if (aExpiry !== bExpiry) return aExpiry.localeCompare(bExpiry);
    return String(a.serial_number || '').localeCompare(String(b.serial_number || ''));
  });
}

function groupLotsByProduct(lots) {
  const activeLots = [];
  const inactiveLots = [];
  for (const lot of lots) {
    if (Number(lot.quantity || 0) > 0) {
      activeLots.push(lot);
    } else {
      inactiveLots.push(lot);
    }
  }
  return { activeLots, inactiveLots };
}

function LotsTable({ lots, showTerminateAction, onTerminate, terminating }) {
  return (
    <div className="max-h-[min(58vh,620px)] overflow-auto rounded-lg border">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
              Lote / Série
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Qtd.</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Validade</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Estado</th>
            {showTerminateAction ? (
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Ações</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lots.map((lot) => {
            const status = lotStatus(lot);
            const mergedCount = lot.sourceIds?.length || 1;
            return (
              <tr key={lot.id}>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium">{lot.serial_number || 'SEM-LOTE'}</div>
                  {mergedCount > 1 ? (
                    <div className="text-xs text-muted-foreground">{mergedCount} registos agrupados</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold">{Number(lot.quantity || 0)}</td>
                <td className="px-4 py-3 text-sm">{lot.expiry_date || '—'}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={status === 'Ativo' ? 'secondary' : 'outline'}
                    className={`text-xs ${status === 'Expirado' ? 'border-yellow-300 bg-yellow-100 text-yellow-800' : ''}`}
                  >
                    {status}
                  </Badge>
                </td>
                {showTerminateAction ? (
                  <td className="px-4 py-3 text-right">
                    {status === 'Expirado' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-yellow-300 text-yellow-800 hover:bg-yellow-50"
                        onClick={() => onTerminate(lot)}
                        disabled={terminating}
                      >
                        Terminar lote
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {lots.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">Sem lotes nesta categoria</div>
      )}
    </div>
  );
}

/**
 * Modal de lotes por produto e loja (gerente: com terminar lote; admin: só leitura).
 */
export default function ProductLotsDialog({
  open,
  onOpenChange,
  productId,
  productName,
  storeName,
  allowTerminateLot = false,
}) {
  const queryClient = useQueryClient();

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['stock', 'lots', productId, storeName],
    queryFn: () => api.entities.Stock.filter({ store: storeName }),
    enabled: open && Boolean(productId && storeName),
  });

  const storeLots = useMemo(
    () => mergeStockLots(stock.filter((lot) => lot.product_id === productId)),
    [stock, productId]
  );

  const { activeLots, inactiveLots } = useMemo(() => groupLotsByProduct(storeLots), [storeLots]);

  const terminateLotMutation = useMutation({
    mutationFn: (lot) => Promise.all(
      (lot.sourceIds || [lot.id]).map((id) => api.entities.Stock.update(id, { quantity: 0 }))
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock', 'lots', productId, storeName] });
      queryClient.invalidateQueries({ queryKey: ['admin-franchise-products'] });
      onOpenChange(false);
      toast({ title: 'Lote terminado', description: 'O lote foi marcado para remoção das estantes.' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao terminar lote',
        description: error.message || 'Não foi possível atualizar o lote.',
        variant: 'destructive',
      });
    },
  });

  const title =
    productName && storeName ? `${productName} — ${storeName}` : productName || 'Lotes';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {storeName ? (
            <p className="text-sm text-muted-foreground">
              Lotes registados na loja {storeName}
              {allowTerminateLot ? '' : ' (consulta apenas)'}
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 overflow-hidden px-6 pb-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">A carregar lotes...</p>
          ) : storeLots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem stock para este produto nesta loja.
            </p>
          ) : (
            <Tabs defaultValue="active" className="flex h-full min-h-0 flex-col">
              <TabsList className="mt-4 w-fit">
                <TabsTrigger value="active">Lotes ativos ({activeLots.length})</TabsTrigger>
                <TabsTrigger value="inactive">Terminados ({inactiveLots.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4 min-h-0">
                <LotsTable
                  lots={activeLots}
                  showTerminateAction={allowTerminateLot}
                  onTerminate={(lot) => terminateLotMutation.mutate(lot)}
                  terminating={terminateLotMutation.isPending}
                />
              </TabsContent>
              <TabsContent value="inactive" className="mt-4 min-h-0">
                <LotsTable lots={inactiveLots} showTerminateAction={false} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
