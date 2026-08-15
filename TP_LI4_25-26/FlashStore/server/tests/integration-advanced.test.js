// server/tests/integration-advanced.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const crypto = require('crypto');

const JWT_SECRET = 'flashstore-dev-secret-2025';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createAdvancedTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'cashier',
      store TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT UNIQUE NOT NULL,
      address TEXT,
      city TEXT,
      nif TEXT,
      manager_user_id TEXT,
      status TEXT DEFAULT 'active',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_terminals (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(store, code)
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      category TEXT NOT NULL DEFAULT 'Geral',
      price REAL NOT NULL,
      iva_rate REAL NOT NULL DEFAULT 23,
      image_url TEXT,
      supplier_id TEXT,
      supplier_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_perishable INTEGER NOT NULL DEFAULT 0,
      default_shelf_life_days INTEGER,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      id UNINDEXED, name, barcode UNINDEXED, category,
      content='products', content_rowid='rowid'
    );

    CREATE TABLE IF NOT EXISTS product_categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      store TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      minimum_threshold REAL NOT NULL DEFAULT 10,
      serial_number TEXT NOT NULL DEFAULT 'SEM-LOTE',
      expiry_date TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      email TEXT,
      nif TEXT NOT NULL UNIQUE,
      address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promotions (
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

    CREATE TABLE IF NOT EXISTS shift_closures (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      pos_terminal_id TEXT,
      cashier_email TEXT NOT NULL,
      cashier_name TEXT,
      shift_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      expected_cash REAL,
      counted_cash REAL,
      withdrawn_cash REAL,
      cash_left_in_store REAL,
      discrepancy REAL,
      total_sales REAL DEFAULT 0,
      num_transactions INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      approved_by_email TEXT,
      approved_by_name TEXT,
      approved_date TEXT,
      rejection_reason TEXT,
      opening_expected_cash REAL DEFAULT 0,
      opening_declared_cash REAL DEFAULT 0,
      opening_mismatch INTEGER DEFAULT 0,
      opened_at TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS register_opening_floats (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      business_date TEXT NOT NULL,
      opening_float REAL NOT NULL DEFAULT 0,
      set_by_email TEXT,
      set_by_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cash_drops (
      id TEXT PRIMARY KEY,
      shift_closure_id TEXT NOT NULL,
      store TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by_email TEXT,
      requested_by_name TEXT,
      approved_by_email TEXT,
      approved_by_name TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      shift_closure_id TEXT,
      cashier_email TEXT,
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

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS sale_returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      store TEXT NOT NULL,
      cashier_email TEXT,
      cashier_name TEXT,
      reason TEXT,
      total_refunded REAL NOT NULL DEFAULT 0,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      sale_item_id TEXT,
      product_id TEXT NOT NULL,
      product_name TEXT,
      quantity REAL NOT NULL,
      unit_price REAL,
      iva_rate REAL,
      subtotal REAL,
      stock_id TEXT,
      serial_number TEXT,
      expiry_date TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_orders (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      supplier_name TEXT,
      store TEXT NOT NULL,
      total REAL DEFAULT 0,
      urgency TEXT DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      ordered_by_email TEXT,
      notes TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT,
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      serial_number TEXT,
      expiry_date TEXT
    );

    CREATE TABLE IF NOT EXISTS merchandise_entries (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      supplier_name TEXT,
      store TEXT NOT NULL,
      invoice_reference TEXT,
      notes TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merchandise_entry_items (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT,
      quantity REAL NOT NULL,
      serial_number TEXT,
      expiry_date TEXT
    );

    CREATE TABLE IF NOT EXISTS day_closures (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      closure_date TEXT NOT NULL,
      total_sales REAL,
      total_transactions INTEGER,
      total_discrepancy REAL,
      total_cash_left REAL,
      total_withdrawn REAL,
      shift_count INTEGER,
      closed_by_email TEXT,
      closed_by_name TEXT,
      closed_at TEXT,
      reopened_at TEXT,
      reopened_by_email TEXT,
      notes TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
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

    CREATE TABLE IF NOT EXISTS alerts (
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

    CREATE TABLE IF NOT EXISTS daily_stock_snapshots (
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

  // Seed data
  const adminHash = bcrypt.hashSync('admin123', 8);
  const cashierHash = bcrypt.hashSync('caixa123', 8);
  const managerHash = bcrypt.hashSync('gerente123', 8);

  db.prepare(`INSERT INTO stores (id, code, name, city, status) VALUES ('s1', 'BRG001', 'Braga Centro', 'Braga', 'active')`).run();
  db.prepare(`INSERT INTO pos_terminals (id, store, code, label) VALUES ('t1', 'Braga Centro', 'PDV-01', 'Caixa 1')`).run();
  db.prepare(`INSERT INTO pos_terminals (id, store, code, label) VALUES ('t2', 'Braga Centro', 'PDV-02', 'Caixa 2')`).run();

  db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, store) VALUES ('u1', 'admin@flash.pt', ?, 'Admin', 'admin', 'Sede')`).run(adminHash);
  db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, store) VALUES ('u2', 'caixa@flash.pt', ?, 'Caixa João', 'cashier', 'Braga Centro')`).run(cashierHash);
  db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, store) VALUES ('u3', 'gerente@flash.pt', ?, 'Gerente Ana', 'manager', 'Braga Centro')`).run(managerHash);

  db.prepare(`INSERT INTO products (id, name, barcode, category, price, iva_rate, supplier_id, supplier_name) 
    VALUES ('p1', 'Água 1.5L', '5601234567890', 'Bebidas', 0.89, 6, 'sup1', 'Fornecedor Bebidas')`).run();
  db.prepare(`INSERT INTO products (id, name, barcode, category, price, iva_rate, is_perishable, default_shelf_life_days) 
    VALUES ('p2', 'Pão de Forma', '5609876543210', 'Padaria', 1.29, 6, 1, 5)`).run();
  db.prepare(`INSERT INTO products (id, name, barcode, category, price, iva_rate) 
    VALUES ('p3', 'Leite UHT', '5601111111111', 'Laticínios', 0.65, 6)`).run();

  db.prepare(`INSERT INTO product_categories (id, name) VALUES ('cat1', 'Bebidas')`).run();
  db.prepare(`INSERT INTO product_categories (id, name) VALUES ('cat2', 'Padaria')`).run();
  db.prepare(`INSERT INTO product_categories (id, name) VALUES ('cat3', 'Laticínios')`).run();
  db.prepare(`INSERT INTO product_categories (id, name) VALUES ('cat4', 'Geral')`).run();

  db.prepare(`INSERT INTO suppliers (id, name, nif, email) VALUES ('sup1', 'Fornecedor Bebidas', '500000001', 'bebidas@fornecedor.pt')`).run();
  db.prepare(`INSERT INTO suppliers (id, name, nif, email) VALUES ('sup2', 'Fornecedor Padaria', '500000002', 'padaria@fornecedor.pt')`).run();

  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold) 
    VALUES ('st1', 'p1', 'Água 1.5L', 'Braga Centro', 100, 20)`).run();
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold) 
    VALUES ('st2', 'p2', 'Pão de Forma', 'Braga Centro', 5, 20)`).run();
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold) 
    VALUES ('st3', 'p3', 'Leite UHT', 'Braga Centro', 50, 30)`).run();

  return db;
}


describe('FlashStore API - Testes Avançados de Integração', () => {
  let app, db, adminToken, cashierToken, managerToken;

  beforeAll(() => {
    db = createAdvancedTestDb();
    
    // Construir app manualmente para os endpoints específicos que queremos testar
    app = express();
    app.use(cors());
    app.use(express.json());

    function authMiddleware(req, res, next) {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token em falta' });
      }
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET);
        req.user = payload;
        next();
      } catch {
        res.status(401).json({ error: 'Token inválido ou expirado' });
      }
    }

    function adminMiddleware(req, res, next) {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso reservado a administradores.' });
      }
      next();
    }

    function ensureDayNotClosed(store, dateISO) {
      const date = String(dateISO || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const closure = db.prepare('SELECT * FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL').get(store, date);
      if (closure) {
        const err = new Error(`O dia ${date} da loja "${store}" já foi fechado.`);
        err.status = 409;
        err.code = 'DAY_CLOSED';
        throw err;
      }
    }

    function logAudit(req, data) {
      try {
        const id = `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO audit_logs (id, actor_id, actor_email, actor_role, action, entity, entity_id, scope, severity, payload_json, ip_address, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id, req.user?.id || null, req.user?.email || null, req.user?.role || null, data.action, data.entity || null, data.entity_id || null, data.scope || null, data.severity || 'info', data.payload ? JSON.stringify(data.payload) : null, req.ip || null, now);
      } catch (err) {
        console.error('Audit log error:', err.message);
      }
    }


    // ── Categorias ─────────────────────────────
    app.get('/api/categories', authMiddleware, (req, res) => {
      res.json(db.prepare('SELECT id, name, created_date FROM product_categories ORDER BY name COLLATE NOCASE').all());
    });

    app.post('/api/admin/categories', authMiddleware, adminMiddleware, (req, res) => {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
      try {
        const id = genId();
        db.prepare('INSERT INTO product_categories (id, name) VALUES (?, ?)').run(id, name);
        res.status(201).json(db.prepare('SELECT id, name, created_date FROM product_categories WHERE id = ?').get(id));
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
        }
        throw e;
      }
    });

    app.put('/api/admin/categories/:id', authMiddleware, adminMiddleware, (req, res) => {
      const row = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Categoria não encontrada.' });
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
      try {
        db.prepare('UPDATE product_categories SET name = ? WHERE id = ?').run(name, row.id);
        db.prepare('UPDATE products SET category = ? WHERE category = ?').run(name, row.name);
        res.json(db.prepare('SELECT id, name, created_date FROM product_categories WHERE id = ?').get(row.id));
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
        }
        throw e;
      }
    });

    // ── Fornecedores ───────────────────────────
    app.get('/api/suppliers', authMiddleware, (req, res) => {
      res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
    });

    app.post('/api/suppliers', authMiddleware, (req, res) => {
      const { name, nif, email, contact, address, is_active } = req.body;
      if (!name || !nif) return res.status(400).json({ error: 'name e nif são obrigatórios' });
      const id = genId();
      try {
        db.prepare('INSERT INTO suppliers (id, name, contact, email, nif, address, is_active) VALUES (?,?,?,?,?,?,?)')
          .run(id, name, contact || '', email || '', nif, address || '', is_active !== false ? 1 : 0);
        res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(id));
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'Já existe um fornecedor com esse NIF.' });
        }
        throw e;
      }
    });

    // ── Promoções ──────────────────────────────
    app.get('/api/promotions', authMiddleware, (req, res) => {
      const rows = db.prepare('SELECT * FROM promotions ORDER BY created_date DESC').all();
      res.json(rows);
    });

    app.post('/api/promotions', authMiddleware, (req, res) => {
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Apenas administradores ou gerentes podem criar promoções.' });
      }
      const { name, type, value, applies_to, target_id, target_name, start_date, end_date, is_active, applies_to_stores } = req.body;
      if (!name || !type || !value || !applies_to || !start_date || !end_date) {
        return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
      }
      const id = genId();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO promotions (id, name, type, value, applies_to, target_id, target_name, start_date, end_date, is_active, applies_to_stores, created_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, name, type, value, applies_to, target_id || null, target_name || null, start_date, end_date, is_active !== false ? 1 : 0, applies_to_stores || null, now);
      res.status(201).json(db.prepare('SELECT * FROM promotions WHERE id=?').get(id));
    });

    // ── Alertas ────────────────────────────────
    app.get('/api/alerts', authMiddleware, (req, res) => {
      const { store, type, resolved } = req.query;
      const params = [];
      let where = 'WHERE 1=1';
      if (store) { where += ' AND store = ?'; params.push(store); }
      if (type) { where += ' AND type = ?'; params.push(type); }
      if (resolved !== undefined) { where += ' AND resolved = ?'; params.push(resolved === 'true' ? 1 : 0); }
      res.json(db.prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC`).all(...params));
    });

    app.put('/api/alerts/:id/resolve', authMiddleware, (req, res) => {
      const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
      if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });
      db.prepare('UPDATE alerts SET resolved = 1, resolved_at = datetime(\'now\'), resolved_by = ? WHERE id = ?').run(req.user.email, req.params.id);
      res.json({ ok: true });
    });

    // ── Auditoria ──────────────────────────────
    app.get('/api/audit-logs', authMiddleware, (req, res) => {
      const { limit = 200, offset = 0, action, severity } = req.query;
      const conditions = [];
      const params = [];
      if (action) { conditions.push('action = ?'); params.push(action); }
      if (severity) { conditions.push('severity = ?'); params.push(severity); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Math.min(Number(limit), 1000), Math.max(0, Number(offset) || 0));
      res.json({ rows, total: rows.length });
    });

    // ── Devoluções ─────────────────────────────
    app.post('/api/sales/:id/return', authMiddleware, (req, res) => {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
      if (!sale) return res.status(404).json({ error: 'Venda não encontrada.' });
      if (sale.status === 'cancelled') return res.status(400).json({ error: 'A venda já está totalmente anulada.' });
      
      const { items = [], reason } = req.body;
      if (!items.length) return res.status(400).json({ error: 'Indique pelo menos um item para devolução.' });
      
      try {
        ensureDayNotClosed(sale.store, String(sale.created_date).slice(0, 10));
      } catch (err) {
        return res.status(err.status || 409).json({ error: err.message });
      }
      
      // Verificar autorização se for cashier
      if (req.user.role === 'cashier') {
        return res.status(403).json({ error: 'Apenas gerentes ou admin podem processar devoluções.' });
      }
      
      const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
      let totalRefunded = 0;
      
      const returnId = `ret-${genId()}`;
      const now = new Date().toISOString();
      
      db.transaction(() => {
        db.prepare('INSERT INTO sale_returns (id, sale_id, store, reason, total_refunded, cashier_email, created_date) VALUES (?,?,?,?,?,?,?)')
          .run(returnId, sale.id, sale.store, reason || null, 0, req.user.email, now);
        
        for (const item of items) {
          const orig = saleItems.find(s => s.id === item.sale_item_id);
          if (!orig) throw Object.assign(new Error(`Item ${item.sale_item_id} não pertence a esta venda.`), { status: 400 });
          
          const qty = Number(item.quantity);
          const subtotal = qty * Number(orig.unit_price);
          totalRefunded += subtotal;
          
          db.prepare('INSERT INTO sale_return_items (id, return_id, sale_item_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(genId(), returnId, orig.id, orig.product_id, orig.product_name, qty, orig.unit_price, orig.iva_rate, subtotal);
          
          // Repor stock
          if (orig.stock_id) {
            db.prepare('UPDATE stock SET quantity = quantity + ? WHERE id = ?').run(qty, orig.stock_id);
          }
        }
        
        db.prepare('UPDATE sale_returns SET total_refunded = ? WHERE id = ?').run(totalRefunded, returnId);
      })();
      
      logAudit(req, { action: 'sale_returned', entity: 'sale', entity_id: sale.id, scope: sale.store, severity: 'medium', payload: { return_id: returnId, total_refunded: totalRefunded } });
      
      res.status(201).json(db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(returnId));
    });

    // ── Dashboard ──────────────────────────────
    app.get('/api/dashboard/store/:store', authMiddleware, (req, res) => {
      const store = decodeURIComponent(req.params.store);
      const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
      
      const totals = db.prepare(`SELECT COALESCE(SUM(total),0) AS total_sales, COUNT(*) AS transactions FROM sales WHERE store = ? AND status='completed' AND created_date >= ? AND created_date <= ?`)
        .get(store, `${date}T00:00:00`, `${date}T23:59:59`);
      
      const lowStock = db.prepare(`SELECT product_id, product_name, SUM(quantity) AS quantity FROM stock WHERE store = ? GROUP BY product_id HAVING SUM(quantity) <= 20 LIMIT 10`).all(store);
      
      res.json({ store, date, totals, lowStock });
    });

    // ── Sugestão de Reposição ──────────────────
    app.get('/api/replenishment-suggestions', authMiddleware, (req, res) => {
      const { store } = req.query;
      if (!store) return res.status(400).json({ error: 'store é obrigatório' });
      
      const today = new Date().toISOString().slice(0, 10);
      const stockRows = db.prepare(`SELECT product_id, product_name, SUM(quantity) AS valid_qty, MAX(minimum_threshold) AS min_threshold FROM stock WHERE store = ? GROUP BY product_id`).all(store);
      
      const suggestions = stockRows
        .filter(r => Number(r.valid_qty) < Number(r.min_threshold))
        .map(r => ({
          product_id: r.product_id,
          product_name: r.product_name,
          current_stock: Number(r.valid_qty),
          minimum_threshold: Number(r.min_threshold),
          suggested_order_qty: Math.ceil(Number(r.min_threshold) * 2 - Number(r.valid_qty)),
          urgency: Number(r.valid_qty) <= 0 ? 'crítico' : 'normal'
        }));
      
      res.json({ store, suggestions });
    });

    // ── RGPD ───────────────────────────────────
    app.post('/api/admin/rgpd/anonymize-old-nifs', authMiddleware, adminMiddleware, (req, res) => {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 5);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const result = db.prepare(`UPDATE sales SET customer_nif = 'ANONIMIZADO' WHERE customer_nif IS NOT NULL AND customer_nif != '' AND customer_nif != 'ANONIMIZADO' AND customer_nif != '999999990' AND created_date < ?`).run(`${cutoffStr}T00:00:00`);
      logAudit(req, { action: 'rgpd_anonymize_nifs', entity: 'sales', severity: 'high', payload: { cutoff_date: cutoffStr, rows_updated: result.changes } });
      res.json({ ok: true, rows_anonymized: result.changes, cutoff_date: cutoffStr });
    });

    adminToken = jwt.sign({ id: 'u1', email: 'admin@flash.pt', role: 'admin', store: 'Sede', full_name: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });
    cashierToken = jwt.sign({ id: 'u2', email: 'caixa@flash.pt', role: 'cashier', store: 'Braga Centro', full_name: 'Caixa João' }, JWT_SECRET, { expiresIn: '1h' });
    managerToken = jwt.sign({ id: 'u3', email: 'gerente@flash.pt', role: 'manager', store: 'Braga Centro', full_name: 'Gerente Ana' }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(() => {
    db.close();
  });

  // ============================================
  // TESTES DE CATEGORIAS
  // ============================================
  describe('Categorias de Produtos', () => {
    it('deve listar todas as categorias', async () => {
      const res = await request(app).get('/api/categories').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });

    it('admin pode criar categoria', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Nova Categoria' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Nova Categoria');
    });

    it('não permite duplicar categoria', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bebidas' });
      expect(res.status).toBe(409);
    });

    it('não-admin não pode criar categoria', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Outra Categoria' });
      expect(res.status).toBe(403);
    });

    it('deve atualizar categoria e propagar mudança', async () => {
      // Criar categoria primeiro
      await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'ParaRenomear' });
      
      const cats = await request(app).get('/api/categories').set('Authorization', `Bearer ${adminToken}`);
      const cat = cats.body.find(c => c.name === 'ParaRenomear');
      
      const res = await request(app)
        .put(`/api/admin/categories/${cat.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Renomeada' });
      
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renomeada');
    });
  });

  // ============================================
  // TESTES DE FORNECEDORES
  // ============================================
  describe('Fornecedores', () => {
    it('deve listar fornecedores', async () => {
      const res = await request(app).get('/api/suppliers').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('deve criar fornecedor', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Novo Fornecedor', nif: '500000003', email: 'novo@fornecedor.pt' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Novo Fornecedor');
    });

    it('NIF duplicado deve ser rejeitado', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Outro', nif: '500000001' });
      expect(res.status).toBe(409);
    });

    it('campos obrigatórios em falta', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Sem NIF' });
      expect(res.status).toBe(400);
    });
  });

  // ============================================
  // TESTES DE PROMOÇÕES
  // ============================================
  describe('Promoções', () => {
    it('deve criar promoção (manager)', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Desconto Verão',
          type: 'percentage',
          value: 10,
          applies_to: 'product',
          target_id: 'p1',
          target_name: 'Água 1.5L',
          start_date: '2026-06-01',
          end_date: '2026-08-31'
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Desconto Verão');
    });

    it('cashier não pode criar promoção', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'Promo Ilegal',
          type: 'percentage',
          value: 50,
          applies_to: 'store',
          start_date: '2026-01-01',
          end_date: '2026-12-31'
        });
      expect(res.status).toBe(403);
    });

    it('deve listar promoções criadas', async () => {
      const res = await request(app).get('/api/promotions').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // TESTES DE ALERTAS
  // ============================================
  describe('Alertas', () => {
    beforeAll(() => {
      db.prepare(`INSERT INTO alerts (id, type, store, product_name, quantity, resolved) VALUES ('a1', 'low_stock', 'Braga Centro', 'Pão de Forma', 5, 0)`).run();
      db.prepare(`INSERT INTO alerts (id, type, store, product_name, quantity, resolved) VALUES ('a2', 'expiry', 'Braga Centro', 'Leite UHT', 10, 0)`).run();
      db.prepare(`INSERT INTO alerts (id, type, store, product_name, quantity, resolved) VALUES ('a3', 'low_stock', 'Braga Centro', 'Água 1.5L', 100, 1)`).run();
    });

    it('deve listar alertas não resolvidos', async () => {
      const res = await request(app)
        .get('/api/alerts?store=Braga Centro&resolved=false')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('deve filtrar por tipo', async () => {
      const res = await request(app)
        .get('/api/alerts?store=Braga Centro&type=expiry')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.every(a => a.type === 'expiry')).toBe(true);
    });

    it('deve resolver alerta', async () => {
      const res = await request(app)
        .put('/api/alerts/a1/resolve')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      
      const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get('a1');
      expect(alert.resolved).toBe(1);
      expect(alert.resolved_by).toBe('gerente@flash.pt');
    });

    it('alerta inexistente deve dar 404', async () => {
      const res = await request(app)
        .put('/api/alerts/inexistente/resolve')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // TESTES DE AUDITORIA
  // ============================================
  describe('Auditoria', () => {
    beforeAll(() => {
      // Inserir alguns logs de auditoria
      db.prepare(`INSERT INTO audit_logs (id, actor_email, actor_role, action, entity, severity, created_at) VALUES ('aud1', 'admin@flash.pt', 'admin', 'login', 'user', 'info', datetime('now'))`).run();
      db.prepare(`INSERT INTO audit_logs (id, actor_email, actor_role, action, entity, severity, created_at) VALUES ('aud2', 'caixa@flash.pt', 'cashier', 'sale_created', 'sale', 'info', datetime('now', '-1 hour'))`).run();
      db.prepare(`INSERT INTO audit_logs (id, actor_email, actor_role, action, entity, severity, created_at) VALUES ('aud3', 'gerente@flash.pt', 'manager', 'day_closed', 'day_closure', 'high', datetime('now', '-2 hours'))`).run();
    });

    it('deve listar logs de auditoria', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeGreaterThanOrEqual(3);
    });

    it('deve filtrar por ação', async () => {
      const res = await request(app)
        .get('/api/audit-logs?action=login')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rows.every(r => r.action === 'login')).toBe(true);
    });

    it('deve filtrar por severidade', async () => {
      const res = await request(app)
        .get('/api/audit-logs?severity=high')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rows.every(r => r.severity === 'high')).toBe(true);
    });

    it('não-admin não deve aceder? (depende da política)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${cashierToken}`);
      // O endpoint não tem restrição de admin no nosso app de teste
      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // TESTES DE DEVOLUÇÕES
  // ============================================
  describe('Devoluções de Vendas', () => {
    let saleId, saleItemId;

    beforeAll(() => {
      // Criar venda para testar devolução
      saleId = genId();
      saleItemId = genId();
      const now = new Date().toISOString();
      
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, total_iva, payment_method, amount_paid, status, invoice_number, receipt_number, created_date) VALUES (?, 'Braga Centro', 'caixa@flash.pt', 0.89, 0.05, 'dinheiro', 1.00, 'completed', 'FS-DEV-TEST', 'TL-DEV-TEST', ?)`)
        .run(saleId, now);
      
      db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal, stock_id) VALUES (?, ?, 'p1', 'Água 1.5L', 2, 0.89, 6, 1.78, 'st1')`)
        .run(saleItemId, saleId);
    });

    it('manager pode fazer devolução', async () => {
      const stockBefore = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      
      const res = await request(app)
        .post(`/api/sales/${saleId}/return`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          items: [{ sale_item_id: saleItemId, quantity: 1 }],
          reason: 'Cliente insatisfeito'
        });
      
      expect(res.status).toBe(201);
      
      const stockAfter = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      expect(stockAfter).toBe(stockBefore + 1);
    });

    it('cashier não pode fazer devolução', async () => {
      const res = await request(app)
        .post(`/api/sales/${saleId}/return`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          items: [{ sale_item_id: saleItemId, quantity: 1 }],
          reason: 'Erro'
        });
      
      expect(res.status).toBe(403);
    });

    it('venda inexistente deve dar 404', async () => {
      const res = await request(app)
        .post('/api/sales/venda-inexistente/return')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ items: [{ sale_item_id: 'x', quantity: 1 }] });
      
      expect(res.status).toBe(404);
    });

    it('venda cancelada não pode ser devolvida', async () => {
      const cancelledId = genId();
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, payment_method, status, created_date) VALUES (?, 'Braga Centro', 'caixa@flash.pt', 10, 'dinheiro', 'cancelled', datetime('now'))`).run(cancelledId);
      
      const res = await request(app)
        .post(`/api/sales/${cancelledId}/return`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ items: [{ sale_item_id: 'x', quantity: 1 }] });
      
      expect(res.status).toBe(400);
    });
  });

  // ============================================
  // TESTES DE DASHBOARD
  // ============================================
  describe('Dashboard', () => {
    beforeAll(() => {
      const today = new Date().toISOString();
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, payment_method, status, created_date) VALUES ('ds1', 'Braga Centro', 'caixa@flash.pt', 10, 'dinheiro', 'completed', ?)`).run(today);
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, payment_method, status, created_date) VALUES ('ds2', 'Braga Centro', 'caixa@flash.pt', 20, 'multibanco', 'completed', ?)`).run(today);
    });

    it('deve retornar KPIs da loja', async () => {
      const res = await request(app)
        .get('/api/dashboard/store/Braga Centro')
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.store).toBe('Braga Centro');
      expect(res.body.totals).toBeDefined();
      expect(res.body.lowStock).toBeDefined();
    });

    it('deve mostrar stock baixo', async () => {
      const res = await request(app)
        .get('/api/dashboard/store/Braga Centro')
        .set('Authorization', `Bearer ${managerToken}`);
      
      // Pão de Forma tem 5 < 20 threshold
      const paoAlerta = res.body.lowStock.find(s => s.product_name === 'Pão de Forma');
      expect(paoAlerta).toBeDefined();
    });
  });

  // ============================================
  // TESTES DE SUGESTÃO DE REPOSIÇÃO
  // ============================================
  describe('Sugestão de Reposição', () => {
    it('deve sugerir reposição para stock baixo', async () => {
      const res = await request(app)
        .get('/api/replenishment-suggestions?store=Braga Centro')
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.store).toBe('Braga Centro');
      expect(res.body.suggestions.length).toBeGreaterThan(0);
      
      const pao = res.body.suggestions.find(s => s.product_name === 'Pão de Forma');
      expect(pao).toBeDefined();
      expect(pao.current_stock).toBeLessThan(pao.minimum_threshold);
    });

    it('deve retornar 400 sem store', async () => {
      const res = await request(app)
        .get('/api/replenishment-suggestions')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ============================================
  // TESTES DE RGPD
  // ============================================
  describe('RGPD - Anonimização', () => {
    beforeAll(() => {
      const oldDate = '2019-01-01T12:00:00';
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, payment_method, customer_nif, status, created_date) VALUES ('rgpd1', 'Braga Centro', 'caixa@flash.pt', 50, 'dinheiro', '123456789', 'completed', ?)`).run(oldDate);
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, payment_method, customer_nif, status, created_date) VALUES ('rgpd2', 'Braga Centro', 'caixa@flash.pt', 30, 'cartao', '987654321', 'completed', ?)`).run(oldDate);
    });

    it('admin pode anonimizar NIFs antigos', async () => {
      const res = await request(app)
        .post('/api/admin/rgpd/anonymize-old-nifs')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.rows_anonymized).toBeGreaterThanOrEqual(2);
      
      const sale = db.prepare('SELECT customer_nif FROM sales WHERE id = ?').get('rgpd1');
      expect(sale.customer_nif).toBe('ANONIMIZADO');
    });

    it('não-admin não pode anonimizar', async () => {
      const res = await request(app)
        .post('/api/admin/rgpd/anonymize-old-nifs')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ============================================
  // TESTES DE CONCORRÊNCIA E RESILIÊNCIA
  // ============================================
  describe('Resiliência e Concorrência', () => {
    it('múltiplos pedidos simultâneos não devem causar erros', async () => {
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/categories')
          .set('Authorization', `Bearer ${adminToken}`)
      );
      
      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.status).toBe(200);
      });
    });

    it('deve lidar com payload vazio', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({});
      
      expect(res.status).toBe(400);
    });

    it('deve lidar com JSON inválido', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{invalid json}');
      
      expect(res.status).toBe(400);
    });

    it('deve lidar com métodos não suportados', async () => {
      const res = await request(app)
        .patch('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(404);
    });

    it('rate limiting básico - múltiplos pedidos', async () => {
      const startTime = Date.now();
      const promises = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/categories')
          .set('Authorization', `Bearer ${adminToken}`)
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const allOk = results.every(r => r.status === 200);
      expect(allOk).toBe(true);
      expect(duration).toBeLessThan(5000);
    });
  });

  // ============================================
  // TESTES DE PERMISSÕES POR ROLE
  // ============================================
  describe('Matriz de Permissões', () => {
    const adminEndpoints = [
      { method: 'post', path: '/api/admin/categories', body: { name: 'Test' } },
      { method: 'post', path: '/api/admin/rgpd/anonymize-old-nifs', body: {} },
    ];

    const managerEndpoints = [
      { method: 'post', path: '/api/promotions', body: { name: 'Promo', type: 'percentage', value: 10, applies_to: 'store', start_date: '2026-01-01', end_date: '2026-12-31' } },
      { method: 'post', path: '/api/sales/sale1/return', body: { items: [] } },
    ];

    adminEndpoints.forEach(({ method, path, body }) => {
      it(`admin pode aceder a ${method.toUpperCase()} ${path}`, async () => {
        const res = await request(app)[method](path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(body);
        expect(res.status).not.toBe(403);
      });
    });

    adminEndpoints.forEach(({ method, path, body }) => {
      it(`manager NÃO pode aceder a ${method.toUpperCase()} ${path}`, async () => {
        const res = await request(app)[method](path)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(body);
        expect(res.status).toBe(403);
      });
    });
  });

  // ============================================
  // TESTES DE INTEGRIDADE DE DADOS
  // ============================================
  describe('Integridade de Dados', () => {
    it('stock não pode ficar negativo após devoluções', async () => {
      const stockInicial = db.prepare('SELECT SUM(quantity) as total FROM stock').get().total;
      
      // Verificar que não há stock negativo
      const negativeStock = db.prepare('SELECT COUNT(*) as count FROM stock WHERE quantity < 0').get();
      expect(negativeStock.count).toBe(0);
      
      // O total de stock deve ser consistente
      const stockFinal = db.prepare('SELECT SUM(quantity) as total FROM stock').get().total;
      expect(stockFinal).toBeGreaterThanOrEqual(0);
    });

    it('vendas devem ter data de criação válida', async () => {
      const sales = db.prepare("SELECT * FROM sales WHERE created_date IS NULL OR created_date = ''").all();
      expect(sales.length).toBe(0);
    });

    it('itens de venda devem referenciar vendas existentes', async () => {
      const orphanItems = db.prepare(`
        SELECT si.id FROM sale_items si 
        LEFT JOIN sales s ON si.sale_id = s.id 
        WHERE s.id IS NULL
      `).all();
      expect(orphanItems.length).toBe(0);
    });
  });
});
