const { ipcMain } = require('electron');
const { SCHEMA_VERSION } = require('../db/localSchema.cjs');
const { seedDemoIfEmpty } = require('../db/seedDemo.cjs');
const { createOfflineSale } = require('../db/offlineSale.cjs');
const { openShiftOffline, closeShiftOffline, getOpenShiftOffline } = require('../db/offlineShift.cjs');
const { importCatalog } = require('../db/catalogImport.cjs');
const { getPendingOutbox, commitSyncResults, requeueFailedOutbox } = require('../db/syncCommit.cjs');

function registerDbIpc(getDb, getStoreConfig) {
  ipcMain.handle('db:ping', () => {
    const db = getDb();
    const cfg = getStoreConfig();
    const meta = db.prepare(`SELECT key, value FROM sync_meta`).all();
    const metaMap = Object.fromEntries(meta.map((r) => [r.key, r.value]));
    const products = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
    const outboxPending = db
      .prepare(`SELECT COUNT(*) AS c FROM sync_outbox WHERE status = 'pending'`)
      .get().c;
    const outboxFailed = db
      .prepare(`SELECT COUNT(*) AS c FROM sync_outbox WHERE status = 'failed'`)
      .get().c;
    const lastErrors = db
      .prepare(
        `
      SELECT last_error FROM sync_outbox
      WHERE status IN ('pending', 'failed') AND last_error IS NOT NULL AND last_error != ''
      ORDER BY created_at DESC
      LIMIT 2
    `
      )
      .all()
      .map((r) => r.last_error);

    return {
      ok: true,
      storeId: cfg.storeLabel,
      storeSlug: cfg.storeSlug,
      dbPath: cfg.dbPath,
      schemaVersion: Number(metaMap.schema_version || SCHEMA_VERSION),
      productCount: products,
      outboxPending,
      outboxFailed,
      lastSyncErrors: lastErrors,
    };
  });

  ipcMain.handle('db:getProducts', (_event, opts = {}) => {
    const db = getDb();
    const cfg = getStoreConfig();
    const store = opts.store || cfg.storeLabel;
    const limit = Math.min(Number(opts.limit) || 500, 2000);

    const rows = db
      .prepare(
        `
      SELECT
        p.id,
        p.name,
        p.barcode,
        p.price,
        p.category,
        p.image_url,
        p.iva_rate,
        p.is_active,
        COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) AS stock_qty
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id AND s.store = ?
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.name COLLATE NOCASE
      LIMIT ?
    `
      )
      .all(store, limit);

    return { store, products: rows };
  });

  ipcMain.handle('db:getStock', (_event, opts = {}) => {
    const db = getDb();
    const cfg = getStoreConfig();
    const store = opts.store || cfg.storeLabel;

    const rows = db
      .prepare(
        `
      SELECT
        id,
        product_id,
        product_name,
        store,
        quantity,
        minimum_threshold,
        serial_number,
        expiry_date,
        updated_at AS created_date
      FROM stock
      WHERE store = ?
      ORDER BY product_name COLLATE NOCASE,
        CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END,
        expiry_date ASC,
        updated_at ASC
    `
      )
      .all(store);

    return { store, stock: rows };
  });

  ipcMain.handle('db:getOutboxStats', () => {
    const db = getDb();
    const rows = db
      .prepare(
        `
      SELECT status, COUNT(*) AS c
      FROM sync_outbox
      GROUP BY status
    `
      )
      .all();
    return Object.fromEntries(rows.map((r) => [r.status, r.c]));
  });

  ipcMain.handle('db:seedDemo', () => {
    const db = getDb();
    const cfg = getStoreConfig();
    return seedDemoIfEmpty(db, cfg.storeLabel);
  });

  ipcMain.handle('db:createSale', (_event, payload) => {
    const db = getDb();
    return createOfflineSale(db, payload);
  });

  ipcMain.handle('db:importCatalog', (_event, payload) => {
    const db = getDb();
    return importCatalog(db, payload);
  });

  ipcMain.handle('db:getPendingOutbox', (_event, opts = {}) => {
    const db = getDb();
    return { entries: getPendingOutbox(db, opts?.limit) };
  });

  ipcMain.handle('db:commitSyncResults', (_event, results) => {
    const db = getDb();
    return commitSyncResults(db, results);
  });

  ipcMain.handle('db:requeueFailedOutbox', () => {
    const db = getDb();
    return requeueFailedOutbox(db);
  });

  // ── Turnos offline ───────────────────────────────────────────
  ipcMain.handle('db:openShift', (_event, payload) => {
    const db = getDb();
    const cfg = getStoreConfig();
    const store = payload?.store || cfg.storeLabel;
    try {
      return { ok: true, shift: openShiftOffline(db, { ...payload, store }) };
    } catch (err) {
      return { ok: false, error: err.message, status: err.status || 500 };
    }
  });

  ipcMain.handle('db:closeShift', (_event, payload) => {
    const db = getDb();
    try {
      return { ok: true, shift: closeShiftOffline(db, payload) };
    } catch (err) {
      return { ok: false, error: err.message, status: err.status || 500 };
    }
  });

  ipcMain.handle('db:getOpenShift', (_event, opts = {}) => {
    const db = getDb();
    const cfg = getStoreConfig();
    const store = opts.store || cfg.storeLabel;
    return { shift: getOpenShiftOffline(db, store) };
  });

  ipcMain.handle('db:getRecentSales', (_event, opts = {}) => {
    const db = getDb();
    const limit = Math.min(Number(opts.limit) || 20, 100);
    const sales = db
      .prepare(
        `
      SELECT
        id,
        store,
        total,
        payment_method,
        sync_status,
        invoice_number,
        receipt_number,
        created_date
      FROM sales
      ORDER BY created_date DESC
      LIMIT ?
    `
      )
      .all(limit);

    return { sales };
  });

  ipcMain.handle('db:getShiftSales', (_event, opts = {}) => {
    const db = getDb();
    const { shift_id } = opts;
    if (!shift_id) return { sales: [] };
    const sales = db
      .prepare(
        `SELECT id, store, total, payment_method, amount_paid, change_given, status, shift_closure_id, created_date
         FROM sales
         WHERE shift_closure_id = ? AND status = 'completed'
         ORDER BY created_date ASC`
      )
      .all(shift_id);
    return { sales };
  });

  ipcMain.handle('db:getProductImageUrls', () => {
    const db = getDb();
    return db.prepare('SELECT id, image_url FROM products').all();
  });
}

module.exports = { registerDbIpc };
