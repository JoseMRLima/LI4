import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
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
import { STORES } from '@/lib/constants';
import { getRolePermissions, permissionModules, roleLabels } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { formatApiError } from '@/api/localClient';

const emptyForm = {
  full_name: '',
  email: '',
  role: 'cashier',
  store: '',
  password: '123456',
  is_active: true,
};

const permissionLabels = Object.fromEntries(permissionModules.map((module) => [module.key, module.label]));

export default function AdminUsers() {
  const { user, checkAppState } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [suspendTarget, setSuspendTarget] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.entities.User.list(),
  });

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
    activeAdmins: users.filter((user) => user.role === 'admin' && Boolean(user.is_active)).length,
    active: users.filter((user) => Boolean(user.is_active)).length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((candidate) =>
      [
        candidate.full_name,
        candidate.email,
        roleLabels[candidate.role] || candidate.role,
        candidate.store || 'Sede',
        candidate.is_active ? 'ativo' : 'suspenso',
      ].some((value) => String(value).toLowerCase().includes(query))
    );
  }, [users, search]);

  const isLastActiveAdmin = (candidate) =>
    candidate?.role === 'admin' &&
    Boolean(candidate?.is_active) &&
    users.filter((item) => item.role === 'admin' && Boolean(item.is_active)).length === 1;

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const data = {
        ...payload,
        store: payload.role === 'admin' ? 'Sede' : payload.store,
        is_active: Boolean(payload.is_active),
      };

      if (editing) {
        const { password, ...updateData } = data;
        return api.entities.User.update(editing.id, password ? data : updateData);
      }

      return api.entities.User.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (editing?.id === user?.id) {
        checkAppState();
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível guardar',
        description: formatApiError(error, 'Ocorreu um erro ao atualizar o utilizador.'),
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (user) => api.entities.User.update(user.id, { is_active: !Boolean(user.is_active) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSuspendTarget(null);
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível alterar o estado',
        description: formatApiError(error, 'Ocorreu um erro ao atualizar o utilizador.'),
        variant: 'destructive',
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'cashier',
      store: user.role === 'admin' ? 'Sede' : (user.store || ''),
      password: '',
      is_active: Boolean(user.is_active),
    });
    setOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.role !== 'admin' && !form.store) {
      toast({
        title: 'Loja em falta',
        description: 'Tens de selecionar a loja para um gerente ou caixa.',
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate(form);
  };

  const selectedRolePermissions = getRolePermissions(form.role);
  const editingIsLastActiveAdmin = editing ? isLastActiveAdmin(editing) : false;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Gestão de utilizadores"
        subtitle="Criar utilizadores, alterar roles, associar lojas e ativar ou suspender acessos. As permissões vêm predefinidas pela role."
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        searchValue={search}
        onSearchChange={(event) => setSearch(event.target.value)}
        searchPlaceholder="Pesquisar nome, email, role, loja..."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BackofficeStatCard title="Utilizadores" value={stats.total} subtitle="Contas registadas" icon={UserRoundCheck} accent="blue" />
        <BackofficeStatCard title="Admins" value={stats.admins} subtitle={`${stats.activeAdmins} ativos com acesso global`} icon={ShieldCheck} accent="red" />
        <BackofficeStatCard title="Ativos" value={stats.active} subtitle="Podem iniciar sessão" icon={UserRoundCheck} accent="emerald" />
      </div>

      <DashboardSection
        title="Utilizadores do sistema"
        subtitle="Estas alterações são enviadas para o backend local SQLite."
        action={<Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo utilizador</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="py-3 pr-4 font-semibold">Nome</th>
                <th className="py-3 pr-4 font-semibold">Email</th>
                <th className="py-3 pr-4 font-semibold">Função</th>
                <th className="py-3 pr-4 font-semibold">Loja</th>
                <th className="py-3 pr-4 font-semibold">Estado</th>
                <th className="py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{user.full_name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                  <td className="py-3 pr-4"><StatusBadge tone={user.role === 'admin' ? 'critical' : user.role === 'manager' ? 'warning' : 'info'}>{roleLabels[user.role] || user.role}</StatusBadge></td>
                  <td className="py-3 pr-4">{user.store || 'Sede'}</td>
                  <td className="py-3 pr-4"><StatusBadge tone={user.is_active ? 'success' : 'neutral'}>{user.is_active ? 'Ativo' : 'Suspenso'}</StatusBadge></td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)} className="gap-2">
                        <Edit2 className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (user.is_active) {
                            setSuspendTarget(user);
                          } else {
                            toggleActiveMutation.mutate(user);
                          }
                        }}
                        className="gap-2"
                        disabled={isLastActiveAdmin(user)}
                        title={isLastActiveAdmin(user) ? 'O último admin ativo não pode ser suspenso.' : undefined}
                      >
                        {user.is_active ? <UserRoundX className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}
                        {user.is_active ? 'Suspender' : 'Ativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">A carregar utilizadores...</div>}
          {!isLoading && filteredUsers.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum utilizador encontrado para essa pesquisa.</div>
          )}
        </div>
      </DashboardSection>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar utilizador' : 'Novo utilizador'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome</Label>
                <Input id="full_name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={form.role}
                  onValueChange={(role) => setForm({ ...form, role, store: role === 'admin' ? 'Sede' : (form.store === 'Sede' ? '' : form.store) })}
                  disabled={editingIsLastActiveAdmin}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="cashier">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Loja {form.role !== 'admin' ? '*' : ''}</Label>
                <Select value={form.store} onValueChange={(store) => setForm({ ...form, store })} disabled={form.role === 'admin'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STORES.map((store) => <SelectItem key={store} value={store}>{store}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.role === 'admin' ? (
                  <p className="text-xs text-muted-foreground">Admins ficam associados automaticamente à Sede.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Obrigatório para gerente e caixa.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{editing ? 'Nova password opcional' : 'Password inicial'}</Label>
                <Input id="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? 'Deixar vazio para manter' : '123456'} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={form.is_active ? 'active' : 'inactive'}
                  onValueChange={(value) => setForm({ ...form, is_active: value === 'active' })}
                  disabled={editingIsLastActiveAdmin}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingIsLastActiveAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Este utilizador é o último admin ativo. Não pode ser rebaixado para gerente/caixa nem suspenso.
              </div>
            )}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-semibold">Acessos predefinidos para {roleLabels[form.role]}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedRolePermissions.length > 0 ? (
                  selectedRolePermissions.map((permission) => (
                    <StatusBadge key={permission} tone={form.role === 'admin' ? 'critical' : form.role === 'manager' ? 'warning' : form.role === 'repositor' ? 'info' : 'info'}>
                      {permissionLabels[permission] || permission}
                    </StatusBadge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Sem acessos de backoffice atribuídos a este perfil. (Caixa usa o POS, não o backoffice.)</span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'A guardar...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(suspendTarget)} onOpenChange={(value) => !value && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender utilizador?</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.full_name || suspendTarget?.email} deixará de poder iniciar sessão até ser reativado. A operação fica registada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleActiveMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={toggleActiveMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (suspendTarget) toggleActiveMutation.mutate(suspendTarget);
              }}
            >
              {toggleActiveMutation.isPending ? 'A suspender...' : 'Suspender'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
