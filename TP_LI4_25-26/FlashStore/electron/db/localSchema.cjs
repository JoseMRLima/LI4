/**
 * Schema SQLite local por loja (Electron main process).
 */
const SCHEMA_VERSION = 1;

function applyLocalSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id           TEXT PRIMARY KEY,
      operation    TEXT NOT NULL,
      entity       TEXT,
      entity_id    TEXT,
      payload_json TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      retries      INTEGER NOT NULL DEFAULT 0,
      last_error   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      barcode       TEXT,
      price         REAL NOT NULL,
      category      TEXT NOT NULL,
      image_url     TEXT,
      iva_rate      REAL NOT NULL DEFAULT 23,
      is_active     INTEGER NOT NULL DEFAULT 1,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock (
      id                TEXT PRIMARY KEY,
      product_id        TEXT NOT NULL,
      product_name      TEXT NOT NULL,
      store             TEXT NOT NULL,
      quantity          REAL NOT NULL DEFAULT 0,
      minimum_threshold REAL NOT NULL DEFAULT 10,
      serial_number     TEXT NOT NULL DEFAULT 'SEM-LOTE',
      expiry_date       TEXT,
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      type               TEXT NOT NULL,
      value              REAL NOT NULL,
      applies_to         TEXT NOT NULL,
      target_id          TEXT,
      target_name        TEXT,
      start_date         TEXT NOT NULL,
      end_date           TEXT NOT NULL,
      is_active          INTEGER NOT NULL DEFAULT 1,
      applies_to_stores  TEXT,
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id               TEXT PRIMARY KEY,
      store            TEXT NOT NULL,
      total            REAL NOT NULL,
      total_iva        REAL NOT NULL DEFAULT 0,
      payment_method   TEXT NOT NULL,
      amount_paid      REAL NOT NULL DEFAULT 0,
      change_given     REAL NOT NULL DEFAULT 0,
      customer_nif     TEXT,
      cashier_email    TEXT,
      cashier_name     TEXT,
      invoice_number   TEXT,
      document_type    TEXT NOT NULL DEFAULT 'Fatura Simplificada',
      receipt_number   TEXT,
      receipt_text     TEXT,
      status           TEXT NOT NULL DEFAULT 'completed',
      shift_closure_id TEXT,
      sync_status      TEXT NOT NULL DEFAULT 'pending_local',
      created_date     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id            TEXT PRIMARY KEY,
      sale_id       TEXT NOT NULL,
      product_id    TEXT NOT NULL,
      product_name  TEXT NOT NULL,
      quantity      REAL NOT NULL,
      unit_price    REAL NOT NULL,
      iva_rate      REAL NOT NULL DEFAULT 23,
      subtotal      REAL NOT NULL,
      stock_id      TEXT,
      serial_number TEXT,
      expiry_date   TEXT
    );

    CREATE TABLE IF NOT EXISTS shift_closures (
      id              TEXT PRIMARY KEY,
      store           TEXT NOT NULL,
      pos_terminal_id TEXT,
      cashier_email   TEXT NOT NULL,
      cashier_name    TEXT,
      shift_date      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'open',
      sync_status     TEXT NOT NULL DEFAULT 'pending_local',
      created_date    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_local_stock_store_product ON stock(store, product_id);
    CREATE INDEX IF NOT EXISTS idx_local_sales_store_date ON sales(store, created_date);
    CREATE INDEX IF NOT EXISTS idx_outbox_status ON sync_outbox(status, created_at);
  `);

  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run('schema_version', String(SCHEMA_VERSION));
}

module.exports = { applyLocalSchema, SCHEMA_VERSION };
