import React, { useMemo, useState } from 'react';
import { api } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle, Boxes } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProductLotsDialog, { isExpired, mergeStockLots } from '@/components/stock/ProductLotsDialog';
import { useAuth } from '@/lib/AuthContext';

function daysUntil(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(expiryDate) - today) / (1000 * 60 * 60 * 24));
}

export default function StockManagement() {
  const [search, setSearch] = useState('');
  const [lotsDialog, setLotsDialog] = useState(null);
  const { user } = useAuth();
  const managerStore = user?.store || user?.store_name || 'Braga Centro';

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.entities.Stock.list('-created_date', 500),
  });

  const rawLocalLots = useMemo(() => stock.filter((s) => s.store === managerStore), [stock, managerStore]);
  const localLots = useMemo(() => mergeStockLots(rawLocalLots), [rawLocalLots]);

  const productsStock = useMemo(() => {
    const grouped = new Map();

    for (const lot of localLots) {
      const key = lot.product_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          product_id: lot.product_id,
          product_name: lot.product_name,
          barcode: lot.barcode,
          category: lot.category,
          minimum_threshold: Number(lot.minimum_threshold || 10),
          activeLots: [],
          inactiveLots: [],
          total_quantity: 0,
          earliest_expiry: null,
        });
      }

      const product = grouped.get(key);
      product.minimum_threshold = Math.max(product.minimum_threshold, Number(lot.minimum_threshold || 10));

      if (Number(lot.quantity || 0) > 0) {
        product.activeLots.push(lot);
        product.total_quantity += Number(lot.quantity || 0);
        if (lot.expiry_date && (!product.earliest_expiry || lot.expiry_date < product.earliest_expiry)) {
          product.earliest_expiry = lot.expiry_date;
        }
      } else {
        product.inactiveLots.push(lot);
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [localLots]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return productsStock.filter((product) => {
      if (!search) return true;
      return (
        product.product_name?.toLowerCase().includes(needle) ||
        product.barcode?.includes(search) ||
        product.activeLots.some((lot) => lot.serial_number?.toLowerCase().includes(needle)) ||
        product.inactiveLots.some((lot) => lot.serial_number?.toLowerCase().includes(needle))
      );
    });
  }, [productsStock, search]);

  const lowStock = filtered.filter((product) => product.total_quantity <= product.minimum_threshold);
  const expiringSoon = filtered.filter((product) => {
    const days = daysUntil(product.earliest_expiry);
    return days !== null && days <= 7 && days >= 0;
  });
  const expiredProducts = filtered.filter((product) => product.activeLots.some((lot) => isExpired(lot.expiry_date)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Stock</h1>
        <p className="text-muted-foreground text-sm">
          {productsStock.length} produtos · {localLots.length} lotes · {managerStore}
        </p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar produto, barcode ou lote..." className="pl-10" />
        </div>
      </div>

      {(lowStock.length > 0 || expiringSoon.length > 0 || expiredProducts.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {lowStock.length > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Stock Baixo ({lowStock.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowStock.slice(0, 5).map((product) => (
                  <div key={product.product_id} className="flex items-center justify-between text-sm">
                    <span>{product.product_name}</span>
                    <Badge variant="destructive">{product.total_quantity} un.</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {expiringSoon.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-yellow-700">
                  <AlertTriangle className="h-4 w-4" />
                  Validade Próxima ({expiringSoon.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiringSoon.slice(0, 5).map((product) => (
                  <div key={product.product_id} className="flex items-center justify-between text-sm">
                    <span>{product.product_name}</span>
                    <Badge className="bg-yellow-100 text-yellow-800">{product.earliest_expiry}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {expiredProducts.length > 0 && (
            <Card className="border-yellow-300 bg-yellow-50/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  Lotes Fora da Validade ({expiredProducts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiredProducts.slice(0, 5).map((product) => {
                  const expiredCount = product.activeLots.filter((lot) => isExpired(lot.expiry_date)).length;
                  return (
                    <div key={product.product_id} className="flex items-center justify-between text-sm">
                      <span>{product.product_name}</span>
                      <Badge className="bg-yellow-100 text-yellow-800">{expiredCount} lote(s)</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Barcode</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Quantidade</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Mínimo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Validade mais próxima</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Lotes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((product) => {
                const isLow = product.total_quantity <= product.minimum_threshold;
                return (
                  <tr key={product.product_id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">{product.product_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{product.barcode || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">{product.total_quantity}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">{product.minimum_threshold}</td>
                    <td className="px-4 py-3 text-sm">{product.earliest_expiry || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isLow ? 'destructive' : 'secondary'} className="text-xs">
                        {isLow ? 'Baixo' : 'OK'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          setLotsDialog({
                            productId: product.product_id,
                            productName: product.product_name,
                            storeName: managerStore,
                          })
                        }
                      >
                        <Boxes className="mr-2 h-4 w-4" />
                        Ver lotes
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum registo de stock encontrado</div>
          )}
        </CardContent>
      </Card>

      <ProductLotsDialog
        open={Boolean(lotsDialog)}
        onOpenChange={(open) => !open && setLotsDialog(null)}
        productId={lotsDialog?.productId}
        productName={lotsDialog?.productName}
        storeName={lotsDialog?.storeName}
        allowTerminateLot
      />
    </div>
  );
}
