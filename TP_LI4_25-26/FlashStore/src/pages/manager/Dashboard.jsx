import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import StatusBadge from '@/components/backoffice/StatusBadge';
import { LocalSalesChart } from '@/components/backoffice/SalesCharts';
import { Link } from 'react-router-dom';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';

const money = (value) => `${Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function methodBuckets(byMethod = []) {
  const map = Object.fromEntries(byMethod.map((m) => [m.method, m]));
  return {
    cash: Number(map['Numerário']?.total || 0),
    card: Number((map['Multibanco']?.total || 0) + (map['Cartão']?.total || 0) + (map['MB Way']?.total || 0)),
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const managerStore = user?.store || 'Braga Centro';
  const today = todayISO();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-store', managerStore, today],
    queryFn: () => api.dashboard.store(managerStore, { date: today }),
    refetchInterval: 60_000,
  });

  const totals = data?.totals || {};
  const hourly = useMemo(
    () => (data?.hourly || []).map((h) => ({ hour: `${h.hour}h`, sales: Math.round(Number(h.total || 0)), transactions: h.transactions })),
    [data]
  );
  const topProducts = data?.topProducts || [];
  const lowStock = data?.lowStock || [];
  const expiring = data?.expiring || [];
  const openShifts = data?.openShifts || [];
  const dayClosure = data?.dayClosure || null;
  const yesterday = data?.yesterday || {};
  const shiftWorkflow = data?.shiftWorkflow || {};
  const buckets = methodBuckets(data?.byMethod);
  const ticketAvg = totals.transactions > 0 ? Number(totals.total_sales || 0) / Number(totals.transactions) : 0;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Operação diária · ${managerStore}`}
        subtitle="Visão local da loja, caixa, stock e alertas operacionais do dia."
        profileLabel="Dashboard do Gerente"
        storeLabel={`${managerStore} · ${user?.full_name || 'Gerente'}`}
        variant="manager"
      />

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar dados da loja. Verifique a ligação ao servidor.
        </div>
      )}

      {!isLoading && !isError && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            shiftWorkflow.pending_shift_approvals > 0 ||
            shiftWorkflow.pending_cash_drops > 0 ||
            !yesterday.dayClosure
              ? 'border-amber-200 bg-amber-50/90 text-amber-900'
              : 'border-muted bg-muted/40 text-muted-foreground'
          }`}
        >
          <p className="font-semibold text-foreground">Preparação / controlo (início do dia)</p>
          <ul className="mt-2 space-y-1.5 list-disc pl-5">
            <li>
              Dia anterior ({yesterday.date || '—'}):{' '}
              {yesterday.dayClosure ? (
                <span>fecho operacional concluído.</span>
              ) : (
                <span className="font-medium text-amber-800">
                  sem registo de fecho — confira em{' '}
                  <Link to="/manager/day-closure" className="underline font-semibold">
                    Fecho de dia
                  </Link>
                  .
                </span>
              )}
            </li>
            {shiftWorkflow.pending_shift_approvals > 0 ? (
              <li>
                <span className="font-medium">{shiftWorkflow.pending_shift_approvals}</span> fecho(s) de turno por
                validar —{' '}
                <Link to="/manager/day-closure" className="underline font-medium">
                  rever
                </Link>
              </li>
            ) : (
              <li>Nenhum fecho de turno pendente na loja.</li>
            )}
            {shiftWorkflow.pending_cash_drops > 0 ? (
              <li>
                <span className="font-medium">{shiftWorkflow.pending_cash_drops}</span> sangria(s) por aprovar —{' '}
                <Link to="/manager/day-closure" className="underline font-medium">
                  rever
                </Link>
              </li>
            ) : (
              <li>Nenhuma sangria pendente.</li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <BackofficeStatCard
          title="Vendas do dia"
          value={money(totals.total_sales || 0)}
          subtitle="Faturação local (líquida de anuladas)"
          icon={TrendingUp}
          accent="orange"
        />
        <BackofficeStatCard
          title="Transações"
          value={isLoading ? '—' : (totals.transactions || 0)}
          subtitle="Talões emitidos hoje"
          icon={ShoppingCart}
          accent="blue"
        />
        <BackofficeStatCard
          title="Stock baixo"
          value={isLoading ? '—' : lowStock.length}
          subtitle="Produtos abaixo do mínimo"
          icon={PackageSearch}
          accent="amber"
        />
        <BackofficeStatCard
          title="Anuladas"
          value={isLoading ? '—' : (totals.cancelled || 0)}
          subtitle="Vendas anuladas hoje"
          icon={AlertTriangle}
          accent={Number(totals.cancelled || 0) > 0 ? 'red' : 'slate'}
        />
        <BackofficeStatCard
          title="Fecho do dia"
          value={dayClosure ? 'Fechado' : openShifts.length > 0 ? `${openShifts.length} turno(s) abertos` : 'Pendente'}
          subtitle={dayClosure ? `Fechado por ${dayClosure.closed_by_name || dayClosure.closed_by_email || '—'}` : 'Aguarda fecho operacional'}
          icon={ClipboardCheck}
          accent={dayClosure ? 'emerald' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardSection title="Vendas diárias" subtitle={`Evolução por hora · ${managerStore}`} className="xl:col-span-2">
          {hourly.length > 0 ? (
            <LocalSalesChart data={hourly} />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">Sem vendas registadas hoje.</div>
          )}
        </DashboardSection>

        <DashboardSection title="Resumo de faturação" subtitle="Indicadores locais do dia">
          <div className="space-y-4">
            <div className="rounded-lg bg-orange-50 p-4">
              <p className="text-sm text-orange-700">Ticket médio</p>
              <p className="mt-1 text-2xl font-bold text-orange-900">{money(ticketAvg)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Numerário</p>
                <p className="mt-1 text-lg font-bold">{money(buckets.cash)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Cartão · MB · MBWay</p>
                <p className="mt-1 text-lg font-bold">{money(buckets.card)}</p>
              </div>
            </div>
            {topProducts[0] && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Top produto</p>
                <p className="mt-1 text-sm font-semibold">{topProducts[0].name}</p>
                <p className="text-xs text-muted-foreground">{Number(topProducts[0].units || 0)} unidades</p>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardSection title="Top produtos vendidos" subtitle="Produtos com maior saída na loja hoje">
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem vendas ainda hoje.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-bold">{index + 1}</span>
                    <div>
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{Number(product.units || 0)} unidades vendidas</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{money(product.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Estado operacional" subtitle="Turnos, fecho e validades">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">Turnos abertos hoje</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {openShifts.length === 0 ? 'Nenhum turno aberto' : openShifts.map((s) => s.cashier_name || s.cashier_email).join(', ')}
                </p>
              </div>
              <StatusBadge tone={openShifts.length === 0 ? 'success' : 'warning'}>
                {openShifts.length === 0 ? 'OK' : `${openShifts.length} aberto(s)`}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">Fecho operacional</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dayClosure ? `Fechado às ${String(dayClosure.closed_at).slice(11, 16)}` : 'Pendente'}
                </p>
              </div>
              <StatusBadge tone={dayClosure ? 'success' : 'warning'}>
                {dayClosure ? 'Fechado' : 'Pendente'}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">Validades próximas (7 dias)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {expiring.length === 0 ? 'Sem ocorrências' : `${expiring.length} lote(s) a vencer brevemente`}
                </p>
              </div>
              <StatusBadge tone={expiring.length === 0 ? 'success' : 'warning'}>
                {expiring.length === 0 ? 'OK' : 'Atenção'}
              </StatusBadge>
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title="Alertas locais" subtitle="Stock crítico, validades e fecho">
          {lowStock.length === 0 && expiring.length === 0 && openShifts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem alertas críticos hoje.</div>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 3).map((row) => (
                <div key={`low-${row.product_id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <p className="text-sm font-semibold">Stock baixo · {row.product_name}</p>
                  <p className="mt-1 text-xs">{Math.max(0, Number(row.quantity || 0))} un. (mínimo {Number(row.minimum_threshold || 0)})</p>
                </div>
              ))}
              {expiring.slice(0, 3).map((row) => (
                <div key={`exp-${row.product_name}-${row.expiry_date}`} className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <p className="text-sm font-semibold">Validade próxima · {row.product_name}</p>
                  <p className="mt-1 text-xs">{Number(row.quantity || 0)} un. válidas até {String(row.expiry_date).slice(0, 10)}</p>
                </div>
              ))}
              {openShifts.slice(0, 2).map((shift) => (
                <div key={`shift-${shift.id}`} className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-800">
                  <p className="text-sm font-semibold">Turno aberto · {shift.cashier_name || shift.cashier_email}</p>
                  <p className="mt-1 text-xs">Início: {shift.start_time || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>

      <DashboardSection title="Stock local em risco" subtitle="Produtos abaixo do mínimo definido">
        {lowStock.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Todos os produtos acima do mínimo definido.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Produto</th>
                  <th className="py-3 pr-4 font-semibold">Stock</th>
                  <th className="py-3 pr-4 font-semibold">Mínimo</th>
                  <th className="py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((row) => {
                  const qty = Number(row.quantity || 0);
                  const min = Number(row.minimum_threshold || 0);
                  const critical = qty <= min * 0.3;
                  return (
                    <tr key={row.product_id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.product_name}</td>
                      <td className="py-3 pr-4">{qty} un.</td>
                      <td className="py-3 pr-4">{min} un.</td>
                      <td className="py-3">
                        <StatusBadge tone={critical ? 'critical' : 'warning'}>
                          {critical ? 'Rutura iminente' : 'Baixo'}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Controlo do dia" subtitle="Atalhos para a operação do gerente">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <a
            href="/manager/day-closure"
            className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-semibold">Validar fecho de turno</span>
          </a>
          <a
            href="/manager/stock"
            className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
          >
            <PackageSearch className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-semibold">Consultar stock</span>
          </a>
          <a
            href="/manager/reports"
            className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
          >
            <Banknote className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold">Relatórios e exportações</span>
          </a>
        </div>
      </DashboardSection>
    </div>
  );
}
