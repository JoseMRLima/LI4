import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Package, CalendarX, CheckCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = API_ROOT ? `${API_ROOT}/api` : '/api';

function authHeaders() {
  const token = localStorage.getItem('flashstore_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fetchAlerts(store, type, resolved) {
  const params = new URLSearchParams({ limit: '200' });
  if (store) params.set('store', store);
  if (type) params.set('type', type);
  if (resolved !== undefined) params.set('resolved', resolved ? 'true' : 'false');
  const res = await fetch(`${API_BASE}/alerts?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Erro ao carregar alertas');
  return res.json();
}

async function resolveAlert(id) {
  const res = await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: 'PUT', headers: authHeaders() });
  if (!res.ok) throw new Error('Erro ao resolver alerta');
  return res.json();
}

async function resolveAll(store, type) {
  const res = await fetch(`${API_BASE}/alerts/resolve-all`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ store, type }),
  });
  if (!res.ok) throw new Error('Erro ao resolver alertas');
  return res.json();
}

const TYPE_CONFIG = {
  low_stock: { label: 'Stock Mínimo', icon: Package, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  expiry: { label: 'Validade Próxima', icon: Clock, color: 'bg-red-100 text-red-800 border-red-200' },
  missing_day_closure: { label: 'Fecho de Dia em Falta', icon: CalendarX, color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

function AlertCard({ alert, onResolve, resolving }) {
  const cfg = TYPE_CONFIG[alert.type] || { label: alert.type, icon: AlertTriangle, color: 'bg-gray-100 text-gray-800' };
  const Icon = cfg.icon;
  const daysLeft = alert.days_until_expiry;

  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border p-4 ${alert.resolved ? 'opacity-50' : ''} ${cfg.color}`}>
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {alert.type === 'low_stock' && `Stock mínimo atingido — ${alert.product_name}`}
            {alert.type === 'expiry' && `Validade próxima — ${alert.product_name}`}
            {alert.type === 'missing_day_closure' && `Fecho de dia em falta`}
          </p>
          <p className="text-xs opacity-80 mt-0.5">
            {alert.store}
            {alert.type === 'expiry' && daysLeft !== null && ` · expira em ${daysLeft} dia(s) (${alert.expiry_date})`}
            {alert.type === 'expiry' && alert.serial_number && ` · lote ${alert.serial_number}`}
            {alert.type === 'low_stock' && alert.quantity !== null && ` · ${Number(alert.quantity).toFixed(0)} unidades`}
          </p>
          <p className="text-xs opacity-60 mt-1">
            {new Date(alert.created_at).toLocaleString('pt-PT')}
            {alert.resolved && alert.resolved_by && ` · resolvido por ${alert.resolved_by}`}
          </p>
        </div>
      </div>
      {!alert.resolved && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 bg-white/60"
          onClick={() => onResolve(alert.id)}
          disabled={resolving}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          Resolver
        </Button>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('active');
  const store = user?.role === 'admin' ? undefined : user?.store;

  const { data: activeAlerts = [], isLoading, refetch } = useQuery({
    queryKey: ['alerts', store, false],
    queryFn: () => fetchAlerts(store, undefined, false),
    refetchInterval: 60_000,
  });

  const { data: resolvedAlerts = [] } = useQuery({
    queryKey: ['alerts', store, true],
    queryFn: () => fetchAlerts(store, undefined, true),
  });

  const { mutate: doResolve, isPending: resolving } = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alerta marcado como resolvido');
    },
  });

  const { mutate: doResolveAll } = useMutation({
    mutationFn: ({ type }) => resolveAll(store, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alertas resolvidos');
    },
  });

  const byType = (type) => activeAlerts.filter((a) => a.type === type);
  const counts = {
    low_stock: byType('low_stock').length,
    expiry: byType('expiry').length,
    missing_day_closure: byType('missing_day_closure').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alertas Operacionais</h1>
          <p className="text-muted-foreground text-sm">Monitorização de stock, validades e fechos de dia</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={type} className={counts[type] > 0 ? 'border-2 border-orange-300' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {cfg.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${counts[type] > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {isLoading ? '—' : counts[type]}
                </p>
                <p className="text-xs text-muted-foreground">alertas ativos</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">
            Ativos
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{activeAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          {['low_stock', 'expiry', 'missing_day_closure'].map((type) => {
            const items = byType(type);
            if (items.length === 0) return null;
            const cfg = TYPE_CONFIG[type];
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{cfg.label} ({items.length})</h3>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => doResolveAll({ type })}
                  >
                    Resolver todos
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <AlertCard key={a.id} alert={a} onResolve={doResolve} resolving={resolving} />
                  ))}
                </div>
              </div>
            );
          })}
          {!isLoading && activeAlerts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">Sem alertas ativos</p>
              <p className="text-sm">Tudo a funcionar normalmente</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-2 mt-4">
          {resolvedAlerts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Sem alertas resolvidos</p>
          ) : (
            resolvedAlerts.map((a) => (
              <AlertCard key={a.id} alert={a} onResolve={() => {}} resolving={false} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
