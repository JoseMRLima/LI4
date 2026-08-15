import React, { useMemo, useState } from 'react';
import { X, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function isExpiredLot(lot) {
  if (!lot.expiry_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(lot.expiry_date) < today;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * UC02 — Consultar stock no PDV
 * Modal de pesquisa rápida de stock por nome/código,
 * com lista de lotes e datas de validade.
 */
export default function StockLookupModal({ products, stockList, onClose }) {
  const [search, setSearch] = useState('');

  const productsById = useMemo(() => {
    const map = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  const lotsByProduct = useMemo(() => {
    const grouped = {};
    for (const lot of stockList || []) {
      if (!grouped[lot.product_id]) grouped[lot.product_id] = [];
      grouped[lot.product_id].push(lot);
    }
    for (const lots of Object.values(grouped)) {
      lots.sort((a, b) => {
        const aExp = a.expiry_date || '9999-12-31';
        const bExp = b.expiry_date || '9999-12-31';
        return aExp.localeCompare(bExp);
      });
    }
    return grouped;
  }, [stockList]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const items = Object.entries(lotsByProduct).map(([productId, lots]) => {
      const product = productsById[productId] || { id: productId, name: lots[0]?.product_name || 'Produto', barcode: '', category: '' };
      const totalQty = lots.reduce((sum, l) => sum + (isExpiredLot(l) ? 0 : Number(l.quantity || 0)), 0);
      const minimum = Math.max(...lots.map((l) => Number(l.minimum_threshold || 0))) || 0;
      return { product, lots, totalQty, minimum };
    });

    if (!term) {
      return items
        .filter((item) => item.totalQty > 0)
        .sort((a, b) => a.product.name.localeCompare(b.product.name))
        .slice(0, 100);
    }

    return items
      .filter((item) =>
        (item.product.name || '').toLowerCase().includes(term) ||
        String(item.product.barcode || '').includes(term)
      )
      .sort((a, b) => a.product.name.localeCompare(b.product.name))
      .slice(0, 100);
  }, [lotsByProduct, productsById, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-card flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Consultar stock
            </h2>
            <p className="text-xs text-muted-foreground">Pesquise por nome ou código de barras</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b p-3">
          <Input
            autoFocus
            placeholder="Nome do produto ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 text-base"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {results.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem resultados.</p>
          )}

          {results.map(({ product, lots, totalQty, minimum }) => {
            const sellable = lots.filter((l) => !isExpiredLot(l));
            const expired = lots.filter((l) => isExpiredLot(l));
            const isLow = minimum > 0 && totalQty <= minimum;

            return (
              <div key={product.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.barcode ? `${product.barcode} · ` : ''}{product.category || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${isLow ? 'text-amber-700' : 'text-foreground'}`}>
                      {totalQty} un.
                    </p>
                    {minimum > 0 && (
                      <p className="text-[11px] text-muted-foreground">mínimo: {minimum}</p>
                    )}
                  </div>
                </div>

                {isLow && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Stock abaixo do mínimo definido
                  </div>
                )}

                {sellable.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lotes vendáveis</p>
                    {sellable.map((lot) => {
                      const days = daysUntil(lot.expiry_date);
                      const expiringSoon = days !== null && days <= 7;
                      return (
                        <div key={lot.id} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-muted-foreground">{lot.serial_number || 'SEM-LOTE'}</span>
                          <span className={expiringSoon ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                            {Number(lot.quantity)} un.
                            {lot.expiry_date ? ` · val. ${String(lot.expiry_date).slice(0, 10)}${expiringSoon ? ` (${days}d)` : ''}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {expired.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-red-600">Lotes expirados (não vendáveis)</p>
                    {expired.map((lot) => (
                      <div key={lot.id} className="flex items-center justify-between text-xs text-red-600 line-through">
                        <span className="font-mono">{lot.serial_number || 'SEM-LOTE'}</span>
                        <span>{Number(lot.quantity)} un. · val. {String(lot.expiry_date).slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t p-3">
          <Button variant="outline" onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </div>
    </div>
  );
}
