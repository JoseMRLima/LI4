import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2, Tag } from 'lucide-react';
import { api } from '@/api/apiClient';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import StatusBadge from '@/components/backoffice/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { CATEGORIES, STORES } from '@/lib/constants';
import { formatApiError } from '@/api/localClient';

const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

const emptyForm = {
  name: '',
  type: 'percentage',
  value: 10,
  applies_to: 'category',
  target_id: '',
  target_name: 'Bebidas',
  start_date: today,
  end_date: nextMonth,
  is_active: true,
  scope_kind: 'all',
  applies_to_stores: [],
};

export default function AdminPromotions() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: () => api.entities.Promotion.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-promotion-products'],
    queryFn: () => api.entities.Product.list(),
  });

  const { data: categoryRows = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.entities.Category.list(),
  });

  const categoryNames = useMemo(() => {
    if (categoryRows.length > 0) return categoryRows.map((c) => c.name);
    return CATEGORIES;
  }, [categoryRows]);

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const selectedProduct = payload.applies_to === 'product'
        ? products.find((product) => product.id === payload.target_id)
        : null;
      // Quando o alvo é uma loja, a própria loja é o scope — não há checkboxes separados
      const stores = payload.applies_to === 'store'
        ? [payload.target_name]
        : payload.applies_to === 'chain'
          ? null
          : payload.scope_kind === 'all'
            ? null
            : (Array.isArray(payload.applies_to_stores) && payload.applies_to_stores.length > 0
                ? payload.applies_to_stores
                : null);
      const data = {
        ...payload,
        value: Number(payload.value),
        target_id: payload.applies_to === 'product' ? selectedProduct?.id || payload.target_id : null,
        target_name: payload.applies_to === 'product'
          ? selectedProduct?.name || payload.target_name
          : payload.applies_to === 'chain'
            ? 'Toda a cadeia'
            : payload.target_name,
        is_active: Boolean(payload.is_active),
        applies_to_stores: stores,
      };
      delete data.scope_kind;
      return editing ? api.entities.Promotion.update(editing.id, data) : api.entities.Promotion.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: 'Promoção guardada' });
    },
    onError: (error) => {
      toast({ title: 'Não foi possível guardar', description: formatApiError(error), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (promotion) => api.entities.Promotion.delete(promotion.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setDeleteTarget(null);
      toast({ title: 'Promoção apagada' });
    },
    onError: (error) => {
      toast({ title: 'Não foi possível apagar', description: formatApiError(error), variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (promotion) => api.entities.Promotion.update(promotion.id, { is_active: !Boolean(promotion.is_active) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promotions'] }),
    onError: (error) => {
      toast({ title: 'Não foi possível alterar', description: formatApiError(error), variant: 'destructive' });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (promotion) => {
    setEditing(promotion);
    let storesList = promotion.applies_to_stores_list;
    if (!Array.isArray(storesList) && promotion.applies_to_stores) {
      try { storesList = JSON.parse(promotion.applies_to_stores); }
      catch { storesList = null; }
    }
    setForm({
      name: promotion.name || '',
      type: promotion.type || 'percentage',
      value: promotion.value || 0,
      applies_to: promotion.applies_to || 'category',
      target_id: promotion.target_id || '',
      target_name: promotion.target_name || 'Bebidas',
      start_date: promotion.start_date || today,
      end_date: promotion.end_date || nextMonth,
      is_active: Boolean(promotion.is_active),
      scope_kind: Array.isArray(storesList) && storesList.length > 0 ? 'specific' : 'all',
      applies_to_stores: Array.isArray(storesList) ? storesList : [],
    });
    setOpen(true);
  };

  const toggleStoreInScope = (store) => {
    setForm((prev) => {
      const set = new Set(prev.applies_to_stores || []);
      if (set.has(store)) set.delete(store);
      else set.add(store);
      return { ...prev, applies_to_stores: Array.from(set) };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  const targetOptions =
    form.applies_to === 'store'
      ? STORES
      : form.applies_to === 'product'
        ? products
        : categoryNames;

  const handleAppliesToChange = (applies_to) => {
    if (applies_to === 'chain') {
      setForm({ ...form, applies_to, target_id: '', target_name: 'Toda a cadeia' });
      return;
    }

    if (applies_to === 'store') {
      setForm({ ...form, applies_to, target_id: '', target_name: STORES[0] });
      return;
    }

    if (applies_to === 'product') {
      setForm({
        ...form,
        applies_to,
        target_id: products[0]?.id || '',
        target_name: products[0]?.name || '',
      });
      return;
    }

    setForm({ ...form, applies_to, target_id: '', target_name: categoryNames[0] || CATEGORIES[0] });
  };

  const handleTargetChange = (value) => {
    if (form.applies_to === 'product') {
      const selectedProduct = products.find((product) => product.id === value);
      setForm({
        ...form,
        target_id: value,
        target_name: selectedProduct?.name || '',
      });
      return;
    }

    setForm({ ...form, target_name: value });
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Promoções globais"
        subtitle="Criar, editar, ativar e remover campanhas comerciais da cadeia."
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BackofficeStatCard title="Promoções" value={promotions.length} subtitle="Campanhas registadas" icon={Tag} accent="orange" />
        <BackofficeStatCard title="Ativas" value={promotions.filter((item) => item.is_active).length} subtitle="Em vigor ou agendadas" icon={Tag} accent="emerald" />
        <BackofficeStatCard title="Inativas" value={promotions.filter((item) => !item.is_active).length} subtitle="Pausadas" icon={Tag} accent="slate" />
      </div>

      <DashboardSection
        title="Campanhas"
        subtitle="Dados persistidos no backend local."
        action={<Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Nova promoção</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="py-3 pr-4 font-semibold">Nome</th>
                <th className="py-3 pr-4 font-semibold">Tipo</th>
                <th className="py-3 pr-4 font-semibold">Alvo</th>
                <th className="py-3 pr-4 font-semibold">Período</th>
                <th className="py-3 pr-4 font-semibold">Estado</th>
                <th className="py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promotion) => (
                <tr key={promotion.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{promotion.name}</td>
                  <td className="py-3 pr-4">{promotion.type === 'percentage' ? `${promotion.value}%` : `${promotion.value}€`}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {promotion.applies_to === 'product' ? 'produto' : promotion.applies_to} · {promotion.target_name || 'Todas'}
                    {Array.isArray(promotion.applies_to_stores_list) && promotion.applies_to_stores_list.length > 0 && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5">Lojas: {promotion.applies_to_stores_list.join(', ')}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">{promotion.start_date} a {promotion.end_date}</td>
                  <td className="py-3 pr-4"><StatusBadge tone={promotion.is_active ? 'success' : 'neutral'}>{promotion.is_active ? 'Ativa' : 'Inativa'}</StatusBadge></td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(promotion)} className="gap-2"><Edit2 className="h-3.5 w-3.5" /> Editar</Button>
                      <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate(promotion)}>{promotion.is_active ? 'Pausar' : 'Ativar'}</Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(promotion)} className="gap-2 text-red-600"><Trash2 className="h-3.5 w-3.5" /> Apagar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">A carregar promoções...</div>}
          {!isLoading && promotions.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Ainda não existem promoções. Cria a primeira campanha.</div>}
        </div>
      </DashboardSection>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar promoção' : 'Nova promoção'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentagem</SelectItem>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Valor</Label>
                <Input id="value" type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Aplica a</Label>
                <Select value={form.applies_to} onValueChange={handleAppliesToChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Categoria</SelectItem>
                    <SelectItem value="product">Produto específico</SelectItem>
                    <SelectItem value="store">Loja específica</SelectItem>
                    <SelectItem value="chain">Toda a cadeia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.applies_to !== 'chain' && (
                <div className="space-y-2">
                  <Label>
                    {form.applies_to === 'store' ? 'Loja' : form.applies_to === 'product' ? 'Produto' : 'Categoria'}
                  </Label>
                  <Select value={form.applies_to === 'product' ? form.target_id : form.target_name} onValueChange={handleTargetChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {form.applies_to === 'product'
                        ? targetOptions.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)
                        : targetOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="start_date">Início</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Fim</Label>
                <Input id="end_date" type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} required />
              </div>
            </div>

            {(form.applies_to === 'category' || form.applies_to === 'product') && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-col gap-1">
                  <Label>
                    {form.applies_to === 'product' ? 'Em que lojas se aplica este desconto?' : 'Lojas abrangidas'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {form.applies_to === 'product'
                      ? 'Podes restringir o desconto a lojas específicas ou aplicar a toda a cadeia.'
                      : '"Todas as lojas" abrange a cadeia inteira; pode escolher lojas específicas para campanhas locais.'}
                  </p>
                </div>
                <Select value={form.scope_kind} onValueChange={(scope_kind) => setForm({ ...form, scope_kind, applies_to_stores: scope_kind === 'all' ? [] : form.applies_to_stores })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    <SelectItem value="specific">Apenas lojas específicas</SelectItem>
                  </SelectContent>
                </Select>
                {form.scope_kind === 'specific' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {STORES.map((store) => {
                      const checked = (form.applies_to_stores || []).includes(store);
                      return (
                        <label key={store} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleStoreInScope(store)}
                          />
                          <span>{store}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {form.scope_kind === 'specific' && (form.applies_to_stores || []).length === 0 && (
                  <p className="text-xs text-amber-600">Seleciona pelo menos uma loja, caso contrário o desconto não ficará associado a nenhuma loja.</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'A guardar...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais remover definitivamente a campanha
              {deleteTarget?.name ? ` "${deleteTarget.name}"` : ''}.
              Esta ação não pode ser revertida e fica registada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? 'A apagar...' : 'Apagar promoção'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
