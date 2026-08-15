import { WifiOff, RefreshCw, CloudUpload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflineBanner({
  isOnline,
  checking,
  outboxPending = 0,
  outboxFailed = 0,
  lastSyncErrors = [],
  syncing = false,
  onRefresh,
  onSync,
  onRequeueFailed,
}) {
  const queueTotal = outboxPending + outboxFailed;
  if (isOnline && queueTotal <= 0) return null;

  const errorHint = lastSyncErrors[0];

  if (!isOnline) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-950"
        role="status"
      >
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Modo offline</p>
            <p className="text-xs opacity-90 truncate">
              Vendas guardadas localmente
              {outboxPending > 0 ? ` · ${outboxPending} pendente(s) de sync` : ''}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 h-8" onClick={onRefresh} disabled={checking}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? 'animate-spin' : ''}`} />
          Recarregar
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sky-950"
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0">
        {outboxFailed > 0 ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
        ) : (
          <CloudUpload className="h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {outboxFailed > 0 ? 'Sincronização com erros' : 'Sincronização pendente'}
          </p>
          <p className="text-xs opacity-90 line-clamp-2">
            {outboxPending > 0 ? `${outboxPending} pendente(s)` : ''}
            {outboxPending > 0 && outboxFailed > 0 ? ' · ' : ''}
            {outboxFailed > 0 ? `${outboxFailed} com falha definitiva` : ''}
            {errorHint ? ` — ${errorHint}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {outboxFailed > 0 && onRequeueFailed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onRequeueFailed}
            disabled={syncing || checking}
          >
            Repor tentativas
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-sky-400"
          onClick={onSync}
          disabled={syncing || checking || outboxPending <= 0}
        >
          <CloudUpload className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-pulse' : ''}`} />
          {syncing ? 'A sincronizar…' : 'Sincronizar'}
        </Button>
      </div>
    </div>
  );
}
