import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Power, Store as StoreIcon, Trash2 } from 'lucide-react';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import StatusBadge from '@/components/backoffice/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { api, formatApiError } from '@/api/localClient';

const emptyForm = { id: null, code: '', name: '', city: '', address: '', manager_user_id: '', status: 'active' };

export default function AdminStores() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.entities.Store.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.entities.User.list(),
  });

  const managers = users.filter((u) => u.role === 'manager' || u.role === 'admin');

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        return api.entities.Store.update(payload.id, payload);
      }
      return api.entities.Store.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success('Loja guardada com sucesso.');
    },
    onError: (err) => toast.error(formatApiError(err, 'Erro ao guardar loja.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Store.delete(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setConfirmDelete(null);
      toast.success(response?.deactivated ? 'Loja desativada (tem atividade associada).' : 'Loja removida.');
    },
    onError: (err) => toast.error(formatApiError(err, 'Erro ao remover loja.')),
  });

  const openEdit = (store) => {
    setForm({
      id: store.id,
      code: store.code || '',
      name: store.name || '',
      city: store.city || '',
      address: store.address || '',
      manager_user_id: store.manager_user_id || '',
      status: store.status || 'active',
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    saveMutation.mutate({
      ...form,
      code: form.code || undefined,
      manager_user_id: form.manager_user_id || null,
    });
  };

  const totalActive = stores.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Lojas da cadeia"
        subtitle="Cadastro e gestão das lojas físicas FlashStore"
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        showSearch={false}
        actions={(
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova loja
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BackofficeStatCard title="Lojas registadas" value={stores.length} subtitle="Total na cadeia" icon={StoreIcon} accent="blue" />
        <BackofficeStatCard title="Lojas ativas" value={totalActive} subtitle="A operar atualmente" icon={Power} accent="emerald" />
        <BackofficeStatCard title="Inativas" value={stores.length - totalActive} subtitle="Suspensas / arquivadas" icon={Power} accent="amber" />
      </div>

      <DashboardSection title="Lojas" subtitle="Lista global de unidades">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">A carregar...</div>
        ) : stores.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sem lojas registadas. Crie a primeira.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Loja</th>
                  <th className="py-3 pr-4 font-semibold">Código</th>
                  <th className="py-3 pr-4 font-semibold">Cidade</th>
                  <th className="py-3 pr-4 font-semibold">Gerente</th>
                  <th className="py-3 pr-4 font-semibold">Estado</th>
                  <th className="py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{store.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{store.code || '—'}</td>
                    <td className="py-3 pr-4">{store.city || '—'}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {store.manager_name || '—'}
                      {store.manager_email ? <p className="text-xs">{store.manager_email}</p> : null}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge tone={store.status === 'active' ? 'success' : 'warning'}>
                        {store.status === 'active' ? 'Ativa' : 'Inativa'}
                      </StatusBadge>
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(store)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDelete(store)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar loja' : 'Nova loja'}</DialogTitle>
            <DialogDescription>
              Os campos cidade, morada e gerente são opcionais e podem ser preenchidos depois.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Auto-gerado se vazio" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Estado</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Morada</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <Label>Gerente</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.manager_user_id}
                onChange={(e) => setForm((f) => ({ ...f, manager_user_id: e.target.value }))}
              >
                <option value="">— Sem gerente atribuído —</option>
                {managers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} · {u.email}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'A guardar...' : (form.id ? 'Guardar alterações' : 'Criar loja')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover loja {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se esta loja já tiver vendas, stock ou utilizadores, será desativada em vez de apagada para preservar histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
