/**
 * FlashStore — Testes de Aceitação
 * Validam os fluxos completos de utilização da aplicação por perfil (caixa, gerente, admin).
 * Usam BD SQLite em memória isolada — não requerem servidor em execução.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { createTestDb, makeToken, JWT_SECRET } = require('./helpers.js');

// ─────────────────────────────────────────────
// App Express mínima reutilizando a lógica real
// ─────────────────────────────────────────────
function buildApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  function genId() { return crypto.randomUUID(); }
  function todayISODate() { return new Date().toISOString().slice(0, 10); }

  function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token obrigatório' });
    try {
      req.user = jwt.verify(auth.slice(7), JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido' });
    }
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Acesso negado' });
      next();
    };
  }

  function allocateStockForSale({ productId, store, requestedQuantity }) {
    const lots = db.prepare(`
      SELECT * FROM stock WHERE product_id = ? AND store = ? AND quantity > 0
        AND (expiry_date IS NULL OR expiry_date >= date('now'))
      ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC
    `).all(productId, store);
    let rem = Number(requestedQuantity);
    const allocs = [];
    for (const lot of lots) {
      if (rem <= 0) break;
      const take = Math.min(Number(lot.quantity), rem);
      allocs.push({ lot, quantity: take });
      rem -= take;
    }
    if (rem > 0) { const e = new Error('Stock insuficiente'); e.status = 409; throw e; }
    return allocs;
  }

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, store: user.store, full_name: user.full_name }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, store: user.store } });
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, email, full_name, role, store FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  });

  // Produtos
  app.get('/api/products', authMiddleware, (req, res) => {
    const { q, barcode } = req.query;
    if (barcode) {
      const row = db.prepare('SELECT * FROM products WHERE barcode = ? AND is_active = 1').get(barcode);
      return res.json(row ? [row] : []);
    }
    if (q) {
      return res.json(db.prepare('SELECT * FROM products WHERE name LIKE ? AND is_active = 1 LIMIT 50').all(`%${q}%`));
    }
    res.json(db.prepare('SELECT * FROM products ORDER BY name').all());
  });

  // Stock
  app.get('/api/stock', authMiddleware, (req, res) => {
    const { store } = req.query;
    res.json(store
      ? db.prepare('SELECT * FROM stock WHERE store = ?').all(store)
      : db.prepare('SELECT * FROM stock').all());
  });

  // Turnos
  app.post('/api/shift-closures/open', authMiddleware, requireRole('cashier'), (req, res) => {
    const { store, pos_terminal_id, opening_declared_cash, shift_date } = req.body;
    if (!store || !pos_terminal_id || opening_declared_cash === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
    }
    const open = db.prepare('SELECT id FROM shift_closures WHERE store = ? AND pos_terminal_id = ? AND status = ?').get(store, pos_terminal_id, 'open');
    if (open) return res.status(409).json({ error: 'Já existe turno aberto neste terminal.' });

    const id = `sh-${genId()}`;
    db.prepare(`
      INSERT INTO shift_closures (id, store, pos_terminal_id, cashier_email, cashier_name, shift_date, opening_declared_cash, status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(id, store, pos_terminal_id, req.user.email, req.user.full_name, shift_date || todayISODate(), Number(opening_declared_cash), new Date().toISOString());
    res.status(201).json(db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(id));
  });

  app.get('/api/shift-closures/my-open', authMiddleware, (req, res) => {
    const { store } = req.query;
    const row = db.prepare('SELECT * FROM shift_closures WHERE store = ? AND cashier_email = ? AND status = ? ORDER BY created_date DESC LIMIT 1').get(store, req.user.email, 'open');
    res.json(row || null);
  });

  app.post('/api/shift-closures/:id/close', authMiddleware, requireRole('cashier'), (req, res) => {
    const shift = db.prepare('SELECT * FROM shift_closures WHERE id = ? AND status = ?').get(req.params.id, 'open');
    if (!shift) return res.status(404).json({ error: 'Turno não encontrado ou já fechado.' });
    const { closing_declared_cash } = req.body;
    db.prepare('UPDATE shift_closures SET status = ?, end_time = ?, closing_declared_cash = ? WHERE id = ?')
      .run('pending_approval', new Date().toISOString(), closing_declared_cash ?? 0, req.params.id);
    res.json(db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(req.params.id));
  });

  // Vendas
  app.post('/api/sales', authMiddleware, (req, res) => {
    const { store, items, total, total_iva, payment_method, amount_paid, change_given, customer_nif, shift_closure_id } = req.body;
    if (!store || !items?.length || total == null || !payment_method) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
    }
    const saleId = genId();
    const now = new Date().toISOString();
    try {
      db.transaction(() => {
        db.prepare(`
          INSERT INTO sales (id, store, shift_closure_id, cashier_email, invoice_number, receipt_number,
            total, total_iva, payment_method, amount_paid, change_given, customer_nif, status, created_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
        `).run(saleId, store, shift_closure_id || null, req.user.email, `FS-${Date.now()}`, `TL-${Date.now()}`,
          total, total_iva || 0, payment_method, amount_paid || total, change_given || 0, customer_nif || '', now);
        for (const item of items) {
          const allocs = allocateStockForSale({ productId: item.product_id, store, requestedQuantity: item.quantity });
          for (const { lot, quantity } of allocs) {
            db.prepare('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal, stock_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(genId(), saleId, item.product_id, item.product_name, quantity, item.unit_price, item.iva_rate || 23, quantity * item.unit_price, lot.id);
            db.prepare('UPDATE stock SET quantity = quantity - ? WHERE id = ?').run(quantity, lot.id);
          }
        }
      })();
      res.status(201).json(db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/sales', authMiddleware, (req, res) => {
    const { store } = req.query;
    res.json(store
      ? db.prepare('SELECT * FROM sales WHERE store = ? ORDER BY created_date DESC').all(store)
      : db.prepare('SELECT * FROM sales ORDER BY created_date DESC').all());
  });

  // Promoções (gerente/admin)
  app.get('/api/promotions', authMiddleware, (req, res) => {
    res.json(db.prepare('SELECT * FROM promotions ORDER BY created_date DESC').all());
  });

  app.post('/api/promotions', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const { name, type, value, applies_to, start_date, end_date } = req.body;
    if (!name || !type || value == null || !applies_to || !start_date || !end_date) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
    }
    const id = genId();
    db.prepare(`
      INSERT INTO promotions (id, name, type, value, applies_to, start_date, end_date, is_active, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, name, type, value, applies_to, start_date, end_date, new Date().toISOString());
    res.status(201).json(db.prepare('SELECT * FROM promotions WHERE id = ?').get(id));
  });

  // Encomendas (gerente/admin)
  app.get('/api/supplier-orders', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    res.json(db.prepare('SELECT * FROM supplier_orders ORDER BY created_date DESC').all());
  });

  // Utilizadores (admin)
  app.get('/api/users', authMiddleware, requireRole('admin'), (req, res) => {
    res.json(db.prepare('SELECT id, email, full_name, role, store, is_active FROM users').all());
  });

  // Auditoria (admin)
  app.get('/api/admin/audit-logs', authMiddleware, requireRole('admin'), (req, res) => {
    res.json(db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all());
  });

  // RGPD (admin)
  app.post('/api/admin/rgpd/anonymize-old-nifs', authMiddleware, requireRole('admin'), (req, res) => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 5);
    const result = db.prepare(`UPDATE sales SET customer_nif = 'ANONIMIZADO' WHERE customer_nif != '' AND customer_nif IS NOT NULL AND created_date < ?`).run(cutoff.toISOString());
    res.json({ anonymized: result.changes });
  });

  // Dashboard (gerente/admin)
  app.get('/api/dashboard/kpis', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const { store } = req.query;
    const totalSales = db.prepare('SELECT COUNT(*) as count, SUM(total) as revenue FROM sales WHERE store = ? AND status = ?').get(store, 'completed');
    const lowStock = db.prepare('SELECT COUNT(*) as count FROM stock WHERE store = ? AND quantity < minimum_threshold').get(store);
    res.json({ total_sales: totalSales.count, revenue: totalSales.revenue || 0, low_stock_items: lowStock.count });
  });

  // Alertas
  app.get('/api/alerts', authMiddleware, (req, res) => {
    const { store, type } = req.query;
    let q = 'SELECT * FROM alerts WHERE resolved = 0';
    const params = [];
    if (store) { q += ' AND store = ?'; params.push(store); }
    if (type)  { q += ' AND type = ?';  params.push(type);  }
    res.json(db.prepare(q).all(...params));
  });

  app.patch('/api/alerts/:id/resolve', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });
    db.prepare('UPDATE alerts SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?')
      .run(new Date().toISOString(), req.user.email, req.params.id);
    res.json(db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id));
  });

  // Devoluções (manager/admin)
  app.post('/api/sales/:id/return', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });
    if (sale.status === 'cancelled') return res.status(409).json({ error: 'Venda já cancelada' });
    const { reason, items } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Itens de devolução obrigatórios' });
    const totalRefunded = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const returnId = genId();
    db.transaction(() => {
      db.prepare(`INSERT INTO sale_returns (id, sale_id, store, cashier_email, reason, total_refunded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(returnId, sale.id, sale.store, req.user.email, reason || '', totalRefunded, new Date().toISOString());
      for (const item of items) {
        db.prepare('INSERT INTO sale_return_items (id, return_id, product_id, product_name, quantity, refund_amount) VALUES (?, ?, ?, ?, ?, ?)')
          .run(genId(), returnId, item.product_id, item.product_name, item.quantity, item.quantity * item.unit_price);
        if (item.stock_id) {
          db.prepare('UPDATE stock SET quantity = quantity + ? WHERE id = ?').run(item.quantity, item.stock_id);
        }
      }
      db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('cancelled', sale.id);
    })();
    res.status(201).json({ return_id: returnId, total_refunded: totalRefunded });
  });

  // Sugestões de reposição
  app.get('/api/replenishment-suggestions', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const { store } = req.query;
    if (!store) return res.status(400).json({ error: 'store obrigatório' });
    const suggestions = db.prepare(`
      SELECT s.product_id, s.product_name, SUM(s.quantity) as total_qty, s.minimum_threshold
      FROM stock s WHERE s.store = ? GROUP BY s.product_id
      HAVING total_qty < s.minimum_threshold
    `).all(store);
    res.json(suggestions);
  });

  // Fecho de dia
  app.post('/api/day-closures', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const { store, closure_date } = req.body;
    if (!store || !closure_date) return res.status(400).json({ error: 'store e closure_date obrigatórios' });
    const existing = db.prepare('SELECT id FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL').get(store, closure_date);
    if (existing) return res.status(409).json({ error: 'Dia já fechado' });
    const totalSales = db.prepare('SELECT SUM(total) as t FROM sales WHERE store = ? AND created_date LIKE ?').get(store, `${closure_date}%`);
    const id = genId();
    db.prepare('INSERT INTO day_closures (id, store, closure_date, total_sales, created_date) VALUES (?, ?, ?, ?, ?)')
      .run(id, store, closure_date, totalSales.t || 0, new Date().toISOString());
    res.status(201).json(db.prepare('SELECT * FROM day_closures WHERE id = ?').get(id));
  });

  // Fornecedores (manager/admin)
  app.get('/api/suppliers', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
  });

  app.post('/api/suppliers', authMiddleware, requireRole('manager', 'admin'), (req, res) => {
    const { name, nif, email, phone } = req.body;
    if (!name || !nif) return res.status(400).json({ error: 'name e nif obrigatórios' });
    const dup = db.prepare('SELECT id FROM suppliers WHERE nif = ?').get(nif);
    if (dup) return res.status(409).json({ error: 'NIF duplicado' });
    const id = genId();
    db.prepare('INSERT INTO suppliers (id, name, nif, email, phone, created_date) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, nif, email || '', phone || '', new Date().toISOString());
    res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id));
  });

  return app;
}

// ─────────────────────────────────────────────
// Testes de Aceitação
// ─────────────────────────────────────────────
describe('FlashStore — Testes de Aceitação', () => {
  let app, db;
  let cashierToken, managerToken, adminToken;

  beforeAll(() => {
    db = createTestDb();
    app = buildApp(db);

    cashierToken = makeToken({ id: 'u2', email: 'caixa@flash.pt', role: 'cashier', store: 'Braga Centro', full_name: 'Caixa João' });
    managerToken = makeToken({ id: 'u3', email: 'gerente@flash.pt', role: 'manager', store: 'Braga Centro', full_name: 'Gerente Ana' });
    adminToken   = makeToken({ id: 'u1', email: 'admin@flash.pt',   role: 'admin',   store: 'Braga Centro', full_name: 'Admin' });
  });

  afterAll(() => { db.close(); });

  // ── AC-01: Autenticação ───────────────────────
  describe('AC-01 — Autenticação de utilizadores', () => {
    it('caixa consegue fazer login com credenciais válidas', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'caixa@flash.pt', password: 'caixa123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('cashier');
    });

    it('login com password errada é rejeitado', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'caixa@flash.pt', password: 'errada' });
      expect(res.status).toBe(401);
    });

    it('sem token o acesso a endpoints protegidos é negado', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(401);
    });

    it('utilizador autenticado obtém os seus dados', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('cashier');
      expect(res.body.store).toBe('Braga Centro');
    });
  });

  // ── AC-02: Fluxo completo da caixa ───────────
  describe('AC-02 — Fluxo completo do ponto de venda (caixa)', () => {
    let shiftId;

    it('caixa abre turno com fundo de caixa', async () => {
      const res = await request(app)
        .post('/api/shift-closures/open')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ store: 'Braga Centro', pos_terminal_id: 't1', opening_declared_cash: 50 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('open');
      shiftId = res.body.id;
    });

    it('não é possível abrir segundo turno no mesmo terminal', async () => {
      const res = await request(app)
        .post('/api/shift-closures/open')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ store: 'Braga Centro', pos_terminal_id: 't1', opening_declared_cash: 50 });
      expect(res.status).toBe(409);
    });

    it('caixa consulta o catálogo de produtos', async () => {
      const res = await request(app).get('/api/products').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('caixa pesquisa produto por código de barras', async () => {
      const res = await request(app).get('/api/products?barcode=5601234567890').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('Água 1.5L');
    });

    it('caixa regista uma venda com desconto de stock', async () => {
      const stockAntes = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          store: 'Braga Centro',
          shift_closure_id: shiftId,
          items: [{ product_id: 'p1', product_name: 'Água 1.5L', quantity: 3, unit_price: 0.89, iva_rate: 6 }],
          total: 2.67,
          total_iva: 0.15,
          payment_method: 'Numerário',
          amount_paid: 5,
          change_given: 2.33,
        });
      expect(res.status).toBe(201);
      const stockDepois = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      expect(stockDepois).toBe(stockAntes - 3);
    });

    it('venda é rejeitada quando stock é insuficiente', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          store: 'Braga Centro',
          items: [{ product_id: 'p2', product_name: 'Pão de Forma', quantity: 999, unit_price: 1.29, iva_rate: 6 }],
          total: 1287.71,
          payment_method: 'Numerário',
        });
      expect(res.status).toBe(409);
    });

    it('caixa fecha turno', async () => {
      const res = await request(app)
        .post(`/api/shift-closures/${shiftId}/close`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ closing_declared_cash: 52.67 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending_approval');
    });
  });

  // ── AC-03: Fluxo do gerente ───────────────────
  describe('AC-03 — Funcionalidades do gerente de loja', () => {
    it('gerente consulta o stock da loja', async () => {
      const res = await request(app).get('/api/stock?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('gerente consulta histórico de vendas da loja', async () => {
      const res = await request(app).get('/api/sales?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('gerente cria uma promoção', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Desconto Verão',
          type: 'percentage',
          value: 10,
          applies_to: 'category',
          start_date: '2026-06-01',
          end_date: '2026-08-31',
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Desconto Verão');
    });

    it('gerente consulta encomendas a fornecedores', async () => {
      const res = await request(app).get('/api/supplier-orders').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });

    it('gerente obtém KPIs do dashboard', async () => {
      const res = await request(app).get('/api/dashboard/kpis?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_sales');
      expect(res.body).toHaveProperty('revenue');
      expect(res.body).toHaveProperty('low_stock_items');
    });
  });

  // ── AC-04: Funcionalidades de administrador ───
  describe('AC-04 — Funcionalidades do administrador', () => {
    it('admin lista todos os utilizadores', async () => {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('admin consulta logs de auditoria', async () => {
      const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('admin anonimiza NIFs antigos (RGPD)', async () => {
      const res = await request(app).post('/api/admin/rgpd/anonymize-old-nifs').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('anonymized');
    });
  });

  // ── AC-05: Controlo de acesso entre perfis ────
  describe('AC-05 — Isolamento de permissões entre perfis', () => {
    it('caixa não consegue aceder à lista de utilizadores (admin only)', async () => {
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(403);
    });

    it('caixa não consegue criar promoções (manager/admin only)', async () => {
      const res = await request(app)
        .post('/api/promotions')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ name: 'Promo', type: 'percentage', value: 5, applies_to: 'all', start_date: '2026-01-01', end_date: '2026-12-31' });
      expect(res.status).toBe(403);
    });

    it('gerente não consegue abrir turno (cashier only)', async () => {
      const res = await request(app)
        .post('/api/shift-closures/open')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ store: 'Braga Centro', pos_terminal_id: 't1', opening_declared_cash: 50 });
      expect(res.status).toBe(403);
    });

    it('gerente não consegue aceder a logs de auditoria (admin only)', async () => {
      const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });

    it('caixa não consegue anonimizar NIFs (admin only)', async () => {
      const res = await request(app).post('/api/admin/rgpd/anonymize-old-nifs').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── AC-06: Alertas e reposição de stock ───────
  describe('AC-06 — Gestão de alertas e reposição de stock', () => {
    beforeAll(() => {
      db.prepare(`INSERT INTO alerts (id, type, store, product_id, product_name, stock_id, quantity, resolved, created_at)
        VALUES ('al1', 'low_stock', 'Braga Centro', 'p2', 'Pão de Forma', 'st2', 5, 0, datetime('now'))`).run();
    });

    it('gerente consulta alertas ativos da loja', async () => {
      const res = await request(app).get('/api/alerts?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].resolved).toBe(0);
    });

    it('gerente filtra alertas por tipo', async () => {
      const res = await request(app).get('/api/alerts?store=Braga Centro&type=low_stock').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.every(a => a.type === 'low_stock')).toBe(true);
    });

    it('gerente resolve um alerta', async () => {
      const res = await request(app).patch('/api/alerts/al1/resolve').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.resolved).toBe(1);
    });

    it('alerta resolvido não aparece nos alertas ativos', async () => {
      const res = await request(app).get('/api/alerts?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.find(a => a.id === 'al1')).toBeUndefined();
    });

    it('gerente obtém sugestões de reposição para stock abaixo do mínimo', async () => {
      const res = await request(app).get('/api/replenishment-suggestions?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(s => s.product_id === 'p2')).toBe(true);
    });

    it('sugestões de reposição requerem parâmetro store', async () => {
      const res = await request(app).get('/api/replenishment-suggestions').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });

    it('caixa não acede a sugestões de reposição', async () => {
      const res = await request(app).get('/api/replenishment-suggestions?store=Braga Centro').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── AC-07: Devoluções de vendas ───────────────
  describe('AC-07 — Devoluções de vendas', () => {
    let saleIdForReturn;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          store: 'Braga Centro',
          items: [{ product_id: 'p1', product_name: 'Água 1.5L', quantity: 2, unit_price: 0.89, iva_rate: 6 }],
          total: 1.78,
          payment_method: 'Numerário',
        });
      saleIdForReturn = res.body.id;
    });

    it('gerente processa devolução e stock é reposto', async () => {
      const stockAntes = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      const res = await request(app)
        .post(`/api/sales/${saleIdForReturn}/return`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          reason: 'Produto danificado',
          items: [{ product_id: 'p1', product_name: 'Água 1.5L', quantity: 2, unit_price: 0.89, stock_id: 'st1' }],
        });
      expect(res.status).toBe(201);
      expect(res.body.total_refunded).toBeCloseTo(1.78);
      const stockDepois = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      expect(stockDepois).toBe(stockAntes + 2);
    });

    it('venda cancelada não pode ser devolvida novamente', async () => {
      const res = await request(app)
        .post(`/api/sales/${saleIdForReturn}/return`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Duplicado', items: [{ product_id: 'p1', quantity: 1, unit_price: 0.89 }] });
      expect(res.status).toBe(409);
    });

    it('caixa não pode processar devoluções', async () => {
      const res = await request(app)
        .post(`/api/sales/${saleIdForReturn}/return`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ items: [{ product_id: 'p1', quantity: 1, unit_price: 0.89 }] });
      expect(res.status).toBe(403);
    });

    it('devolução de venda inexistente retorna 404', async () => {
      const res = await request(app)
        .post('/api/sales/venda-inexistente/return')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ items: [{ product_id: 'p1', quantity: 1, unit_price: 0.89 }] });
      expect(res.status).toBe(404);
    });
  });

  // ── AC-08: Fecho de dia ───────────────────────
  describe('AC-08 — Fecho de dia pelo gerente', () => {
    const testDate = '2026-05-20';

    it('gerente fecha o dia com total de vendas calculado', async () => {
      const res = await request(app)
        .post('/api/day-closures')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ store: 'Braga Centro', closure_date: testDate });
      expect(res.status).toBe(201);
      expect(res.body.store).toBe('Braga Centro');
      expect(res.body.closure_date).toBe(testDate);
    });

    it('não é possível fechar o mesmo dia duas vezes', async () => {
      const res = await request(app)
        .post('/api/day-closures')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ store: 'Braga Centro', closure_date: testDate });
      expect(res.status).toBe(409);
    });

    it('caixa não pode fechar o dia', async () => {
      const res = await request(app)
        .post('/api/day-closures')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ store: 'Braga Centro', closure_date: '2026-05-21' });
      expect(res.status).toBe(403);
    });
  });

  // ── AC-09: Gestão de fornecedores ─────────────
  describe('AC-09 — Gestão de fornecedores', () => {
    it('gerente regista um novo fornecedor', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Distribuidor Norte', nif: '501234567', email: 'norte@dist.pt', phone: '253000000' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Distribuidor Norte');
    });

    it('NIF de fornecedor duplicado é rejeitado', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Outro Fornecedor', nif: '501234567' });
      expect(res.status).toBe(409);
    });

    it('fornecedor sem NIF é rejeitado', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Fornecedor Sem NIF' });
      expect(res.status).toBe(400);
    });

    it('gerente lista fornecedores registados', async () => {
      const res = await request(app).get('/api/suppliers').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.some(s => s.nif === '501234567')).toBe(true);
    });

    it('caixa não acede à lista de fornecedores', async () => {
      const res = await request(app).get('/api/suppliers').set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(403);
    });
  });
});
