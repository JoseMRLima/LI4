/**
 * Aplica resultados de sync ao outbox e vendas locais.
 */

function getPendingOutbox(db, limit = 50) {
  const rows = db
    .prepare(
      `
    SELECT id, operation, entity, entity_id, payload_json, status, retries, created_at
    FROM sync_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `
    )
    .all(Math.min(Number(limit) || 50, 100));

  return rows.map((row) => ({
    ...row,
    payload: (() => {
      try {
        return JSON.parse(row.payload_json);
      } catch {
        return null;
      }
    })(),
  }));
}

function commitSyncResults(db, results = []) {
  const now = new Date().toISOString();
  let syncedCount = 0;
  let failedCount = 0;

  const markSynced = db.prepare(`
    UPDATE sync_outbox
    SET status = 'synced', synced_at = ?, last_error = NULL
    WHERE id = ?
  `);
  const markSaleSynced = db.prepare(`
    UPDATE sales SET sync_status = 'synced' WHERE id = ?
  `);
  const markFailed = db.prepare(`
    UPDATE sync_outbox
    SET
      retries = retries + 1,
      last_error = ?,
      status = CASE WHEN (retries + 1) >= 3 THEN 'failed' ELSE 'pending' END
    WHERE id = ?
  `);

  db.transaction(() => {
    for (const r of results) {
      if (!r?.outbox_id) continue;

      if (r.status === 'synced') {
        markSynced.run(now, r.outbox_id);
        if (r.entity_id) {
          markSaleSynced.run(r.entity_id);
        }
        syncedCount += 1;
      } else if (r.status === 'failed') {
        markFailed.run(String(r.error || 'Erro desconhecido').slice(0, 500), r.outbox_id);
        failedCount += 1;
      }
    }
  })();

  return { syncedCount, failedCount };
}

function requeueFailedOutbox(db) {
  const result = db
    .prepare(
      `
    UPDATE sync_outbox
    SET status = 'pending', retries = 0, last_error = NULL
    WHERE status = 'failed'
  `
    )
    .run();
  return { requeued: result.changes || 0 };
}

module.exports = { getPendingOutbox, commitSyncResults, requeueFailedOutbox };
