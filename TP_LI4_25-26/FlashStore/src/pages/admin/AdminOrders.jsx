import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, PackageCheck, ShieldCheck } from 'lucide-react';
import { api } from '@/api/apiClient';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import StatusBadge from '@/components/backoffice/StatusBadge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from '@/components/ui/use-toast';

const statusMeta = {
  pending: { label: 'Pendente aprovação', tone: 'warning' },
  sent: { label: 'Aprovada', tone: 'info' },
  received: { label: 'Entregue', tone: 'success' },
  cancelled: { label: 'Rejeitada', tone: 'critical' },
};

const urgencyMeta = {
  urgent: { label: 'Urgente', tone: 'critical', weight: 4 },
  high: { label: 'Alta', tone: 'warning', weight: 3 },
  normal: { label: 'Normal', tone: 'info', weight: 2 },
  low: { label: 'Baixa', tone: 'neutral', weight: 1 },
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-supplier-orders'],
    queryFn: () => api.entities.SupplierOrder.list('-created_date', 200),
  });

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const ordered = [...orders].sort((a, b) => {
      const urgencyDiff = (urgencyMeta[b.urgency || 'normal']?.weight || 0) - (urgencyMeta[a.urgency || 'normal']?.weight || 0);
      if (urgencyDiff !== 0) return urgencyDiff;
      return String(b.created_date || '').localeCompare(String(a.created_date || ''));
    });

    if (!query) return ordered;
    return ordered.filter((order) =>
      [
        order.supplier_name,
        order.store,
        order.notes,
        ...(order.items || []).flatMap((item) => [item.product_name, item.serial_number, item.expiry_date]),
        statusMeta[order.status]?.label,
        urgencyMeta[order.urgency || 'normal']?.label,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [orders, search]);

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ order, status }) => api.entities.SupplierOrder.update(order.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-supplier-orders'] }),
    onError: (error) => toast({ title: 'Erro ao atualizar pedido', description: error.message, variant: 'destructive' }),
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    urgent: orders.filter((order) => order.status === 'pending' && ['urgent', 'high'].includes(order.urgency || 'normal')).length,
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Encomendas"
        subtitle="Pedidos criados pelos gerentes, organizados por urgência para decisão do Admin."
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        searchValue={search}
        onSearchChange={(event) => setSearch(event.target.value)}
        searchPlaceholder="Pesquisar loja, fornecedor, urgência, estado..."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BackofficeStatCard title="Pedidos" value={stats.total} subtitle="Registados no sistema" icon={ClipboardList} accent="blue" />
        <BackofficeStatCard title="Pendentes" value={stats.pending} subtitle="À espera de aprovação" icon={ShieldCheck} accent="amber" />
        <BackofficeStatCard title="Prioritários" value={stats.urgent} subtitle="Alta e urgente" icon={AlertTriangle} accent="red" />
      </div>

      <DashboardSection title="Pedidos das lojas" subtitle="Aprovar, rejeitar e acompanhar a entrega e atualização de stock">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="py-3 pr-4 font-semibold">Data</th>
                <th className="py-3 pr-4 font-semibold">Loja</th>
                <th className="py-3 pr-4 font-semibold">Fornecedor</th>
                <th className="py-3 pr-4 font-semibold">Linhas</th>
                <th className="py-3 pr-4 font-semibold">Urgência</th>
                <th className="py-3 pr-4 font-semibold">Estado</th>
                <th className="py-3 pr-4 font-semibold">Notas</th>
                <th className="py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">{order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy') : '—'}</td>
                  <td className="py-3 pr-4 font-medium">{order.store}</td>
                  <td className="py-3 pr-4">{order.supplier_name}</td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <div className="font-medium">{order.items?.length || 0} linhas</div>
                      {(order.items || []).slice(0, 2).map((item) => (
                        <div key={item.id} className="text-xs text-muted-foreground">
                          {item.quantity}x {item.product_name}
                          {item.serial_number ? ` · lote ${item.serial_number}` : ''}
                          {item.expiry_date ? ` · val. ${format(new Date(item.expiry_date), 'dd/MM/yyyy')}` : ''}
                        </div>
                      ))}
                      {(order.items?.length || 0) > 2 && (
                        <div className="text-xs text-muted-foreground">+{order.items.length - 2} linhas</div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={urgencyMeta[order.urgency || 'normal']?.tone || 'neutral'}>
                      {urgencyMeta[order.urgency || 'normal']?.label || 'Normal'}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={statusMeta[order.status]?.tone || 'neutral'}>
                      {statusMeta[order.status]?.label || order.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{order.notes || '—'}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      {order.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateOrderStatusMutation.mutate({ order, status: 'sent' })}>Aprovar</Button>
                          <Button size="sm" variant="outline" onClick={() => updateOrderStatusMutation.mutate({ order, status: 'cancelled' })}>Rejeitar</Button>
                        </>
                      )}
                      {order.status === 'sent' && <span className="text-xs text-muted-foreground">A aguardar entrega em loja</span>}
                      {order.status === 'received' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <PackageCheck className="h-3.5 w-3.5" />
                          Stock atualizado
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">A carregar encomendas...</div>}
        {!isLoading && filteredOrders.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma encomenda encontrada.</div>}
      </DashboardSection>
    </div>
  );
}
