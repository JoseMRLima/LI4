import React, { useMemo, useState } from 'react';
import { api } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { toast } from '@/components/ui/use-toast';

const emptyItem = { product_id: '', product_name: '', quantity: 1 };
const urgencyMeta = {
  low: { label: 'Baixa', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'info' },
  high: { label: 'Alta', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'critical' },
};

export default function Orders() {
  const { user } = useAuth();
  const managerStore = user?.store || user?.store_name || 'Braga Centro';
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receivingItems, setReceivingItems] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', supplier_name: '', notes: '', urgency: 'normal', items: [emptyItem] });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.entities.SupplierOrder.list('-created_date', 200),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.entities.Supplier.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['order-products'],
    queryFn: () => api.entities.Product.list('-created_date', 500),
  });

  const localOrders = orders.filter((order) => order.store === managerStore);
  const availableProducts = useMemo(() => {
    if (!form.supplier_name) return [];
    return products.filter((product) => !product.supplier_name || product.supplier_name === form.supplier_name);
  }, [form.supplier_name, products]);

  const saveMutation = useMutation({
    mutationFn: (data) => api.entities.SupplierOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowForm(false);
      setForm({ supplier_id: '', supplier_name: '', notes: '', urgency: 'normal', items: [emptyItem] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar encomenda',
        description: error.message || 'Não foi possível guardar a encomenda.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.SupplierOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar encomenda',
        description: error.message || 'Não foi possível atualizar a encomenda.',
        variant: 'destructive',
      });
    },
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    pending: 'Em aprovação',
    sent: 'Aprovada',
    received: 'Recebida',
    cancelled: 'Rejeitada',
  };

  const setItemField = (index, field, value) => {
    setForm((current) => {
      const nextItems = [...current.items];
      const currentItem = { ...nextItems[index] };

      if (field === 'product_id') {
        const product = availableProducts.find((entry) => entry.id === value);
        currentItem.product_id = value;
        currentItem.product_name = product?.name || '';
      } else {
        currentItem[field] = value;
      }

      nextItems[index] = currentItem;
      return { ...current, items: nextItems };
    });
  };

  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, emptyItem] }));
  };

  const removeItem = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? [emptyItem] : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const setSupplier = (supplierName) => {
    const supplier = suppliers.find((entry) => entry.name === supplierName);
    setForm((current) => ({
      ...current,
      supplier_id: supplier?.id || '',
      supplier_name: supplierName,
      items: [emptyItem],
    }));
  };

  const openForm = () => {
    setForm({ supplier_id: '', supplier_name: '', notes: '', urgency: 'normal', items: [emptyItem] });
    setShowForm(true);
  };

  const openReceivingDialog = (order) => {
    setReceivingOrder(order);
    setReceivingItems(
      (order.items || []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        serial_number: item.serial_number || '',
        expiry_date: item.expiry_date || '',
      }))
    );
  };

  const setReceivingField = (index, field, value) => {
    setReceivingItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const confirmReceiving = () => {
    const hasInvalidLine = receivingItems.some((item) => {
      const product = products.find((entry) => entry.id === item.product_id);
      const requiresExpiry = product?.category !== 'Outros';
      return !item.serial_number || (requiresExpiry && !item.expiry_date);
    });

    if (hasInvalidLine) {
      toast({
        title: 'Dados em falta',
        description: 'Cada linha precisa de série/lote e data de validade quando aplicável.',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate(
      {
        id: receivingOrder.id,
        data: {
          status: 'received',
          items: receivingItems.map((item) => ({
            id: item.id,
            serial_number: item.serial_number,
            expiry_date: item.expiry_date || null,
          })),
        },
      },
      {
        onSuccess: () => {
          setReceivingOrder(null);
          setReceivingItems([]);
        },
      }
    );
  };

  const createOrder = () => {
    const cleanedItems = form.items
      .filter((item) => item.product_id && Number(item.quantity) > 0)
      .map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit_cost: 0,
      }));

    if (!form.supplier_name) {
      toast({ title: 'Fornecedor em falta', description: 'Seleciona um fornecedor.', variant: 'destructive' });
      return;
    }

    if (cleanedItems.length === 0) {
      toast({ title: 'Produtos em falta', description: 'Adiciona pelo menos um produto à encomenda.', variant: 'destructive' });
      return;
    }

    saveMutation.mutate({
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name,
      store: managerStore,
      notes: form.notes,
      urgency: form.urgency,
      status: 'pending',
      total: 0,
      items: cleanedItems,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encomendas</h1>
          <p className="text-muted-foreground text-sm">{localOrders.length} encomendas · {managerStore}</p>
        </div>
        <Button onClick={openForm} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nova Encomenda
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Fornecedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Itens</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Urgência</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {localOrders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">{order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy') : '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium">{order.supplier_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.items?.length || 0} linhas</td>
                  <td className="px-4 py-3">
                    <Badge className="text-xs">{urgencyMeta[order.urgency || 'normal']?.label || 'Normal'}</Badge>
                  </td>
                  <td className="px-4 py-3"><Badge className={`text-xs ${statusColors[order.status]}`}>{statusLabels[order.status]}</Badge></td>
                  <td className="px-4 py-3">
                    {order.status === 'pending' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: order.id, data: { status: 'cancelled' } })}>Cancelar pedido</Button>
                    )}
                    {order.status === 'sent' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openReceivingDialog(order)}>Registar Entrega</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {localOrders.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma encomenda</div>}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nova Encomenda para {managerStore}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Fornecedor</Label>
                <Select value={form.supplier_name} onValueChange={setSupplier}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.name}>{supplier.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loja de Destino</Label>
                <Input value={managerStore} disabled className="mt-1" />
              </div>
              <div>
                <Label>Urgência</Label>
                <Select value={form.urgency} onValueChange={(value) => setForm((current) => ({ ...current, urgency: value }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Linhas da encomenda</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar linha
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,2fr)_120px_120px_40px]">
                    <div>
                      <Label>Produto</Label>
                      <Select value={item.product_id} onValueChange={(value) => setItemField(index, 'product_id', value)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
                        <SelectContent>
                          {availableProducts.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!form.supplier_name && <p className="mt-1 text-xs text-muted-foreground">Seleciona primeiro o fornecedor.</p>}
                      {form.supplier_name && availableProducts.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Este fornecedor não tem produtos associados.</p>}
                    </div>

                    <div>
                      <Label>Qtd.</Label>
                      <Input className="mt-1" type="number" min="1" value={item.quantity} onChange={(event) => setItemField(index, 'quantity', event.target.value)} />
                    </div>

                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1" placeholder="Observações para o fornecedor ou para a receção em loja..." />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Resumo do pedido</p>
                <p className="text-xs text-muted-foreground">{form.items.filter((item) => item.product_id).length} produtos selecionados · preços definidos depois da aprovação</p>
              </div>
              <p className="text-lg font-bold">{form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} un.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={createOrder} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'A guardar...' : 'Criar Encomenda'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(receivingOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setReceivingOrder(null);
            setReceivingItems([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Receber encomenda {receivingOrder?.supplier_name ? `· ${receivingOrder.supplier_name}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {receivingItems.map((item, index) => {
              const product = products.find((entry) => entry.id === item.product_id);
              const requiresExpiry = product?.category !== 'Outros';
              return (
                <div key={item.id || index} className="grid grid-cols-1 gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,2fr)_100px_180px_180px]">
                  <div>
                    <Label>Produto</Label>
                    <Input className="mt-1" value={item.product_name} disabled />
                  </div>
                  <div>
                    <Label>Qtd.</Label>
                    <Input className="mt-1" value={item.quantity} disabled />
                  </div>
                  <div>
                    <Label>Série / Lote</Label>
                    <Input
                      className="mt-1"
                      value={item.serial_number}
                      onChange={(event) => setReceivingField(index, 'serial_number', event.target.value)}
                      placeholder="Ex: LOT-2026-001"
                    />
                  </div>
                  <div>
                    <Label>Validade {requiresExpiry ? '*' : ''}</Label>
                    <Input
                      className="mt-1"
                      type="date"
                      value={item.expiry_date || ''}
                      onChange={(event) => setReceivingField(index, 'expiry_date', event.target.value)}
                      disabled={!requiresExpiry}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivingOrder(null)}>Cancelar</Button>
            <Button onClick={confirmReceiving} disabled={updateMutation.isPending}>{updateMutation.isPending ? 'A processar...' : 'Confirmar Entrega'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
