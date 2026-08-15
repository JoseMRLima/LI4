import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Banknote,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  Store,
  Tag,
  Truck,
  Users,
  Wifi,
} from 'lucide-react';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import ManagementShortcuts from '@/components/backoffice/ManagementShortcuts';
import StatusBadge from '@/components/backoffice/StatusBadge';
import SyncStatus from '@/components/backoffice/SyncStatus';
import { CategoryPieChart, StoreSalesBarChart } from '@/components/backoffice/SalesCharts';
import { api } from '@/api/apiClient';

const money = (value) =>
  `${Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const SEVERITY_TONE = {
  info: 'success',
  low: 'success',
  medium: 'warning',
  high: 'critical',
  critical: 'critical',
};

const SEVERITY_LABEL = {
  info: 'Info',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export default function AdminDashboard() {
  const today = todayISO();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-global', today],
    queryFn: () => api.dashboard.global({ date: today }),
    refetchInterval: 60_000,
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-recent'],
    queryFn: () => api.audit.list({ limit: 8 }),
    refetchInterval: 60_000,
  });

  const stores = data?.stores || [];
  const salesByStore = useMemo(
    () => (data?.salesByStore || []).map((row) => ({
      store: row.store,
      sales: Math.round(Number(row.total_sales || 0)),
      transactions: Number(row.transactions || 0),
    })),
    [data]
  );
  const stockBreaks = data?.stockBreaks || [];
  const topCategories = data?.topCategories || [];
  const pendingOrders = data?.pendingOrders || [];
  const totals = data?.totals || {};
  const auditLogs = auditData?.rows || [];
  const totalStockBreaks = stockBreaks.length;
  const shiftWorkflow = data?.shiftWorkflow || {};
  const pendingShiftList = data?.pendingShiftClosuresList || [];

  const managementShortcuts = [
    { title: 'Produtos e stock', description: 'Catálogo global, mínimos por loja e alertas', icon: Boxes, path: '/admin/products', tone: 'bg-violet-50 text-violet-600' },
    { title: 'Gestão de utilizadores', description: 'Perfis, permissões e acesso', icon: Users, path: '/admin/users', tone: 'bg-blue-50 text-blue-600' },
    { title: 'Promoções globais', description: 'Campanhas por loja e categoria', icon: Tag, path: '/admin/promotions', tone: 'bg-orange-50 text-orange-600' },
    { title: 'Encomendas', description: 'Pedidos das lojas e aprovações centrais', icon: ClipboardList, path: '/admin/orders', tone: 'bg-amber-50 text-amber-600' },
    { title: 'Fornecedores', description: 'SLA, encomendas e abastecimento', icon: Truck, path: '/admin/suppliers', tone: 'bg-amber-50 text-amber-600' },
    { title: 'Lojas', description: 'Cadastro e gestão de lojas físicas', icon: Store, path: '/admin/stores', tone: 'bg-sky-50 text-sky-600' },
    { title: 'Relatórios', description: 'Vendas, margem e operação', icon: BarChart3, path: '/admin/reports', tone: 'bg-sky-50 text-sky-600' },
    { title: 'Auditoria', description: 'Logs, SAFT e conformidade', icon: FileCheck2, path: '/admin/audit', tone: 'bg-slate-100 text-slate-700' },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Visão global da cadeia"
        subtitle="Supervisão central de vendas, stock, alertas e gestão FlashStore."
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
      />

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar dados agregados. Verifique se o servidor está disponível.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <BackofficeStatCard
          title="Vendas totais"
          value={money(totals.total_sales || 0)}
          subtitle="Todas as lojas · hoje"
          icon={BarChart3}
          accent="blue"
        />
        <BackofficeStatCard
          title="Lojas"
          value={isLoading ? '—' : stores.length}
          subtitle="Unidades ativas"
          icon={Store}
          accent="slate"
        />
        <BackofficeStatCard
          title="Transações"
          value={isLoading ? '—' : (totals.transactions || 0)}
          subtitle="Talões emitidos hoje"
          icon={Wifi}
          accent="emerald"
        />
        <BackofficeStatCard
          title="Ruturas de stock"
          value={isLoading ? '—' : totalStockBreaks}
          subtitle="Produtos abaixo do mínimo"
          icon={AlertTriangle}
          accent={totalStockBreaks > 0 ? 'red' : 'slate'}
        />
        <BackofficeStatCard
          title="Encomendas"
          value={isLoading ? '—' : pendingOrders.length}
          subtitle="Pendentes na cadeia"
          icon={ClipboardList}
          accent="amber"
        />
        <BackofficeStatCard
          title="Fechos de turno"
          value={isLoading ? '—' : shiftWorkflow.pending_shift_closures ?? 0}
          subtitle={`Pendentes de gerente · ${today} (dia operacional)`}
          icon={ClipboardCheck}
          accent={Number(shiftWorkflow.pending_shift_closures) > 0 ? 'amber' : 'slate'}
        />
        <BackofficeStatCard
          title="Sangrias"
          value={isLoading ? '—' : shiftWorkflow.pending_cash_drops ?? 0}
          subtitle={`À aprovar · turnos com data ${today}`}
          icon={Banknote}
          accent={Number(shiftWorkflow.pending_cash_drops) > 0 ? 'amber' : 'slate'}
        />
        <BackofficeStatCard
          title="Turnos abertos"
          value={isLoading ? '—' : shiftWorkflow.open_shifts ?? 0}
          subtitle={`Turnos com data ${today}`}
          icon={Wifi}
          accent="slate"
        />
      </div>

      {(Number(shiftWorkflow.pending_shift_closures) > 0 || Number(shiftWorkflow.pending_cash_drops) > 0) && (
        <DashboardSection
          title="Operação de caixa (cadeia)"
          subtitle={`Fluxo conveniência para o dia ${today}. Fechos/sangrias de outros dias aparecem no Fecho de dia da loja nessa data.`}
        >
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-3">
            <p className="text-muted-foreground">
              Cada loja trata aprovações em <strong>Fecho de dia</strong>. Use auditoria para rastrear accões.
            </p>
            {pendingShiftList.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Loja</th>
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Caixa</th>
                      <th className="py-2 pr-3">Operador</th>
                      <th className="py-2 pr-3 text-right">Vendas</th>
                      <th className="py-2 text-right">Δ caixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingShiftList.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{row.store}</td>
                        <td className="py-2 pr-3">{row.shift_date}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{row.pos_terminal_id || '—'}</td>
                        <td className="py-2 pr-3">{row.cashier_name || row.cashier_email}</td>
                        <td className="py-2 pr-3 text-right">{money(row.total_sales)}</td>
                        <td className="py-2 text-right font-medium">
                          {Number(row.discrepancy || 0) >= 0 ? '+' : ''}
                          {money(row.discrepancy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                to="/admin/audit"
                className="inline-flex items-center rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Ver auditoria
              </Link>
            </div>
          </div>
        </DashboardSection>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <DashboardSection title="Vendas por loja" subtitle="Comparação de desempenho diário" className="xl:col-span-3">
          {salesByStore.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Sem vendas registadas hoje.</div>
          ) : (
            <StoreSalesBarChart data={salesByStore} />
          )}
        </DashboardSection>
        <DashboardSection title="Vendas por categoria" subtitle="Mix agregado da cadeia" className="xl:col-span-2">
          {topCategories.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Sem vendas registadas hoje.</div>
          ) : (
            <>
              <CategoryPieChart data={topCategories} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {topCategories.map((category) => (
                  <div key={category.name} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">{category.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{category.share}% · {money(category.sales)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </DashboardSection>
      </div>

      <DashboardSection title="Comparação por loja" subtitle="Vendas, transações e ruturas por unidade">
        {stores.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sem lojas registadas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Loja</th>
                  <th className="py-3 pr-4 font-semibold">Cidade</th>
                  <th className="py-3 pr-4 font-semibold">Vendas hoje</th>
                  <th className="py-3 pr-4 font-semibold">Transações</th>
                  <th className="py-3 pr-4 font-semibold">Ruturas</th>
                  <th className="py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{s.city || '—'}</td>
                    <td className="py-3 pr-4">{money(s.daily_sales)}</td>
                    <td className="py-3 pr-4">{s.transactions}</td>
                    <td className="py-3 pr-4">{s.stock_breaks}</td>
                    <td className="py-3">
                      <StatusBadge tone={s.status === 'active' ? 'success' : 'warning'}>
                        {s.status === 'active' ? 'Ativa' : 'Inativa'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardSection title="Stock crítico na cadeia" subtitle="Produtos abaixo do mínimo definido" className="xl:col-span-2">
          {stockBreaks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem ruturas relevantes neste momento.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-3 pr-4 font-semibold">Produto</th>
                    <th className="py-3 pr-4 font-semibold">Loja</th>
                    <th className="py-3 pr-4 font-semibold">Stock</th>
                    <th className="py-3 font-semibold">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {stockBreaks.slice(0, 12).map((row) => (
                    <tr key={`${row.product_id}-${row.store}`} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.product_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.store}</td>
                      <td className="py-3 pr-4">{Number(row.quantity || 0)} un.</td>
                      <td className="py-3">{Number(row.minimum_threshold || 0)} un.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardSection>
        <DashboardSection title="Encomendas pendentes" subtitle="Fornecedores e abastecimento">
          {pendingOrders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem encomendas pendentes.</div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div key={order.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{order.supplier_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{order.store}</p>
                    </div>
                    <StatusBadge tone={order.status === 'pending' ? 'warning' : 'info'}>
                      {order.status === 'pending' ? 'Pendente' : 'Enviada'}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{money(order.total)} · {String(order.created_date).slice(0, 10)}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SyncStatus stores={stores} />
        <DashboardSection title="Auditoria recente" subtitle="Eventos críticos do sistema" className="xl:col-span-2">
          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem eventos de auditoria registados ainda.</div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-semibold">{log.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.actor_email || 'Sistema'}{log.scope ? ` · ${log.scope}` : ''}{log.entity ? ` · ${log.entity}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge tone={SEVERITY_TONE[log.severity] || 'info'}>
                      {SEVERITY_LABEL[log.severity] || log.severity}
                    </StatusBadge>
                    <p className="mt-1 text-xs text-muted-foreground">{String(log.created_at).slice(0, 16).replace('T', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>

      <DashboardSection title="Gestão central" subtitle="Atalhos para administração da cadeia">
        <ManagementShortcuts items={managementShortcuts} />
      </DashboardSection>
    </div>
  );
}
