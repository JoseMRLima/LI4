import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatApiError } from '@/api/apiClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORIES } from '@/lib/constants';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

function boolish(v) {
  return v === true || v === 1 || v === '1';
}

export default function ProductForm({ product, onSave, onCancel, compact = false }) {
  const { data: apiCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.entities.Category.list(),
  });

  const categoryOptions = useMemo(() => {
    if (apiCategories.length > 0) return apiCategories.map((c) => c.name);
    return CATEGORIES;
  }, [apiCategories]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const all = await api.entities.Supplier.list();
      return all.filter((s) => Boolean(s.is_active));
    },
  });

  const [form, setForm] = useState({
    name: product?.name || '',
    barcode: product?.barcode || '',
    price: product?.price ?? '',
    category: product?.category || '',
    iva_rate: product?.iva_rate ?? 23,
    is_perishable: boolish(product?.is_perishable),
    default_shelf_life_days: product?.default_shelf_life_days ?? '',
    is_active: product ? boolish(product?.is_active) : true,
    image_url: product?.image_url || '',
    supplier_id: product?.supplier_id || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) {
      toast({ title: 'Categoria obrigatória', description: 'Escolha uma categoria.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const supplierId = form.supplier_id || null;
      const supplier = supplierId ? suppliers.find((s) => s.id === supplierId) : null;
      const data = {
        name: form.name,
        barcode: form.barcode || null,
        price: parseFloat(form.price),
        category: form.category,
        iva_rate: parseFloat(form.iva_rate),
        is_perishable: form.is_perishable,
        is_active: form.is_active,
        image_url: form.image_url || null,
        default_shelf_life_days: form.is_perishable && form.default_shelf_life_days ? parseInt(form.default_shelf_life_days, 10) : null,
        supplier_id: supplierId,
        supplier_name: supplier?.name || null,
      };
      if (product) {
        await api.entities.Product.update(product.id, data);
      } else {
        await api.entities.Product.create(data);
      }
      setSaving(false);
      onSave();
    } catch (err) {
      setSaving(false);
      toast({
        title: 'Não foi possível guardar',
        description: formatApiError(err, 'Verifique os dados (ex.: código de barras duplicado).'),
        variant: 'destructive',
      });
    }
  };

  const formGrid = (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" />
          </div>
          <div>
            <Label>Código de Barras</Label>
            <Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="mt-1" />
          </div>
          <div>
            <Label>Preço (€) *</Label>
            <Input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required className="mt-1" />
          </div>
          <div>
            <Label>Categoria *</Label>
            <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>IVA (%)</Label>
            <Select value={String(form.iva_rate)} onValueChange={v => setForm({...form, iva_rate: v})}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6%</SelectItem>
                <SelectItem value="13">13%</SelectItem>
                <SelectItem value="23">23%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>URL da Imagem</Label>
            <Input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label>Fornecedor</Label>
            <Select
              value={form.supplier_id || 'none'}
              onValueChange={(v) => setForm({ ...form, supplier_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Opcional — associar fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.is_perishable && (
            <div>
              <Label>Validade padrão (dias)</Label>
              <Input
                type="number"
                min="1"
                value={form.default_shelf_life_days}
                onChange={e => setForm({...form, default_shelf_life_days: e.target.value})}
                className="mt-1"
                placeholder="Ex: 7"
              />
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_perishable} onCheckedChange={v => setForm({...form, is_perishable: v})} />
              <Label>Perecível</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
              <Label>Ativo</Label>
            </div>
          </div>
          <div className="md:col-span-2 flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </form>
  );

  if (compact) {
    return <div className="pt-1">{formGrid}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
      </CardHeader>
      <CardContent>{formGrid}</CardContent>
    </Card>
  );
}
