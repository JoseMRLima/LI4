import React, { useMemo } from 'react';
import { CalendarDays, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

function formatTodayPtShort() {
  return new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function DashboardHeader({
  title,
  subtitle,
  profileLabel,
  storeLabel,
  variant = 'manager',
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  showSearch = true,
  showTodayButton = true,
  showUserCard = true,
  /** Conteúdo extra na primeira linha à direita (raro; preferir secondaryActions) */
  actions = null,
  /** Linha adicional por baixo do cabeçalho, alinhada à direita (ex.: botões de página) */
  secondaryActions = null,
}) {
  const { user } = useAuth();
  const userName = user?.full_name || user?.name || (variant === 'admin' ? 'Helena Matos' : 'Marta Silva');
  const todayLabel = useMemo(() => formatTodayPtShort(), []);

  const firstRowEndAligned =
    !showSearch && !showTodayButton && !showUserCard && actions && !secondaryActions;

  return (
    <header className="mb-6">
      {profileLabel && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-orange-500">{profileLabel}</p>
      )}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div
          className={`flex flex-col gap-3 md:flex-row md:items-center ${
            firstRowEndAligned ? 'md:justify-end' : ''
          }`}
        >
          {showSearch && (
            <div className="relative min-w-0 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 bg-white/80"
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder || (variant === 'admin' ? 'Pesquisar loja, utilizador...' : 'Pesquisar produto, alerta...')}
              />
            </div>
          )}
          {showTodayButton && (
            <Button type="button" variant="outline" className="justify-start gap-2 tabular-nums bg-white/80" aria-label={`Data de hoje: ${todayLabel}`}>
              <CalendarDays className="h-4 w-4" />
              {todayLabel}
            </Button>
          )}
          {showUserCard && (
            <div className="rounded-lg border border-border/60 bg-white/70 px-3 py-2 backdrop-blur-sm">
              <p className="text-sm font-semibold leading-none">{userName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{storeLabel}</p>
            </div>
          )}
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {secondaryActions ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {secondaryActions}
        </div>
      ) : null}
      <div className="mt-4 h-px bg-gradient-to-r from-orange-200 via-orange-100 to-transparent" />
    </header>
  );
}
