import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, RefreshCw, Filter } from 'lucide-react';
import { api } from '@/api/apiClient';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import SaftReport from '@/components/reports/SaftReport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const money = (v) =>
  Number(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function exportCSV(rows, groupBy) {
  if (!rows?.length) return;
  const headers = {
    store:    ['Loja', 'Total Vendas (€)', 'Transações', 'Ticket Médio (€)', 'Numerário (€)', 'Cartão (€)', 'MB Way (€)'],
    day:      ['Data', 'Total Vendas (€)', 'Transações', 'Ticket Médio (€)', 'Numerário (€)', 'Cartão (€)', 'MB Way (€)'],
    category: ['Categoria', 'Total Vendas (€)', 'Transações', 'Unidades Vendidas'],
  };
  const cols = headers[groupBy] || headers.store;

  const lines = [cols.join(';')];
  for (const r of rows) {
    if (groupBy === 'category') {
      lines.push([r.period, r.total_sales, r.transactions, r.units_sold].join(';'));
    } else {
      lines.push([r.period, r.total_sales, r.transactions, r.avg_ticket, r.cash, r.card, r.mbway].join(';'));
    }
  }

  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flashstore-relatorio-${groupBy}-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo,   setDateTo]   = useState(todayStr());
  const [store,    setStore]    = useState('');
  const [category, setCategory] = useState('');
  const [groupBy,  setGroupBy]  = useState('store');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['comparative', dateFrom, dateTo, store, category, groupBy],
    queryFn: () => api.reports.comparative({ date_from: dateFrom, date_to: dateTo, store: store || undefined, category: category || undefined, group_by: groupBy }),
    staleTime: 30_000,
  });

  const rows      = data?.rows     || [];
  const totals    = data?.totals   || {};
  const stores    = data?.meta?.stores    || [];
  const categories = data?.meta?.categories || [];

  const chartData = useMemo(() =>
    rows.map(r => ({ name: r.period?.slice(0, 10) ?? r.period, value: Number(r.total_sales || 0) })),
    [rows]
  );

  const colLabel = groupBy === 'day' ? 'Data' : groupBy === 'category' ? 'Categoria' : 'Loja';

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Relatórios Corporativos"
        subtitle="Análise comparativa de vendas · exportação CSV · SAFT-PT"
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        showSearch={false}
      />

      <Tabs defaultValue="comparative">
        <TabsList>
          <TabsTrigger value="comparative">Comparativo de Vendas</TabsTrigger>
          <TabsTrigger value="saft">SAFT-PT / Fiscal</TabsTrigger>
        </TabsList>

        {/* ── TAB: COMPARATIVO ── */}
        <TabsContent value="comparative" className="space-y-4 mt-4">

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">De</label>
                  <input type="date" value={dateFrom} max={dateTo}
                    onChange={e => setDateFrom(e.target.value)}
                    className="h-9 rounded-md border px-3 text-sm bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input type="date" value={dateTo} min={dateFrom}
                    onChange={e => setDateTo(e.target.value)}
                    className="h-9 rounded-md border px-3 text-sm bg-background" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Agrupar por</label>
                  <Select value={groupBy} onValueChange={setGroupBy}>
                    <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">Loja</SelectItem>
                      <SelectItem value="day">Dia</SelectItem>
                      <SelectItem value="category">Categoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Loja</label>
                  <Select value={store || '__all'} onValueChange={v => setStore(v === '__all' ? '' : v)}>
                    <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Todas as lojas</SelectItem>
                      {stores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Categoria</label>
                  <Select value={category || '__all'} onValueChange={v => setCategory(v === '__all' ? '' : v)}>
                    <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Todas as categorias</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                  <Button size="sm" onClick={() => exportCSV(rows, groupBy)} disabled={!rows.length}>
                    <Download className="w-4 h-4 mr-1" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Vendas</p>
                <p className="text-2xl font-bold text-primary">{money(totals.total_sales)}</p>
                <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Transações</p>
                <p className="text-2xl font-bold">{Number(totals.transactions || 0).toLocaleString('pt-PT')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {totals.transactions > 0 ? money(totals.total_sales / totals.transactions) : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Vendas por {colLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 16 }} barSize={36}>
                    <defs>
                      <linearGradient id="reportBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                        <stop offset="100%" stopColor="#fdba74" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={46}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}€`}
                      width={56}
                    />
                    <Tooltip
                      formatter={v => [money(v), 'Vendas']}
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        fontSize: '13px',
                      }}
                      cursor={{ fill: '#f97316', fillOpacity: 0.06 }}
                    />
                    <Bar dataKey="value" name="Vendas" fill="url(#reportBarGradient)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalhe por {colLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-10 text-muted-foreground text-sm">A carregar...</div>
              ) : rows.length === 0 ? (
                <div className="flex justify-center py-10 text-muted-foreground text-sm">Sem dados para o período selecionado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2">{colLabel}</th>
                        <th className="text-right px-4 py-2">Total (€)</th>
                        <th className="text-right px-4 py-2">Transações</th>
                        {groupBy !== 'category' && <th className="text-right px-4 py-2">Ticket Médio</th>}
                        {groupBy !== 'category' && <th className="text-right px-4 py-2">Numerário</th>}
                        {groupBy !== 'category' && <th className="text-right px-4 py-2">Cartão</th>}
                        {groupBy !== 'category' && <th className="text-right px-4 py-2">MB Way</th>}
                        {groupBy === 'category' && <th className="text-right px-4 py-2">Unidades</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2 font-medium">{r.period}</td>
                          <td className="px-4 py-2 text-right font-semibold text-primary">{money(r.total_sales)}</td>
                          <td className="px-4 py-2 text-right">
                            <Badge variant="secondary">{r.transactions}</Badge>
                          </td>
                          {groupBy !== 'category' && <td className="px-4 py-2 text-right text-muted-foreground">{money(r.avg_ticket)}</td>}
                          {groupBy !== 'category' && <td className="px-4 py-2 text-right text-green-600">{money(r.cash)}</td>}
                          {groupBy !== 'category' && <td className="px-4 py-2 text-right text-blue-600">{money(r.card)}</td>}
                          {groupBy !== 'category' && <td className="px-4 py-2 text-right text-orange-600">{money(r.mbway)}</td>}
                          {groupBy === 'category' && <td className="px-4 py-2 text-right">{Number(r.units_sold || 0).toLocaleString('pt-PT')}</td>}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right text-primary">{money(totals.total_sales)}</td>
                        <td className="px-4 py-2 text-right">{Number(totals.transactions || 0).toLocaleString('pt-PT')}</td>
                        {groupBy !== 'category' && <td colSpan={4} />}
                        {groupBy === 'category' && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: SAFT ── */}
        <TabsContent value="saft" className="mt-4">
          <SaftReport mode="admin" storeName="Cadeia FlashStore" embedInAdminLayout />
        </TabsContent>
      </Tabs>
    </div>
  );
}
