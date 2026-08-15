import React from 'react';
import { Construction, ServerCog } from 'lucide-react';
import DashboardSection from './DashboardSection';
import StatusBadge from './StatusBadge';

/**
 * Sincronização central — UI placeholder.
 * Esta secção será reativada quando a camada de sincronização entre lojas
 * e a central (Outbox + IPC) estiver implementada. Mantém-se visível para
 * que o operador perceba que a feature está prevista no roadmap, mas
 * não consome nenhum dado real até lá.
 */
export default function SyncStatus({ stores = [] }) {
  return (
    <DashboardSection title="Sincronização central" subtitle="Estado da ligação entre lojas e sede">
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-amber-800">
          <Construction className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Funcionalidade em preparação</p>
            <p className="mt-1 text-xs">
              A sincronização contínua entre lojas e sede ainda não está ativa. Esta secção fica disponível
              para uso futuro, quando a camada de outbox e replicação for ligada.
            </p>
          </div>
        </div>

        {stores.slice(0, 4).map((store) => (
          <div key={store.id || store.name} className="flex items-center justify-between gap-4 rounded-lg border p-3 opacity-70">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ServerCog className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{store.name}</p>
                <p className="text-xs text-muted-foreground">A operar localmente · sem replicação central</p>
              </div>
            </div>
            <StatusBadge tone="warning">Local</StatusBadge>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
