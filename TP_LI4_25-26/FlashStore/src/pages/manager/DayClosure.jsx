import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { api, formatApiError } from '@/api/apiClient';

const STATUS_LABELS = {
  pending_approval: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  closed: 'Aprovado',
  open: 'Aberto',
};

const STATUS_CLASSES = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-green-100 text-green-800',
  open: 'bg-blue-100 text-blue-800',
};

export default function DayClosure() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [adminStorePick, setAdminStorePick] = useState(null);

  const { data: storesList = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.entities.Store.list(),
    enabled: isAdmin,
  });

  const adminStoreChoices = useMemo(
    () =>
      storesList
        .filter((s) => (s.status || 'active') === 'active')
        .map((s) => s.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt')),
    [storesList],
  );

  const managerStore = isAdmin
    ? (adminStorePick ?? adminStoreChoices[0] ?? '')
    : (user?.store || 'Braga Centro');
  const queriesEnabled = !isAdmin || !!managerStore;

  /** Igual ao servidor e aos POS (UTC); cartões e reabertura alinham com este «hoje». */
  const calendarTodayStr = new Date().toISOString().slice(0, 10);
  const todayLabel = format(parseISO(calendarTodayStr), 'dd/MM/yyyy');

  const queryClient = useQueryClient();
  const [closeTarget, setCloseTarget] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);
  const [floatDate, setFloatDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [floatInputs, setFloatInputs] = useState({});
  const floatDateRef = useRef(floatDate);

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', managerStore],
    queryFn: () => api.entities.ShiftClosure.filter({ store: managerStore }),
    enabled: queriesEnabled,
  });

  const { data: dayClosures = [] } = useQuery({
    queryKey: ['day-closures', managerStore],
    queryFn: () => api.dayClosures.list({ store: managerStore }),
    enabled: queriesEnabled,
  });

  const { data: registerRows = [] } = useQuery({
    queryKey: ['registerFloats', managerStore, floatDate],
    queryFn: () => api.registerFloats.list(managerStore, floatDate),
    enabled: queriesEnabled,
  });

  const { data: pendingDrops = [] } = useQuery({
    queryKey: ['cashDrops', managerStore, 'pending'],
    queryFn: () => api.cashDrops.list({ store: managerStore, status: 'pending' }),
    refetchInterval: 20_000,
    enabled: queriesEnabled,
  });

  const {
    data: activePosTerminals = [],
    isPending: posTerminalsLoading,
    isError: posTerminalsError,
    error: posTerminalsErr,
  } = useQuery({
    queryKey: ['posTerminals', managerStore],
    queryFn: () => api.posTerminals.list(managerStore),
    enabled: queriesEnabled,
  });

  useEffect(() => {
    const dateChanged = floatDateRef.current !== floatDate;
    floatDateRef.current = floatDate;

    const rowFor = (code) =>
      registerRows.find((r) => String(r.terminal_id).toUpperCase() === String(code).toUpperCase());

    setFloatInputs((prev) => {
      if (dateChanged) {
        const fresh = {};
        for (const t of activePosTerminals) {
          const code = t.code;
          const row = rowFor(code);
          fresh[code] = row != null ? String(row.opening_float) : '';
        }
        return fresh;
      }

      const next = { ...prev };
      for (const t of activePosTerminals) {
        const code = t.code;
        const row = rowFor(code);
        if (row != null) {
          next[code] = String(row.opening_float);
        } else if (!(code in next)) {
          next[code] = '';
        }
      }
      const valid = new Set(activePosTerminals.map((t) => String(t.code).toUpperCase()));
      for (const k of Object.keys(next)) {
        if (!valid.has(String(k).toUpperCase())) delete next[k];
      }
      return next;
    });
  }, [registerRows, floatDate, activePosTerminals]);

  const dayClosureMap = useMemo(() => {
    const map = {};
    for (const c of dayClosures) {
      if (!c.reopened_at) map[c.closure_date] = c;
    }
    return map;
  }, [dayClosures]);

  const approveMutation = useMutation({
    mutationFn: (shiftId) => api.entities.ShiftClosure.update(shiftId, { status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Fecho aprovado', description: 'O fecho de turno foi validado pelo gerente.' });
    },
    onError: (err) => {
      toast({
        title: 'Erro ao aprovar fecho',
        description: formatApiError(err),
        variant: 'destructive',
      });
    },
  });

  const saveFloatMutation = useMutation({
    mutationFn: ({ terminal_id, opening_float }) =>
      api.registerFloats.set({
        store: managerStore,
        terminal_id,
        business_date: floatDate,
        opening_float: Number(opening_float),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registerFloats', managerStore, floatDate] });
      toast({ title: 'Fundo de abertura guardado' });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: formatApiError(err), variant: 'destructive' });
    },
  });

  const dropDecisionMutation = useMutation({
    mutationFn: ({ id, status }) => api.cashDrops.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashDrops', managerStore, 'pending'] });
      toast({ title: 'Pedido de sangria atualizado' });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: formatApiError(err), variant: 'destructive' });
    },
  });

  const closeDayMutation = useMutation({
    mutationFn: (date) => api.dayClosures.create({ store: managerStore, closure_date: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-closures'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Dia fechado', description: 'O dia foi consolidado e está bloqueado para novas operações.' });
      setCloseTarget(null);
    },
    onError: (err) => {
      toast({
        title: 'Não foi possível fechar o dia',
        description: formatApiError(err),
        variant: 'destructive',
      });
    },
  });

  const reopenDayMutation = useMutation({
    mutationFn: ({ id, reason }) => api.dayClosures.reopen(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-closures'] });
      toast({ title: 'Dia reaberto', description: 'O dia voltou a aceitar operações.' });
      setReopenTarget(null);
    },
    onError: (err) => {
      toast({
        title: 'Erro ao reabrir dia',
        description: formatApiError(err),
        variant: 'destructive',
      });
    },
  });

  const filtered = shifts.filter((s) => s.store === managerStore);

  const grouped = {};
  filtered.forEach((s) => {
    const key = `${s.shift_date}-${s.store}`;
    if (!grouped[key]) {
      grouped[key] = {
        date: s.shift_date,
        store: s.store,
        shifts: [],
        totalSales: 0,
        totalDiscrepancy: 0,
        totalWithdrawn: 0,
        totalCashLeft: 0,
        totalTransactions: 0,
        openShifts: 0,
        pendingShifts: 0,
        approvedShifts: 0,
      };
    }

    grouped[key].shifts.push(s);
    grouped[key].totalSales += Number(s.total_sales || 0);
    grouped[key].totalDiscrepancy += Number(s.discrepancy || 0);
    grouped[key].totalWithdrawn += Number(s.withdrawn_cash || 0);
    grouped[key].totalCashLeft += Number(s.cash_left_in_store || 0);
    grouped[key].totalTransactions += Number(s.num_transactions || 0);
    if (s.status === 'open') grouped[key].openShifts += 1;
    else if (s.status === 'pending_approval') grouped[key].pendingShifts += 1;
    else if (s.status === 'approved' || s.status === 'closed') grouped[key].approvedShifts += 1;
  });

  const days = Object.values(grouped).sort((a, b) => b.date?.localeCompare(a.date));

  const reportsPath = isAdmin ? '/admin/reports' : '/manager/reports';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fecho de Dia Operacional</h1>
          <p className="text-muted-foreground text-sm">
            Consolidação diária · {managerStore || '—'} · {days.length} dia(s) com atividade ·{' '}
            <Link to={reportsPath} className="text-primary underline underline-offset-2">
              Relatório / SAF-T
            </Link>
          </p>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Loja</CardTitle>
            <p className="text-xs text-muted-foreground">
              Escolha a loja para ver turnos, fundos de abertura e reabrir dias fechados.
            </p>
          </CardHeader>
          <CardContent>
            {adminStoreChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                A carregar lojas… Se a lista estiver vazia, registe lojas em Admin → Lojas.
              </p>
            ) : (
              <Select
                value={managerStore}
                onValueChange={(v) => setAdminStorePick(v)}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Seleccione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {adminStoreChoices.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preparação do dia — fundos por caixa</CardTitle>
          <p className="text-xs text-muted-foreground">
            Fundo de abertura por POS registado na base para <strong>{managerStore}</strong>. O operador confirma no
            caixa.
          </p>
          {!posTerminalsLoading && !posTerminalsError && activePosTerminals.length > 0 ? (
            <p className="text-sm font-medium text-foreground pt-1">
              {activePosTerminals.length}{' '}
              {activePosTerminals.length === 1 ? 'caixa registada' : 'caixas registadas'}:{' '}
              <span className="font-mono font-normal text-muted-foreground">
                {activePosTerminals.map((t) => t.code).join(', ')}
              </span>
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dia operacional</p>
              <Input type="date" value={floatDate} onChange={(e) => setFloatDate(e.target.value)} className="w-44" />
            </div>
          </div>
          {posTerminalsLoading ? (
            <p className="text-sm text-muted-foreground">A carregar caixas da loja…</p>
          ) : null}
          {posTerminalsError ? (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              Não foi possível obter a lista de caixas: {formatApiError(posTerminalsErr)}
            </p>
          ) : null}
          {!posTerminalsLoading && !posTerminalsError && activePosTerminals.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Esta loja ainda não tem caixas POS na base de dados (execute `node seed.js` ou registe caixas na API).
            </p>
          ) : null}
          {!posTerminalsLoading && !posTerminalsError && activePosTerminals.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activePosTerminals.map((t) => (
                <div key={t.id} className="flex flex-col gap-1 rounded-lg border p-3">
                  <p className="text-xs font-mono font-medium">{t.code}</p>
                  {t.label ? <p className="text-[11px] text-muted-foreground truncate">{t.label}</p> : null}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={floatInputs[t.code] ?? ''}
                      onChange={(e) =>
                        setFloatInputs((prev) => ({ ...prev, [t.code]: e.target.value }))
                      }
                      placeholder="€ abertura"
                    />
                    <Button
                      size="sm"
                      type="button"
                      disabled={saveFloatMutation.isPending}
                      onClick={() => {
                        const v = parseFloat(String(floatInputs[t.code] || '').replace(',', '.'));
                        if (Number.isNaN(v) || v < 0) {
                          toast({ title: 'Valor inválido', variant: 'destructive' });
                          return;
                        }
                        saveFloatMutation.mutate({ terminal_id: t.code, opening_float: v });
                      }}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {pendingDrops.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-900">Sangrias pendentes</CardTitle>
            <p className="text-xs text-amber-800">Aprovação necessária antes do fecho do turno.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingDrops.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-background p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{Number(d.amount || 0).toFixed(2)}€</p>
                  <p className="text-xs text-muted-foreground">{d.reason || 'Sem motivo'}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido por {d.requested_by_name || d.requested_by_email} · turno{' '}
                    <span className="font-mono">{d.shift_closure_id?.slice(0, 8)}…</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    type="button"
                    onClick={() => dropDecisionMutation.mutate({ id: d.id, status: 'rejected' })}
                    disabled={dropDecisionMutation.isPending}
                  >
                    Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => dropDecisionMutation.mutate({ id: d.id, status: 'approved' })}
                    disabled={dropDecisionMutation.isPending}
                  >
                    Aprovar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {days.map((day) => {
          const dayYmd = day.date ? String(day.date).slice(0, 10) : '';
          const isReopenCalendarDay = dayYmd === calendarTodayStr;
          const dayClosure = dayClosureMap[day.date];
          const isClosed = !!dayClosure;
          const canClose = day.openShifts === 0 && day.pendingShifts === 0 && !isClosed;
          const blockingReason = isClosed
            ? 'Dia fechado'
            : day.openShifts > 0
              ? `${day.openShifts} turno(s) ainda em aberto`
              : day.pendingShifts > 0
                ? `${day.pendingShifts} fecho(s) por aprovar`
                : null;

          return (
            <Card key={day.date} className={isClosed ? 'border-emerald-200 bg-emerald-50/40' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    {isClosed ? (
                      <Lock className="mt-1 h-5 w-5 text-emerald-700" />
                    ) : (
                      <Unlock className="mt-1 h-5 w-5 text-amber-700" />
                    )}
                    <div>
                      <CardTitle className="text-base">
                        {day.store} · {day.date ? format(new Date(day.date), 'dd/MM/yyyy') : '—'}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {day.shifts.length} turno(s) · {day.totalTransactions} transação(ões)
                        {isClosed && dayClosure?.closed_at ? ` · Fechado às ${String(dayClosure.closed_at).slice(11, 16)} por ${dayClosure.closed_by_name || dayClosure.closed_by_email}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="text-lg font-bold">{day.totalSales.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">
                      Retirado: {day.totalWithdrawn.toFixed(2)}€ · Caixa: {day.totalCashLeft.toFixed(2)}€
                    </p>
                    <Badge
                      className={`text-xs ${
                        day.totalDiscrepancy === 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      Discrepância: {day.totalDiscrepancy >= 0 ? '+' : ''}
                      {day.totalDiscrepancy.toFixed(2)}€
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{day.openShifts} aberto(s)</Badge>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{day.pendingShifts} pendente(s)</Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{day.approvedShifts} aprovado(s)</Badge>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isClosed ? (
                      isAdmin && isReopenCalendarDay && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-700 border-orange-200"
                          onClick={() => setReopenTarget(dayClosure)}
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Reabrir dia (hoje)
                        </Button>
                      )
                    ) : null}
                    {isClosed && isAdmin && !isReopenCalendarDay && (
                      <span className="text-[11px] text-muted-foreground max-w-xs text-right">
                        Reabertura só para o dia corrente ({todayLabel}). Esta data já não está no calendário de hoje.
                      </span>
                    )}
                    {!isClosed ? (
                      <Button
                        size="sm"
                        disabled={!canClose}
                        onClick={() => setCloseTarget(day)}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Fechar dia
                      </Button>
                    ) : null}
                  </div>
                </div>

                {!isClosed && blockingReason && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{blockingReason}. Resolva antes de fechar o dia.</span>
                  </div>
                )}

                {isClosed && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Dia bloqueado: novas vendas, anulações ou turnos para esta data não são aceites pelo servidor.
                      {!isAdmin && isReopenCalendarDay && (
                        <>
                          {' '}
                          Se o fecho foi por engano <strong>ainda hoje</strong> ({todayLabel}), um administrador pode
                          reabrir em <strong>Admin Central → Fecho de Dia</strong> nesta loja.
                        </>
                      )}
                      {!isAdmin && !isReopenCalendarDay && (
                        <>
                          {' '}
                          Fechos de dias anteriores no calendário não podem ser reabertos; o registo mantém-se para
                          auditoria.
                        </>
                      )}
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-2">
                  {day.shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="p-3 bg-muted/50 rounded-lg text-sm space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{shift.cashier_name || shift.cashier_email}</p>
                            <Badge className={`text-xs ${STATUS_CLASSES[shift.status] || STATUS_CLASSES.open}`}>
                              {STATUS_LABELS[shift.status] || shift.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {shift.start_time || '—'} a {shift.end_time || '—'}
                            {shift.pos_terminal_id ? (
                              <span className="font-mono"> · {shift.pos_terminal_id}</span>
                            ) : null}
                          </p>
                          {Number(shift.opening_mismatch || 0) > 0 && shift.status === 'open' && (
                            <p className="text-xs text-amber-700">
                              Abertura com divergência face ao fundo definido
                              {(() => {
                                const exp = Number(shift.opening_expected_cash);
                                const dec = Number(shift.opening_declared_cash);
                                const hasExp = Number.isFinite(exp);
                                const hasDec = Number.isFinite(dec);
                                if (hasExp && hasDec) {
                                  return ` (esperado: ${exp.toFixed(2)}€ · contado: ${dec.toFixed(2)}€)`;
                                }
                                if (hasExp) {
                                  return ` (fundo definido: ${exp.toFixed(2)}€)`;
                                }
                                return '';
                              })()}
                              .
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-semibold">
                            {shift.num_transactions || 0} vendas · {Number(shift.total_sales || 0).toFixed(2)}€
                          </p>
                          <p className={`text-xs ${
                            Number(shift.discrepancy || 0) === 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            Discrepância: {Number(shift.discrepancy || 0).toFixed(2)}€
                          </p>
                        </div>
                      </div>

                      {shift.status === 'pending_approval' && !isClosed && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => approveMutation.mutate(shift.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Aprovar Fecho
                          </Button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-background rounded-md p-2">
                          <p className="text-muted-foreground">Esperado</p>
                          <p className="font-semibold">{Number(shift.expected_cash || 0).toFixed(2)}€</p>
                        </div>
                        <div className="bg-background rounded-md p-2">
                          <p className="text-muted-foreground">Contado</p>
                          <p className="font-semibold">{Number(shift.counted_cash || 0).toFixed(2)}€</p>
                        </div>
                        <div className="bg-background rounded-md p-2">
                          <p className="text-muted-foreground">Retirado</p>
                          <p className="font-semibold">{Number(shift.withdrawn_cash || 0).toFixed(2)}€</p>
                        </div>
                        <div className="bg-background rounded-md p-2">
                          <p className="text-muted-foreground">Ficou em caixa</p>
                          <p className="font-semibold">{Number(shift.cash_left_in_store || 0).toFixed(2)}€</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {days.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            Nenhum fecho de turno registado para a sua loja.
          </div>
        )}
      </div>

      <AlertDialog open={!!closeTarget} onOpenChange={(open) => !open && setCloseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o dia {closeTarget?.date} de {managerStore}?</AlertDialogTitle>
            <AlertDialogDescription>
              Após o fecho, o servidor recusa novas vendas, anulações ou aberturas de turno para esta data.
              Só no <strong>próprio dia</strong> ({todayLabel}) é que um administrador pode reabrir, para corrigir um
              erro imediato; datas passadas ficam definitivas. Total consolidado:{' '}
              <strong>{Number(closeTarget?.totalSales || 0).toFixed(2)}€</strong> em{' '}
              <strong>{closeTarget?.totalTransactions || 0}</strong> transações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeTarget && closeDayMutation.mutate(closeTarget.date)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar fecho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reopenTarget} onOpenChange={(open) => !open && setReopenTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir o dia {reopenTarget?.closure_date}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível reabrir o dia de hoje no calendário ({todayLabel}). A operação é registada na auditoria
              com o utilizador admin que a executou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reopenTarget && reopenDayMutation.mutate({ id: reopenTarget.id, reason: 'Reaberto pela gestão' })
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              Reabrir dia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
