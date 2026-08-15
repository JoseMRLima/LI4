/**
 * FlashStore — Scheduler central
 *
 * Jobs agendados:
 *  - 23:30 diário  → verificação de fechos de dia em falta + log de alerta (UC12)
 *  - 23:45 diário  → snapshot de stock de todas as lojas (RF14)
 *  - 02:00 diário  → backups (delegado para backup.js via app.listen)
 *  - Dia 4 de cada mês → geração automática do SAFT-PT do mês anterior (RNF11)
 *  - A cada 30 min  → verificação de produtos com validade próxima (RF13)
 */

const path = require('path');
const fs = require('fs');

const SAFT_DIR = path.join(__dirname, 'saft-exports');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Milissegundos até à próxima ocorrência de HH:MM (hora local). */
function msUntil(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

/** Repetir diariamente a uma hora fixa. */
function dailyAt(hour, minute, label, fn) {
  function scheduleNext() {
    const delay = msUntil(hour, minute);
    console.log(`[scheduler] ${label} agendado em ${Math.round(delay / 60000)} min`);
    setTimeout(async () => {
      console.log(`[scheduler] ▶ ${label}`);
      try { await fn(); } catch (err) { console.error(`[scheduler] ✗ ${label}:`, err.message); }
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

/** Verificar se hoje é dia 4 e hora 06:00 → gerar SAFT do mês anterior. */
function scheduleSaftMonthly(db) {
  function check() {
    const now = new Date();
    if (now.getDate() === 4) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      generateSaftForMonth(db, prevMonth.getFullYear(), prevMonth.getMonth() + 1);
    }
  }
  dailyAt(6, 0, 'SAFT mensal (dia 4)', check);
}

function generateSaftForMonth(db, year, month) {
  try {
    ensureDir(SAFT_DIR);
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    const stores = db.prepare('SELECT DISTINCT store FROM sales WHERE created_date >= ? AND created_date <= ?').all(startDate, endDate);
    stores.forEach(({ store }) => {
      try {
        const filename = path.join(SAFT_DIR, `SAFT_${store.replace(/\s/g, '_')}_${year}${monthStr}.xml`);
        if (fs.existsSync(filename)) return;
        const { generateSaftXml } = require('./saft');
        const xml = generateSaftXml(db, { store, startDate, endDate });
        fs.writeFileSync(filename, xml, 'utf8');
        console.log(`[scheduler] SAFT gerado: ${filename}`);
      } catch (err) {
        console.error(`[scheduler] Erro ao gerar SAFT de ${store}:`, err.message);
      }
    });
  } catch (err) {
    console.error(`[scheduler] Erro ao gerar SAFT do mês ${year}-${month}:`, err.message);
  }
}
/** Verificar produtos com validade próxima (≤ 7 dias) e registar alertas. */
function checkExpiryAlerts(db) {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const expiring = db.prepare(`
    SELECT s.id AS stock_id, s.product_id, s.product_name, s.store,
           s.quantity, s.expiry_date, s.serial_number
    FROM stock s
    WHERE s.expiry_date IS NOT NULL
      AND s.expiry_date != ''
      AND s.expiry_date >= ?
      AND s.expiry_date <= ?
      AND s.quantity > 0
    ORDER BY s.expiry_date ASC
  `).all(today, in7Days);

  expiring.forEach((row) => {
    const daysLeft = Math.ceil((new Date(row.expiry_date) - new Date(today)) / 86400000);
    db.prepare(`
      INSERT OR IGNORE INTO alerts (id, type, store, product_id, product_name,
        stock_id, serial_number, expiry_date, days_until_expiry, quantity, resolved, created_at)
      VALUES (?, 'expiry', ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(
      `exp-${row.stock_id}`,
      row.store, row.product_id, row.product_name,
      row.stock_id, row.serial_number, row.expiry_date,
      daysLeft, row.quantity
    );
  });

  if (expiring.length > 0) {
    console.log(`[scheduler] ⚠ ${expiring.length} lotes com validade próxima detetados`);
  }
}

/** Snapshot de stock de todas as lojas para RF14 (resumo diário). */
function snapshotDailyStock(db) {
  const today = new Date().toISOString().slice(0, 10);
  const stores = db.prepare('SELECT DISTINCT store FROM stock').all();

  stores.forEach(({ store }) => {
    const totals = db.prepare(`
      SELECT
        COUNT(DISTINCT product_id) AS distinct_products,
        SUM(quantity) AS total_units,
        SUM(CASE WHEN quantity < minimum_threshold THEN 1 ELSE 0 END) AS low_stock_count,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date != ''
                  AND expiry_date <= date('now', '+7 days') AND quantity > 0
             THEN 1 ELSE 0 END) AS expiring_soon_count
      FROM stock WHERE store = ?
    `).get(store);

    db.prepare(`
      INSERT OR REPLACE INTO daily_stock_snapshots
        (id, store, snapshot_date, distinct_products, total_units, low_stock_count, expiring_soon_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      `${store}-${today}`, store, today,
      totals.distinct_products || 0,
      totals.total_units || 0,
      totals.low_stock_count || 0,
      totals.expiring_soon_count || 0
    );
  });

  console.log(`[scheduler] 📦 Snapshot de stock do dia ${today} guardado`);
}

/** Verificar lojas sem fecho de dia e registar alerta às 23:30. */
function checkMissingDayClosures(db) {
  const today = new Date().toISOString().slice(0, 10);
  const stores = db.prepare('SELECT DISTINCT store FROM pos_terminals WHERE is_active = 1').all();

  stores.forEach(({ store }) => {
    const closed = db.prepare(
      'SELECT id FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL'
    ).get(store, today);

    if (!closed) {
      console.log(`[scheduler] ⚠ Loja "${store}" ainda não fechou o dia ${today}`);
      db.prepare(`
        INSERT OR IGNORE INTO alerts (id, type, store, product_id, product_name,
          stock_id, serial_number, expiry_date, days_until_expiry, quantity, resolved, created_at)
        VALUES (?, 'missing_day_closure', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, datetime('now'))
      `).run(`mdc-${store}-${today}`, store);
    }
  });
}

function startScheduler(db) {
  // Garantir que as tabelas de suporte existem
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id              TEXT PRIMARY KEY,
      type            TEXT NOT NULL,
      store           TEXT NOT NULL,
      product_id      TEXT,
      product_name    TEXT,
      stock_id        TEXT,
      serial_number   TEXT,
      expiry_date     TEXT,
      days_until_expiry INTEGER,
      quantity        REAL,
      resolved        INTEGER NOT NULL DEFAULT 0,
      resolved_at     TEXT,
      resolved_by     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_stock_snapshots (
      id                   TEXT PRIMARY KEY,
      store                TEXT NOT NULL,
      snapshot_date        TEXT NOT NULL,
      distinct_products    INTEGER,
      total_units          REAL,
      low_stock_count      INTEGER,
      expiring_soon_count  INTEGER,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_store_type  ON alerts(store, type, resolved);
    CREATE INDEX IF NOT EXISTS idx_alerts_created     ON alerts(created_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_store_date ON daily_stock_snapshots(store, snapshot_date);
  `);

  // Verificação de validade a cada 30 minutos
  checkExpiryAlerts(db);
  setInterval(() => checkExpiryAlerts(db), 30 * 60 * 1000);

  // Verificação de stock mínimo a cada 30 minutos (gera alertas tipo 'low_stock')
  checkLowStockAlerts(db);
  setInterval(() => checkLowStockAlerts(db), 30 * 60 * 1000);

  // Jobs diários
  dailyAt(23, 30, 'Verificação fecho de dia', () => checkMissingDayClosures(db));
  dailyAt(23, 45, 'Snapshot stock diário (RF14)', () => snapshotDailyStock(db));
  scheduleSaftMonthly(db);

  console.log('[scheduler] ✅ Scheduler iniciado');
}

function checkLowStockAlerts(db) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT product_id, product_name, store,
           SUM(CASE WHEN expiry_date IS NULL OR expiry_date = '' OR expiry_date >= ?
                    THEN quantity ELSE 0 END) AS valid_qty,
           MAX(minimum_threshold) AS min_threshold
    FROM stock
    GROUP BY product_id, store
    HAVING valid_qty < min_threshold AND min_threshold > 0
  `).all(today);

  rows.forEach((row) => {
    db.prepare(`
      INSERT OR IGNORE INTO alerts (id, type, store, product_id, product_name,
        stock_id, serial_number, expiry_date, days_until_expiry, quantity, resolved, created_at)
      VALUES (?, 'low_stock', ?, ?, ?, NULL, NULL, NULL, NULL, ?, 0, datetime('now'))
    `).run(
      `ls-${row.product_id}-${row.store}-${today}`,
      row.store, row.product_id, row.product_name, row.valid_qty
    );
  });
}

module.exports = { startScheduler, generateSaftForMonth, checkExpiryAlerts, checkLowStockAlerts };
