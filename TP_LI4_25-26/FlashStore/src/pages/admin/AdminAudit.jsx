import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Filter } from 'lucide-react';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import BackofficeStatCard from '@/components/backoffice/BackofficeStatCard';
import StatusBadge from '@/components/backoffice/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/api/apiClient';

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

const SEVERITIES = ['', 'info', 'low', 'medium', 'high', 'critical'];

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function downloadCSV(rows) {
  const header = ['data', 'ator', 'role', 'acao', 'entidade', 'entity_id', 'severidade', 'scope', 'payload'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([
      r.created_at,
      r.actor_email || '',
      r.actor_role || '',
      r.action,
      r.entity || '',
      r.entity_id || '',
      r.severity,
      r.scope || '',
      typeof r.payload === 'object' ? JSON.stringify(r.payload) : (r.payload || ''),
    ].map(csvEscape).join(';'));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminAudit() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    actor: '',
    severity: '',
    action: '',
    q: '',
  });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () =>
      api.audit.list({
        ...filters,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    keepPreviousData: true,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stats = useMemo(() => {
    const counts = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of rows) {
      counts[r.severity] = (counts[r.severity] || 0) + 1;
    }
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = rows.filter((r) => String(r.created_at).startsWith(today)).length;
    return {
      criticalCount: counts.critical + counts.high,
      todayCount,
      totalShown: rows.length,
    };
  }, [rows]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Auditoria"
        subtitle="Histórico de eventos críticos da operação"
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        showSearch={false}
        actions={(
          <Button variant="outline" onClick={() => downloadCSV(rows)} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BackofficeStatCard
          title="Eventos críticos visíveis"
          value={stats.criticalCount}
          subtitle="Alta ou Crítica nesta página"
          icon={FileText}
          accent="red"
        />
        <BackofficeStatCard
          title="Eventos hoje (página)"
          value={stats.todayCount}
          subtitle="Filtrados na visualização atual"
          icon={Filter}
          accent="blue"
        />
        <BackofficeStatCard
          title="Total no filtro"
          value={total}
          subtitle="Total de eventos correspondentes"
          icon={FileText}
          accent="slate"
        />
      </div>

      <DashboardSection title="Filtros" subtitle="Restringir o histórico de auditoria">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Ator (email)</Label>
            <Input value={filters.actor} placeholder="email@flashstore.pt" onChange={(e) => updateFilter('actor', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Severidade</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filters.severity}
              onChange={(e) => updateFilter('severity', e.target.value)}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{s ? SEVERITY_LABEL[s] : 'Todas'}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Ação</Label>
            <Input value={filters.action} placeholder="login, sale_cancelled..." onChange={(e) => updateFilter('action', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Pesquisa livre</Label>
            <Input value={filters.q} placeholder="produto, NIF, loja..." onChange={(e) => updateFilter('q', e.target.value)} />
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Histórico" subtitle="Eventos ordenados do mais recente para o mais antigo">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">A carregar...</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado para este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Data / Hora</th>
                  <th className="py-3 pr-4 font-semibold">Ator</th>
                  <th className="py-3 pr-4 font-semibold">Ação</th>
                  <th className="py-3 pr-4 font-semibold">Entidade</th>
                  <th className="py-3 pr-4 font-semibold">Loja</th>
                  <th className="py-3 pr-4 font-semibold">Severidade</th>
                  <th className="py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                      {String(row.created_at).slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.actor_email || 'Sistema'}</p>
                      <p className="text-xs text-muted-foreground">{row.actor_role || '—'}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{row.action}</td>
                    <td className="py-3 pr-4 text-xs">
                      {row.entity || '—'}
                      {row.entity_id ? <p className="text-muted-foreground font-mono">{row.entity_id.slice(0, 12)}</p> : null}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{row.scope || '—'}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge tone={SEVERITY_TONE[row.severity] || 'info'}>
                        {SEVERITY_LABEL[row.severity] || row.severity}
                      </StatusBadge>
                    </td>
                    <td className="py-3 max-w-md text-xs text-muted-foreground">
                      {row.payload ? (
                        <details>
                          <summary className="cursor-pointer text-primary">Ver payload</summary>
                          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[11px]">
                            {JSON.stringify(row.payload, null, 2)}
                          </pre>
                        </details>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} · {total} eventos
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Seguinte
              </Button>
            </div>
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
