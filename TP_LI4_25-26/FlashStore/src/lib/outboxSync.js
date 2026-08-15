import { checkOnline, isElectronApp } from '@/lib/connectivity';

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = API_ROOT ? `${API_ROOT}/api` : '/api';

function getToken() {
  return localStorage.getItem('flashstore_token');
}

/**
 * Envia fila outbox ao servidor central e marca sucessos na BD local.
 * @returns {{ synced: number, failed: number, skipped: boolean, error?: string }}
 */
export async function pushPendingOutbox(store) {
  if (!store || !isElectronApp() || !window.flashstore?.db) {
    return { synced: 0, failed: 0, skipped: true };
  }

  const online = await checkOnline();
  if (!online) {
    return { synced: 0, failed: 0, skipped: true, error: 'Sem ligação ao servidor' };
  }

  const token = getToken();
  if (!token) {
    return { synced: 0, failed: 0, skipped: true, error: 'Sessão não iniciada' };
  }

  const { entries = [] } = await window.flashstore.db.getPendingOutbox({ limit: 50 });
  if (!entries.length) {
    return { synced: 0, failed: 0, skipped: true };
  }

  const operations = entries
    .filter((e) => e.payload)
    .map((e) => ({
      outbox_id: e.id,
      operation: e.operation,
      entity: e.entity,
      entity_id: e.entity_id,
      payload: e.payload,
    }));

  if (!operations.length) {
    return { synced: 0, failed: entries.length, skipped: false, error: 'Payload inválido na fila' };
  }

  const res = await fetch(`${API_BASE}/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ store, operations }),
  });

  if (res.status === 401) {
    localStorage.removeItem('flashstore_token');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Falha ao sincronizar');
  }

  const commitPayload = (data.results || []).map((r) => ({
    outbox_id: r.outbox_id,
    status: r.status,
    entity_id: r.entity_id,
    error: r.error,
  }));

  await window.flashstore.db.commitSyncResults(commitPayload);

  return {
    synced: data.synced ?? 0,
    failed: data.failed ?? 0,
    hasMore: Boolean(data.has_more),
    results: (data.results || []).map((r) => ({
      outbox_id: r.outbox_id,
      status: r.status,
      entity_id: r.entity_id,
      error: r.error,
    })),
  };
}
