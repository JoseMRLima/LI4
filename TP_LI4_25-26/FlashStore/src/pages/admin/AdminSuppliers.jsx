import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Truck } from 'lucide-react';
import { api } from '@/api/apiClient';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const emptySupplier = { name: '', contact: '', email: '', nif: '', address: '' };

export default function AdminSuppliers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: () => api.entities.Supplier.list('-created_date', 200),
  });

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;

    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contact, supplier.email, supplier.nif, supplier.address]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [suppliers, search]);

  const saveSupplierMutation = useMutation({
    mutationFn: (payload) => editingSupplier
      ? api.entities.Supplier.update(editingSupplier.id, payload)
      : api.entities.Supplier.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });
      setSupplierDialogOpen(false);
      setEditingSupplier(null);
      setSupplierForm(emptySupplier);
    },
    onError: (error) => toast({ title: 'Erro ao guardar fornecedor', description: error.message, variant: 'destructive' }),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (supplier) => api.entities.Supplier.delete(supplier.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] }),
    onError: (error) => toast({ title: 'Erro ao apagar fornecedor', description: error.message, variant: 'destructive' }),
  });

  const openSupplierDialog = (supplier = null) => {
    setEditingSupplier(supplier);
    setSupplierForm(supplier
      ? {
          name: supplier.name || '',
          contact: supplier.contact || '',
          email: supplier.email || '',
          nif: supplier.nif || '',
          address: supplier.address || '',
        }
      : emptySupplier);
    setSupplierDialogOpen(true);
  };

  const stats = {
    total: suppliers.length,
    withEmail: suppliers.filter((supplier) => supplier.email).length,
    withContact: suppliers.filter((supplier) => supplier.contact).length,
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Fornecedores"
        subtitle="Gestão da base de fornecedores da cadeia: contactos, NIF e moradas."
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        searchValue={search}
        onSearchChange={(event) => setSearch(event.target.value)}
        searchPlaceholder="Pesquisar fornecedor, NIF, email, contacto..."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BackofficeStatCard title="Fornecedores" value={stats.total} subtitle="Parceiros registados" icon={Truck} accent="amber" />
        <BackofficeStatCard title="Com email" value={stats.withEmail} subtitle="Contacto comercial disponível" icon={Truck} accent="blue" />
        <BackofficeStatCard title="Com telefone" value={stats.withContact} subtitle="Linha direta registada" icon={Truck} accent="emerald" />
      </div>

      <DashboardSection
        title="Base de fornecedores"
        subtitle="Editar dados mestres dos fornecedores da cadeia."
        action={<Button onClick={() => openSupplierDialog()} className="gap-2">Novo fornecedor</Button>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{supplier.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">NIF {supplier.nif}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openSupplierDialog(supplier)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => deleteSupplierMutation.mutate(supplier)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>{supplier.contact || 'Sem contacto'}</p>
                <p>{supplier.email || 'Sem email'}</p>
                <p>{supplier.address || 'Sem morada'}</p>
              </div>
            </div>
          ))}
        </div>
        {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">A carregar fornecedores...</div>}
        {!isLoading && filteredSuppliers.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado.</div>}
      </DashboardSection>

      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} className="mt-1" /></div>
            <div><Label>NIF *</Label><Input value={supplierForm.nif} onChange={(event) => setSupplierForm({ ...supplierForm, nif: event.target.value })} className="mt-1" /></div>
            <div><Label>Contacto</Label><Input value={supplierForm.contact} onChange={(event) => setSupplierForm({ ...supplierForm, contact: event.target.value })} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} className="mt-1" /></div>
            <div><Label>Morada</Label><Input value={supplierForm.address} onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveSupplierMutation.mutate(supplierForm)} disabled={!supplierForm.name || !supplierForm.nif}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
