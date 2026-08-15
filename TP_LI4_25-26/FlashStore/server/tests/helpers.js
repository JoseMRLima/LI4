/**
 * Helpers para testes — cria uma BD SQLite em memória isolada por teste.
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = 'flashstore-dev-secret-2025';

function genId() {
  return crypto.randomUUID();
}

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Schema mínimo para os testes
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'cashier',
      store TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE stores (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      address TEXT,
      nif TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE pos_terminals (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      category TEXT NOT NULL DEFAULT 'Geral',
      price REAL NOT NULL,
      iva_rate REAL NOT NULL DEFAULT 23,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_perishable INTEGER NOT NULL DEFAULT 0,
      supplier_id TEXT,
      supplier_name TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE products_fts USING fts5(
      id UNINDEXED, name, barcode UNINDEXED, category,
      content='products', content_rowid='rowid'
    );

    CREATE TABLE stock (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      store TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      minimum_threshold REAL NOT NULL DEFAULT 10,
      serial_number TEXT NOT NULL DEFAULT 'SEM-LOTE',
      expiry_date TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE promotions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      applies_to TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      applies_to_stores TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE shift_closures (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      pos_terminal_id TEXT,
      cashier_email TEXT NOT NULL,
      cashier_name TEXT,
      shift_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      opening_declared_cash REAL DEFAULT 0,
      closing_declared_cash REAL,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE register_opening_floats (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      business_date TEXT NOT NULL,
      opening_float REAL NOT NULL DEFAULT 0,
      set_by TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE cash_drops (
      id TEXT PRIMARY KEY,
      shift_closure_id TEXT NOT NULL,
      store TEXT NOT NULL,
      cashier_email TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE sales (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      shift_closure_id TEXT,
      cashier_email TEXT NOT NULL,
      cashier_name TEXT,
      invoice_number TEXT,
      document_type TEXT DEFAULT 'Fatura Simplificada',
      receipt_number TEXT,
      receipt_text TEXT,
      receipt_issued_at TEXT,
      total REAL NOT NULL DEFAULT 0,
      total_iva REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      amount_paid REAL DEFAULT 0,
      change_given REAL DEFAULT 0,
      customer_nif TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      iva_rate REAL NOT NULL DEFAULT 23,
      subtotal REAL NOT NULL,
      stock_id TEXT,
      serial_number TEXT,
      expiry_date TEXT
    );

    CREATE TABLE sale_returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      store TEXT NOT NULL,
      cashier_email TEXT,
      reason TEXT,
      total_refunded REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE sale_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT,
      quantity REAL NOT NULL,
      refund_amount REAL NOT NULL
    );

    CREATE TABLE supplier_orders (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      store TEXT NOT NULL,
      ordered_by_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE supplier_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT,
      quantity_ordered REAL NOT NULL,
      unit_cost REAL DEFAULT 0
    );

    CREATE TABLE day_closures (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      closure_date TEXT NOT NULL,
      total_sales REAL,
      reopened_at TEXT,
      reopened_by_email TEXT,
      notes TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_email TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      scope TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      payload_json TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      store TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT,
      stock_id TEXT,
      serial_number TEXT,
      expiry_date TEXT,
      days_until_expiry INTEGER,
      quantity REAL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nif TEXT UNIQUE,
      email TEXT,
      phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE daily_stock_snapshots (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      distinct_products INTEGER,
      total_units REAL,
      low_stock_count INTEGER,
      expiring_soon_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed: loja + utilizadores + produto + stock + terminal
  db.prepare(`INSERT INTO stores (id, name, address, nif) VALUES ('s1', 'Braga Centro', 'Rua Teste 1', '999999990')`).run();
  db.prepare(`INSERT INTO pos_terminals (id, store, code, label) VALUES ('t1', 'Braga Centro', 'PDV-01', 'Caixa 1')`).run();

  const adminHash = bcrypt.hashSync('admin123', 8);
  const cashierHash = bcrypt.hashSync('caixa123', 8);
  const managerHash = bcrypt.hashSync('gerente123', 8);

  db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, store) VALUES ('u1', 'admin@flash.pt', ?, 'Admin', 'admin', 'Braga Centro')`).run(adminHash);
  db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, store) VALUES ('u2', 'caixa@flash.pt', ?, 'Caixa João', 'cashier', 'Braga Centro')`).run(cashierHash);
  db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, store) VALUES ('u3', 'gerente@flash.pt', ?, 'Gerente Ana', 'manager', 'Braga Centro')`).run(managerHash);

  db.prepare(`INSERT INTO products (id, name, barcode, category, price, iva_rate) VALUES ('p1', 'Água 1.5L', '5601234567890', 'Bebidas', 0.89, 6)`).run();
  db.prepare(`INSERT INTO products (id, name, barcode, category, price, iva_rate) VALUES ('p2', 'Pão de Forma', '5609876543210', 'Padaria', 1.29, 6)`).run();
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold) VALUES ('st1', 'p1', 'Água 1.5L', 'Braga Centro', 100, 20)`).run();
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold) VALUES ('st2', 'p2', 'Pão de Forma', 'Braga Centro', 5, 20)`).run();

  return db;
}

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, store: user.store, full_name: user.full_name }, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { createTestDb, makeToken, genId, JWT_SECRET };
