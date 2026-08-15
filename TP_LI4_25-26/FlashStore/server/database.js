/**
 * FlashStore — Inicialização da base de dados SQLite
 *
 * Este ficheiro cria todas as tabelas na primeira execução
 * e devolve a instância `db` para ser usada no servidor.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'flashstore.db');

function ensureColumn(db, tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((col) => col.name === columnName);

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    console.log(`✅ Coluna adicionada: ${tableName}.${columnName}`);
  }
}

function ensureStockLotsSchema(db) {
  const columns = db.prepare('PRAGMA table_info(stock)').all();
  const hasSerialNumber = columns.some((col) => col.name === 'serial_number');

  if (hasSerialNumber) return;

  db.transaction(() => {
    db.exec('ALTER TABLE stock RENAME TO stock_legacy');
    db.exec(`
      CREATE TABLE stock (
        id                TEXT PRIMARY KEY,
        product_id        TEXT NOT NULL REFERENCES products(id),
        product_name      TEXT NOT NULL,
        store             TEXT NOT NULL,
        quantity          REAL NOT NULL DEFAULT 0,
        minimum_threshold REAL NOT NULL DEFAULT 10,
        serial_number     TEXT NOT NULL DEFAULT 'SEM-LOTE',
        expiry_date       TEXT,
        created_date      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO stock (
        id, product_id, product_name, store, quantity, minimum_threshold, serial_number, expiry_date, created_date
      )
      SELECT
        id,
        product_id,
        product_name,
        store,
        quantity,
        minimum_threshold,
        'SEM-LOTE',
        expiry_date,
        datetime('now')
      FROM stock_legacy
    `);
    db.exec('DROP TABLE stock_legacy');
  })();

  console.log('✅ Stock migrado para gestão por lotes/série');
}

function ensureShiftApprovalSchema(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'shift_closures'").get();
  if (!table?.sql || table.sql.includes("'pending_approval'")) return;

  db.transaction(() => {
    db.exec('ALTER TABLE shift_closures RENAME TO shift_closures_legacy');
    db.exec(`
      CREATE TABLE shift_closures (
        id                 TEXT PRIMARY KEY,
        store              TEXT NOT NULL,
        cashier_email      TEXT NOT NULL,
        cashier_name       TEXT,
        shift_date         TEXT NOT NULL,
        start_time         TEXT,
        end_time           TEXT,
        expected_cash      REAL NOT NULL DEFAULT 0,
        counted_cash       REAL NOT NULL DEFAULT 0,
        withdrawn_cash     REAL NOT NULL DEFAULT 0,
        cash_left_in_store REAL NOT NULL DEFAULT 0,
        discrepancy        REAL NOT NULL DEFAULT 0,
        total_sales        REAL NOT NULL DEFAULT 0,
        num_transactions   INTEGER NOT NULL DEFAULT 0,
        status             TEXT NOT NULL DEFAULT 'open'
                           CHECK(status IN ('open', 'pending_approval', 'approved', 'rejected', 'closed')),
        approved_by_email  TEXT,
        approved_by_name   TEXT,
        approved_date      TEXT,
        created_date       TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO shift_closures (
        id, store, cashier_email, cashier_name, shift_date, start_time, end_time,
        expected_cash, counted_cash, withdrawn_cash, cash_left_in_store,
        discrepancy, total_sales, num_transactions, status, created_date
      )
      SELECT
        id, store, cashier_email, cashier_name, shift_date, start_time, end_time,
        expected_cash, counted_cash, withdrawn_cash, cash_left_in_store,
        discrepancy, total_sales, num_transactions,
        CASE WHEN status = 'closed' THEN 'approved' ELSE status END,
        created_date
      FROM shift_closures_legacy
    `);
    db.exec('DROP TABLE shift_closures_legacy');
  })();

  console.log('✅ Fechos de turno migrados para aprovação do gerente');
}

function formatReceiptMoney(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function formatReceiptLine(left, right = '', width = 42) {
  const l = String(left || '');
  const r = String(right || '');
  if (!r) return l.slice(0, width);
  const gap = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(gap)}${r}`.slice(0, width);
}

function ensureSaleReceipts(db) {
  const missing = db.prepare(`
    SELECT * FROM sales
    WHERE receipt_number IS NULL OR receipt_number = '' OR receipt_text IS NULL OR receipt_text = ''
  `).all();

  if (missing.length === 0) return;

  const itemsStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
  const updateStmt = db.prepare('UPDATE sales SET receipt_number = ?, receipt_text = ?, receipt_issued_at = COALESCE(receipt_issued_at, created_date) WHERE id = ?');

  for (const sale of missing) {
    const receiptNumber = sale.receipt_number || `TL-${String(sale.created_date || sale.id).replace(/\D/g, '').slice(0, 14)}-${String(sale.id).slice(-4)}`;
    const items = itemsStmt.all(sale.id);
    const lines = [
      'FLASHSTORE'.padStart(26),
      '',
      sale.store || 'Loja FlashStore',
      'FlashStore Retail S.A.',
      'NIF: 999999990',
      sale.document_type || 'Fatura Simplificada Original',
      `Nro: ${sale.invoice_number || sale.id}`,
      `Talão: ${receiptNumber}`,
      String(sale.created_date || '').replace('T', ' ').slice(0, 16),
      '',
      `NIF: ${sale.customer_nif || 'Consumidor final'}`,
      '',
      formatReceiptLine('IVA  DESCRICAO', 'VALOR'),
      '-'.repeat(42),
    ];

    for (const item of items) {
      const taxCode = Number(item.iva_rate || 0) === 6 ? '(A)' : '(C)';
      lines.push(formatReceiptLine(`${taxCode} ${item.product_name}`, formatReceiptMoney(item.subtotal)));
      lines.push(`    ${formatReceiptMoney(item.quantity)} x ${formatReceiptMoney(item.unit_price)} EUR`);
    }

    lines.push(
      '',
      formatReceiptLine('TOTAL A PAGAR', formatReceiptMoney(sale.total)),
      formatReceiptLine(sale.payment_method || 'Pagamento', formatReceiptMoney(sale.amount_paid)),
      formatReceiptLine('TROCO', formatReceiptMoney(sale.change_given)),
      '',
      'Obrigado pela sua compra.',
      '-'.repeat(42)
    );

    updateStmt.run(receiptNumber, lines.join('\n'), sale.id);
  }

  console.log(`✅ ${missing.length} talões históricos associados a vendas existentes`);
}

function removeLotDetailsFromReceipts(db) {
  const rows = db.prepare(`
    SELECT id, receipt_text
    FROM sales
    WHERE receipt_text LIKE '%Lote %'
  `).all();

  if (rows.length === 0) return;

  const updateStmt = db.prepare('UPDATE sales SET receipt_text = ? WHERE id = ?');
  const stripLotLines = (text) => String(text || '')
    .split('\n')
    .filter((line) => !/^\s*Lote\s+/.test(line))
    .join('\n');

  db.transaction(() => {
    for (const row of rows) {
      updateStmt.run(stripLotLines(row.receipt_text), row.id);
    }
  })();

  console.log(`✅ ${rows.length} talões atualizados sem lote/validade`);
}

function ensureUsersRoleCheck(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!table?.sql) return;

  // Migração: remover 'repositor' do CHECK e converter utilizadores existentes para 'manager'
  if (table.sql.includes("'repositor'")) {
    // PRAGMA legacy_alter_table evita que o SQLite atualize automaticamente
    // referências de FK noutras tabelas (ex: stores.manager_user_id REFERENCES users)
    // quando o RENAME corre — sem isso, stores ficaria a apontar para users_legacy após o DROP.
    db.exec('PRAGMA legacy_alter_table = ON');
    try {
      db.transaction(() => {
        db.exec('ALTER TABLE users RENAME TO users_legacy');
        db.exec(`
          CREATE TABLE users (
            id            TEXT PRIMARY KEY,
            email         TEXT NOT NULL UNIQUE,
            full_name     TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'cashier'
                          CHECK(role IN ('admin', 'cashier', 'manager')),
            store         TEXT,
            password_hash TEXT NOT NULL,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_date  TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `);
        db.exec(`
          INSERT INTO users (id, email, full_name, role, store, password_hash, is_active, created_date)
          SELECT id, email, full_name,
                 CASE WHEN role = 'repositor' THEN 'manager' ELSE role END,
                 store, password_hash, is_active, created_date
          FROM users_legacy
        `);
        db.exec('DROP TABLE users_legacy');
      })();
    } finally {
      db.exec('PRAGMA legacy_alter_table = OFF');
    }
    console.log('✅ Tabela users migrada: "repositor" removido (utilizadores convertidos para "manager")');
  }
}

// Recupera a tabela stores caso o seu FK tenha sido corrompido pela migração anterior
// (ALTER TABLE users RENAME sem legacy_alter_table atualizava a referência para users_legacy)
function ensureStoresFKFix(db) {
  const storesTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stores'").get();
  if (!storesTable?.sql || !storesTable.sql.includes('users_legacy')) return;

  db.exec('PRAGMA legacy_alter_table = ON');
  try {
    db.transaction(() => {
      db.exec('ALTER TABLE stores RENAME TO stores_legacy');
      db.exec(`
        CREATE TABLE stores (
          id               TEXT PRIMARY KEY,
          code             TEXT UNIQUE,
          name             TEXT NOT NULL UNIQUE,
          city             TEXT,
          address          TEXT,
          manager_user_id  TEXT REFERENCES users(id),
          status           TEXT NOT NULL DEFAULT 'active'
                           CHECK(status IN ('active', 'inactive')),
          created_date     TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        INSERT INTO stores (id, code, name, city, address, manager_user_id, status, created_date)
        SELECT id, code, name, city, address, manager_user_id, status, created_date
        FROM stores_legacy
      `);
      db.exec('DROP TABLE stores_legacy');
    })();
  } finally {
    db.exec('PRAGMA legacy_alter_table = OFF');
  }
  console.log('✅ Tabela stores: FK para users corrigida');
}

function ensureProductCategories(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const defaults = [
    'Bebidas',
    'Snacks',
    'Tabaco',
    'Lacticínios',
    'Padaria',
    'Congelados',
    'Higiene',
    'Limpeza',
    'Outros',
  ];
  const ins = db.prepare('INSERT OR IGNORE INTO product_categories (id, name) VALUES (?, ?)');
  for (const name of defaults) {
    ins.run(`seed:cat:${name}`, name);
  }
}

function initDB() {
  const db = new Database(DB_PATH);

  // Activar foreign keys (SQLite não activa por defeito)
  db.pragma('foreign_keys = ON');
  // WAL mode para melhor performance em leituras concorrentes
  db.pragma('journal_mode = WAL');

  // ─────────────────────────────────────────────────────────────
  // TABELA: users
  // Funcionários do sistema (caixa, gerente, admin)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      full_name     TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'cashier'
                    CHECK(role IN ('admin', 'cashier', 'manager')),
      store         TEXT,
      password_hash TEXT NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_date  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: products
  // Catálogo de produtos da cadeia
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      barcode       TEXT UNIQUE,
      price         REAL NOT NULL,
      category      TEXT NOT NULL,
      image_url     TEXT,
      supplier_id   TEXT REFERENCES suppliers(id),
      supplier_name TEXT,
      iva_rate      REAL NOT NULL DEFAULT 23,
      is_perishable INTEGER NOT NULL DEFAULT 0,
      default_shelf_life_days INTEGER,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_date  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  ensureColumn(db, 'products', 'supplier_id', 'TEXT');
  ensureColumn(db, 'products', 'supplier_name', 'TEXT');
  ensureColumn(db, 'products', 'default_shelf_life_days', 'INTEGER');

  // ─────────────────────────────────────────────────────────────
  // TABELA: suppliers
  // Fornecedores da cadeia
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      contact    TEXT,
      email      TEXT,
      nif        TEXT NOT NULL UNIQUE,
      address    TEXT,
      is_active  INTEGER NOT NULL DEFAULT 1
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: stock
  // Quantidade de cada produto em cada loja, separada por lote/série.
  // O mesmo barcode pode existir em vários lotes com validades diferentes.
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock (
      id                TEXT PRIMARY KEY,
      product_id        TEXT NOT NULL REFERENCES products(id),
      product_name      TEXT NOT NULL,
      store             TEXT NOT NULL,
      quantity          REAL NOT NULL DEFAULT 0,
      minimum_threshold REAL NOT NULL DEFAULT 10,
      serial_number     TEXT NOT NULL DEFAULT 'SEM-LOTE',
      expiry_date       TEXT,
      created_date      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  ensureStockLotsSchema(db);
  ensureColumn(db, 'stock', 'serial_number', "TEXT NOT NULL DEFAULT 'SEM-LOTE'");
  ensureColumn(db, 'stock', 'expiry_date', 'TEXT');
  ensureColumn(db, 'stock', 'created_date', 'TEXT');

  // ─────────────────────────────────────────────────────────────
  // TABELA: promotions
  // Promoções activas ou agendadas
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS promotions (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      type         TEXT NOT NULL,
      value        REAL NOT NULL,
      applies_to   TEXT NOT NULL,
      target_id    TEXT,
      target_name  TEXT,
      start_date   TEXT NOT NULL,
      end_date     TEXT NOT NULL,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: sales
  // Cabeçalho de cada venda (uma linha por transacção)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id              TEXT PRIMARY KEY,
      store           TEXT NOT NULL,
      total           REAL NOT NULL,
      total_iva       REAL NOT NULL DEFAULT 0,
      payment_method  TEXT NOT NULL,
      amount_paid     REAL NOT NULL DEFAULT 0,
      change_given    REAL NOT NULL DEFAULT 0,
      customer_nif    TEXT,
      cashier_email   TEXT,
      cashier_name    TEXT,
      invoice_number  TEXT,
      document_type   TEXT NOT NULL DEFAULT 'Fatura Simplificada',
      receipt_number  TEXT,
      receipt_text    TEXT,
      receipt_issued_at TEXT,
      status          TEXT NOT NULL DEFAULT 'completed'
                      CHECK(status IN ('completed', 'cancelled')),
      created_date    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  ensureColumn(db, 'sales', 'document_type', "TEXT NOT NULL DEFAULT 'Fatura Simplificada'");
  ensureColumn(db, 'sales', 'receipt_number', 'TEXT');
  ensureColumn(db, 'sales', 'receipt_text', 'TEXT');
  ensureColumn(db, 'sales', 'receipt_issued_at', 'TEXT');

  // ─────────────────────────────────────────────────────────────
  // TABELA: sale_items
  // Linhas de cada venda
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id           TEXT PRIMARY KEY,
      sale_id      TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id   TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity     REAL NOT NULL,
      unit_price   REAL NOT NULL,
      iva_rate     REAL NOT NULL DEFAULT 23,
      subtotal     REAL NOT NULL,
      stock_id     TEXT,
      serial_number TEXT,
      expiry_date  TEXT
    )
  `);
  ensureColumn(db, 'sale_items', 'stock_id', 'TEXT');
  ensureColumn(db, 'sale_items', 'serial_number', 'TEXT');
  ensureColumn(db, 'sale_items', 'expiry_date', 'TEXT');
  ensureSaleReceipts(db);
  removeLotDetailsFromReceipts(db);

  // ─────────────────────────────────────────────────────────────
  // TABELA: shift_closures
  // Fecho de turno do caixa
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_closures (
      id                 TEXT PRIMARY KEY,
      store              TEXT NOT NULL,
      cashier_email      TEXT NOT NULL,
      cashier_name       TEXT,
      shift_date         TEXT NOT NULL,
      start_time         TEXT,
      end_time           TEXT,
      expected_cash      REAL NOT NULL DEFAULT 0,
      counted_cash       REAL NOT NULL DEFAULT 0,
      withdrawn_cash     REAL NOT NULL DEFAULT 0,
      cash_left_in_store REAL NOT NULL DEFAULT 0,
      discrepancy        REAL NOT NULL DEFAULT 0,
      total_sales        REAL NOT NULL DEFAULT 0,
      num_transactions   INTEGER NOT NULL DEFAULT 0,
      status             TEXT NOT NULL DEFAULT 'open'
                         CHECK(status IN ('open', 'pending_approval', 'approved', 'rejected', 'closed')),
      approved_by_email  TEXT,
      approved_by_name   TEXT,
      approved_date      TEXT,
      created_date       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migração automática para bases antigas
  ensureShiftApprovalSchema(db);
  ensureColumn(db, 'shift_closures', 'withdrawn_cash', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'shift_closures', 'cash_left_in_store', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'shift_closures', 'approved_by_email', 'TEXT');
  ensureColumn(db, 'shift_closures', 'approved_by_name', 'TEXT');
  ensureColumn(db, 'shift_closures', 'approved_date', 'TEXT');
  ensureColumn(db, 'shift_closures', 'pos_terminal_id', 'TEXT');
  ensureColumn(db, 'shift_closures', 'opening_expected_cash', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'shift_closures', 'opening_declared_cash', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'shift_closures', 'opening_mismatch', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'shift_closures', 'opened_at', 'TEXT');

  ensureColumn(db, 'sales', 'shift_closure_id', 'TEXT');

  // ─────────────────────────────────────────────────────────────
  // Fundo de abertura por caixa (POS) — definido pelo gerente
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS register_opening_floats (
      id             TEXT PRIMARY KEY,
      store          TEXT NOT NULL,
      terminal_id    TEXT NOT NULL,
      business_date  TEXT NOT NULL,
      opening_float  REAL NOT NULL,
      set_by_email   TEXT,
      set_by_name    TEXT,
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(store, terminal_id, business_date)
    )
  `);

  // Sangrias (retiradas para cofre) — com aprovação do gerente
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_drops (
      id                 TEXT PRIMARY KEY,
      shift_closure_id   TEXT NOT NULL,
      store              TEXT NOT NULL,
      amount             REAL NOT NULL,
      reason             TEXT,
      status             TEXT NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending', 'approved', 'rejected')),
      requested_by_email TEXT,
      requested_by_name  TEXT,
      approved_by_email  TEXT,
      approved_by_name   TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at        TEXT
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: supplier_orders
  // Encomendas a fornecedores
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_orders (
      id            TEXT PRIMARY KEY,
      supplier_id   TEXT REFERENCES suppliers(id),
      supplier_name TEXT,
      store         TEXT NOT NULL,
      total         REAL NOT NULL DEFAULT 0,
      urgency       TEXT NOT NULL DEFAULT 'normal',
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'sent', 'received', 'cancelled')),
      notes         TEXT,
      created_date  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  ensureColumn(db, 'supplier_orders', 'urgency', "TEXT NOT NULL DEFAULT 'normal'");

  // ─────────────────────────────────────────────────────────────
  // TABELA: supplier_order_items
  // Linhas de cada encomenda (normalização do array items)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_order_items (
      id           TEXT PRIMARY KEY,
      order_id     TEXT NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
      product_id   TEXT,
      product_name TEXT NOT NULL,
      quantity     REAL NOT NULL,
      unit_cost    REAL NOT NULL DEFAULT 0,
      serial_number TEXT,
      expiry_date  TEXT
    )
  `);
  ensureColumn(db, 'supplier_order_items', 'serial_number', 'TEXT');
  ensureColumn(db, 'supplier_order_items', 'expiry_date', 'TEXT');

  // ─────────────────────────────────────────────────────────────
  // TABELA: merchandise_entries
  // Entradas de mercadoria (recepção de encomendas)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchandise_entries (
      id                TEXT PRIMARY KEY,
      supplier_id       TEXT REFERENCES suppliers(id),
      supplier_name     TEXT,
      store             TEXT NOT NULL,
      invoice_reference TEXT,
      notes             TEXT,
      created_date      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: merchandise_entry_items
  // Linhas de cada entrada de mercadoria
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchandise_entry_items (
      id           TEXT PRIMARY KEY,
      entry_id     TEXT NOT NULL REFERENCES merchandise_entries(id) ON DELETE CASCADE,
      product_id   TEXT,
      product_name TEXT NOT NULL,
      quantity     REAL NOT NULL,
      serial_number TEXT,
      expiry_date  TEXT
    )
  `);
  ensureColumn(db, 'merchandise_entry_items', 'serial_number', 'TEXT');
  ensureColumn(db, 'merchandise_entry_items', 'expiry_date', 'TEXT');

  ensureProductCategories(db);
  ensureUsersRoleCheck(db);
  ensureStoresFKFix(db);

  // ─────────────────────────────────────────────────────────────
  // TABELA: stores
  // Lojas físicas da cadeia (entidade central — antes só uma string em users.store)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id               TEXT PRIMARY KEY,
      code             TEXT UNIQUE,
      name             TEXT NOT NULL UNIQUE,
      city             TEXT,
      address          TEXT,
      manager_user_id  TEXT REFERENCES users(id),
      status           TEXT NOT NULL DEFAULT 'active'
                       CHECK(status IN ('active', 'inactive')),
      created_date     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Sincroniza tabela stores com a lista de strings já existente em users.store / sales / stock
  const knownStores = db.prepare(`
    SELECT DISTINCT store AS name FROM (
      SELECT store FROM users WHERE store IS NOT NULL AND TRIM(store) != ''
      UNION SELECT store FROM sales WHERE store IS NOT NULL AND TRIM(store) != ''
      UNION SELECT store FROM stock WHERE store IS NOT NULL AND TRIM(store) != ''
    )
  `).all();
  const insertStoreIfMissing = db.prepare(`
    INSERT OR IGNORE INTO stores (id, code, name, status, created_date)
    VALUES (?, ?, ?, 'active', datetime('now'))
  `);
  for (const row of knownStores) {
    if (!row.name || row.name === 'Sede') continue;
    const code = String(row.name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8) || 'LOJA';
    insertStoreIfMissing.run(`store-${code.toLowerCase()}`, code, row.name);
  }

  // ─────────────────────────────────────────────────────────────
  // TABELA: pos_terminals — caixas / POS por loja (dados vêm do seed ou gestão API)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS pos_terminals (
      id          TEXT PRIMARY KEY,
      store       TEXT NOT NULL,
      code        TEXT NOT NULL,
      label       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(store, code)
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: day_closures
  // Fecho operacional do dia (consolida turnos da loja + lock contra novas vendas)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_closures (
      id                  TEXT PRIMARY KEY,
      store               TEXT NOT NULL,
      closure_date        TEXT NOT NULL,
      total_sales         REAL NOT NULL DEFAULT 0,
      total_transactions  INTEGER NOT NULL DEFAULT 0,
      total_discrepancy   REAL NOT NULL DEFAULT 0,
      total_cash_left     REAL NOT NULL DEFAULT 0,
      total_withdrawn     REAL NOT NULL DEFAULT 0,
      shift_count         INTEGER NOT NULL DEFAULT 0,
      closed_by_email     TEXT,
      closed_by_name      TEXT,
      closed_at           TEXT NOT NULL DEFAULT (datetime('now')),
      reopened_at         TEXT,
      reopened_by_email   TEXT,
      notes               TEXT,
      UNIQUE(store, closure_date)
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: sale_returns / sale_return_items
  // Devoluções/anulações parciais de vendas
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_returns (
      id              TEXT PRIMARY KEY,
      sale_id         TEXT NOT NULL REFERENCES sales(id),
      store           TEXT NOT NULL,
      reason          TEXT,
      total_refunded  REAL NOT NULL DEFAULT 0,
      cashier_email   TEXT,
      cashier_name    TEXT,
      created_date    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_return_items (
      id            TEXT PRIMARY KEY,
      return_id     TEXT NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
      sale_item_id  TEXT NOT NULL,
      product_id    TEXT,
      product_name  TEXT NOT NULL,
      quantity      REAL NOT NULL,
      unit_price    REAL NOT NULL,
      iva_rate      REAL NOT NULL DEFAULT 23,
      subtotal      REAL NOT NULL,
      stock_id      TEXT,
      serial_number TEXT,
      expiry_date   TEXT
    )
  `);

  // ─────────────────────────────────────────────────────────────
  // TABELA: audit_logs
  // Registo de eventos críticos (login, vendas, alterações, exportações)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            TEXT PRIMARY KEY,
      actor_id      TEXT,
      actor_email   TEXT,
      actor_role    TEXT,
      action        TEXT NOT NULL,
      entity        TEXT,
      entity_id     TEXT,
      scope         TEXT,
      severity      TEXT NOT NULL DEFAULT 'info'
                    CHECK(severity IN ('info', 'low', 'medium', 'high', 'critical')),
      payload_json  TEXT,
      ip_address    TEXT,
      user_agent    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Coluna applies_to_stores (JSON) em promotions — escopo "todas" ou lista de lojas
  ensureColumn(db, 'promotions', 'applies_to_stores', 'TEXT');

  // ─────────────────────────────────────────────────────────────
  // ÍNDICES para optimização de queries frequentes
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sales_store         ON sales(store);
    CREATE INDEX IF NOT EXISTS idx_sales_date          ON sales(created_date);
    CREATE INDEX IF NOT EXISTS idx_sales_store_date    ON sales(store, created_date);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product  ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_product       ON stock(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_store         ON stock(store);
    CREATE INDEX IF NOT EXISTS idx_stock_lot           ON stock(product_id, store, serial_number, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_stock_expiry        ON stock(expiry_date) WHERE expiry_date IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_stock_store_qty     ON stock(store, quantity, minimum_threshold);
    CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_active     ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_products_name       ON products(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category, is_active);
    CREATE INDEX IF NOT EXISTS idx_promotions_active   ON promotions(is_active, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_promotions_product  ON promotions(target_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_shift_store         ON shift_closures(store);
    CREATE INDEX IF NOT EXISTS idx_shift_date          ON shift_closures(shift_date);
    CREATE INDEX IF NOT EXISTS idx_shift_terminal_open ON shift_closures(store, pos_terminal_id, status);
    CREATE INDEX IF NOT EXISTS idx_sales_shift         ON sales(shift_closure_id);
    CREATE INDEX IF NOT EXISTS idx_register_float_key  ON register_opening_floats(store, business_date);
    CREATE INDEX IF NOT EXISTS idx_cash_drops_shift    ON cash_drops(shift_closure_id);
    CREATE INDEX IF NOT EXISTS idx_pos_terminals_store ON pos_terminals(store, is_active);
    CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_actor         ON audit_logs(actor_email);
    CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_logs(action, created_at);
    CREATE INDEX IF NOT EXISTS idx_day_closures_key    ON day_closures(store, closure_date);
    CREATE INDEX IF NOT EXISTS idx_returns_sale        ON sale_returns(sale_id);
  `);

  // ─────────────────────────────────────────────────────────────
  // FTS5 — pesquisa full-text de produtos (RNF02: < 2s com 10k produtos)
  // ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      id UNINDEXED,
      name,
      barcode UNINDEXED,
      category,
      content='products',
      content_rowid='rowid'
    );
  `);

  // Popular FTS se estiver vazia (primeira execução ou rebuild)
  const ftsCount = db.prepare('SELECT COUNT(*) AS n FROM products_fts').get().n;
  const prodCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').get().n;
  if (ftsCount < prodCount) {
    db.exec(`
      INSERT INTO products_fts(products_fts) VALUES('rebuild');
    `);
  }

  // Triggers para manter FTS sincronizado com a tabela products
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
      INSERT INTO products_fts(rowid, id, name, barcode, category)
        VALUES (new.rowid, new.id, new.name, new.barcode, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, id, name, barcode, category)
        VALUES ('delete', old.rowid, old.id, old.name, old.barcode, old.category);
    END;

    CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, id, name, barcode, category)
        VALUES ('delete', old.rowid, old.id, old.name, old.barcode, old.category);
      INSERT INTO products_fts(rowid, id, name, barcode, category)
        VALUES (new.rowid, new.id, new.name, new.barcode, new.category);
    END;
  `);

  console.log(`✅ Base de dados SQLite inicializada em: ${DB_PATH}`);
  return db;
}

module.exports = { initDB };
