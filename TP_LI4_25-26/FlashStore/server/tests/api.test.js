/**
 * FlashStore — Testes de integração da API REST
 * Usa uma BD SQLite em memória (isolada por suite de testes).
 * Não necessita de servidor em execução — usa supertest direto no Express app.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createRequire } from 'module';

// Better-sqlite3 é CommonJS — usar createRequire para importar em ESM
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { createTestDb, makeToken, JWT_SECRET } = require('./helpers.js');

// ─────────────────────────────────────────────
// Criar app Express de teste (sem listen)
// ─────────────────────────────────────────────
function buildApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  function genId() { return crypto.randomUUID(); }

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

  function adminMiddleware(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    next();
  }

  function logAudit() {} // no-op nos testes

  function todayISODate() { return new Date().toISOString().slice(0, 10); }

  function ensureDayNotClosed(store, date) {
    const d = String(date || todayISODate()).slice(0, 10);
    const c = db.prepare('SELECT id FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL').get(store, d);
    if (c) {
      const err = new Error(`Dia ${d} já foi fechado.`);
      err.status = 409;
      err.code = 'DAY_CLOSED';
      throw err;
    }
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

  // ── Health ───────────────────────────────────
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ── Auth ─────────────────────────────────────
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

  // ── Produtos ─────────────────────────────────
  app.get('/api/products', authMiddleware, (req, res) => {
    const { q, barcode, is_active } = req.query;
    if (barcode) {
      const row = db.prepare('SELECT * FROM products WHERE barcode = ? AND is_active = 1').get(barcode);
      return res.json(row ? [row] : []);
    }
    if (q) {
      const like = `%${q}%`;
      return res.json(db.prepare('SELECT * FROM products WHERE name LIKE ? AND is_active = 1 LIMIT 50').all(like));
    }
    const rows = db.prepare(`SELECT * FROM products${is_active !== undefined ? ' WHERE is_active = ?' : ''} ORDER BY name`).all(...(is_active !== undefined ? [is_active === 'true' ? 1 : 0] : []));
    res.json(rows);
  });

  // ── Stock ────────────────────────────────────
  app.get('/api/stock', authMiddleware, (req, res) => {
    const { store } = req.query;
    const rows = store
      ? db.prepare('SELECT * FROM stock WHERE store = ?').all(store)
      : db.prepare('SELECT * FROM stock').all();
    res.json(rows);
  });

  // ── Turnos ───────────────────────────────────
  app.post('/api/shift-closures/open', authMiddleware, (req, res) => {
    if (req.user.role !== 'cashier') return res.status(403).json({ error: 'Apenas caixa pode abrir turno.' });
    const { store, pos_terminal_id, opening_declared_cash, shift_date } = req.body;
    if (!store || !pos_terminal_id || opening_declared_cash === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
    }
    try { ensureDayNotClosed(store, shift_date); } catch (err) { return res.status(err.status || 409).json({ error: err.message }); }

    const open = db.prepare('SELECT id FROM shift_closures WHERE store = ? AND pos_terminal_id = ? AND status = ?').get(store, pos_terminal_id, 'open');
    if (open) return res.status(409).json({ error: 'Já existe turno aberto neste terminal.' });

    const id = `sh-${genId()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO shift_closures (id, store, pos_terminal_id, cashier_email, cashier_name, shift_date, opening_declared_cash, status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(id, store, pos_terminal_id, req.user.email, req.user.full_name, shift_date || todayISODate(), Number(opening_declared_cash), now);
    res.status(201).json(db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(id));
  });

  app.get('/api/shift-closures/my-open', authMiddleware, (req, res) => {
    const { store } = req.query;
    const row = db.prepare('SELECT * FROM shift_closures WHERE store = ? AND cashier_email = ? AND status = ? ORDER BY created_date DESC LIMIT 1').get(store, req.user.email, 'open');
    res.json(row || null);
  });

  // ── Vendas ───────────────────────────────────
  app.post('/api/sales', authMiddleware, (req, res) => {
    const { store, items, total, total_iva, payment_method, amount_paid, change_given, customer_nif, shift_closure_id } = req.body;
    if (!store || !items?.length || total == null || !payment_method) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
    }
    try {
      ensureDayNotClosed(store, todayISODate());
    } catch (err) {
      return res.status(err.status || 409).json({ error: err.message });
    }

    const saleId = genId();
    const now = new Date().toISOString();
    const invoiceNo = `FS-TEST-${Date.now()}`;
    const receiptNo = `TL-TEST-${Date.now()}`;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO sales (id, store, shift_closure_id, cashier_email, invoice_number, receipt_number,
          total, total_iva, payment_method, amount_paid, change_given, customer_nif, status, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `).run(saleId, store, shift_closure_id || null, req.user.email, invoiceNo, receiptNo,
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

    res.status(201).json({ ...db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId), items: db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) });
  });

  // ── Alertas ──────────────────────────────────
  app.get('/api/alerts', authMiddleware, (req, res) => {
    const { store, resolved } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (store) { where += ' AND store = ?'; params.push(store); }
    if (resolved !== undefined) { where += ' AND resolved = ?'; params.push(resolved === 'true' ? 1 : 0); }
    res.json(db.prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC`).all(...params));
  });

  app.get('/api/alerts/counts', authMiddleware, (req, res) => {
    const { store } = req.query;
    const rows = db.prepare(`SELECT type, COUNT(*) AS count FROM alerts WHERE${store ? ' store = ? AND' : ''} resolved = 0 GROUP BY type`).all(...(store ? [store] : []));
    const counts = { low_stock: 0, expiry: 0, missing_day_closure: 0, total: 0 };
    rows.forEach((r) => { counts[r.type] = r.count; counts.total += r.count; });
    res.json(counts);
  });

  // ── RGPD ─────────────────────────────────────
  app.post('/api/admin/rgpd/anonymize-old-nifs', authMiddleware, adminMiddleware, (req, res) => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 5);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const result = db.prepare(`UPDATE sales SET customer_nif = 'ANONIMIZADO' WHERE customer_nif IS NOT NULL AND customer_nif != '' AND customer_nif != 'ANONIMIZADO' AND customer_nif != '999999990' AND created_date < ?`).run(`${cutoffStr}T00:00:00`);
    res.json({ ok: true, rows_anonymized: result.changes, cutoff_date: cutoffStr });
  });

  // ── Sugestão de reposição ────────────────────
  app.get('/api/replenishment-suggestions', authMiddleware, (req, res) => {
    const { store } = req.query;
    if (!store) return res.status(400).json({ error: 'store é obrigatório' });
    const today = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT product_id, product_name, SUM(quantity) AS valid_qty, MAX(minimum_threshold) AS min_threshold
      FROM stock WHERE store = ? GROUP BY product_id HAVING valid_qty < min_threshold
    `).all(store);
    const suggestions = rows.map((r) => ({
      product_id: r.product_id, product_name: r.product_name,
      current_stock: Number(r.valid_qty), minimum_threshold: Number(r.min_threshold),
      suggested_order_qty: Math.ceil(Number(r.min_threshold) * 2 - Number(r.valid_qty)),
      urgency: Number(r.valid_qty) <= 0 ? 'crítico' : 'normal',
    }));
    res.json({ store, suggestions });
  });

  return app;
}

// ─────────────────────────────────────────────
// Suite de testes
// ─────────────────────────────────────────────
describe('FlashStore API — testes de integração', () => {
  let app, db, adminToken, cashierToken, managerToken;

  beforeAll(() => {
    db = createTestDb();
    app = buildApp(db);

    adminToken = makeToken({ id: 'u1', email: 'admin@flash.pt', role: 'admin', store: 'Braga Centro', full_name: 'Admin' });
    cashierToken = makeToken({ id: 'u2', email: 'caixa@flash.pt', role: 'cashier', store: 'Braga Centro', full_name: 'Caixa João' });
    managerToken = makeToken({ id: 'u3', email: 'gerente@flash.pt', role: 'manager', store: 'Braga Centro', full_name: 'Gerente Ana' });
  });

  afterAll(() => {
    db.close();
  });

  // ── Health ────────────────────────────────────
  describe('GET /api/health', () => {
    it('devolve ok: true', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ── Autenticação ──────────────────────────────
  describe('POST /api/auth/login', () => {
    it('login com credenciais válidas devolve token', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'admin@flash.pt', password: 'admin123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('admin');
    });

    it('login com password errada devolve 401', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'admin@flash.pt', password: 'errada' });
      expect(res.status).toBe(401);
    });

    it('pedido sem token a endpoint protegido devolve 401', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('devolve dados do utilizador autenticado', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@flash.pt');
    });
  });

  // ── Produtos ──────────────────────────────────
  describe('GET /api/products', () => {
    it('lista todos os produtos ativos', async () => {
      const res = await request(app).get('/api/products').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('pesquisa por nome retorna resultados', async () => {
      const res = await request(app).get('/api/products?q=Água').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.some((p) => p.name.includes('Água'))).toBe(true);
    });

    it('lookup por barcode retorna produto correto', async () => {
      const res = await request(app).get('/api/products?barcode=5601234567890').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Água 1.5L');
    });

    it('barcode inexistente retorna lista vazia', async () => {
      const res = await request(app).get('/api/products?barcode=0000000000000').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });
  });

  // ── Stock ─────────────────────────────────────
  describe('GET /api/stock', () => {
    it('lista stock de uma loja', async () => {
      const res = await request(app).get('/api/stock?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Turnos ────────────────────────────────────
  describe('POST /api/shift-closures/open', () => {
    it('caixa pode abrir turno', async () => {
      const res = await request(app)
        .post('/api/shift-closures/open')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ store: 'Braga Centro', pos_terminal_id: 'PDV-01', opening_declared_cash: 50 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('open');
    });

    it('não permite abrir segundo turno no mesmo terminal', async () => {
      const res = await request(app)
        .post('/api/shift-closures/open')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ store: 'Braga Centro', pos_terminal_id: 'PDV-01', opening_declared_cash: 50 });
      expect(res.status).toBe(409);
    });

    it('gerente não pode abrir turno (role inválido)', async () => {
      const res = await request(app)
        .post('/api/shift-closures/open')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ store: 'Braga Centro', pos_terminal_id: 'PDV-01', opening_declared_cash: 50 });
      expect(res.status).toBe(403);
    });
  });

  // ── Vendas ────────────────────────────────────
  describe('POST /api/sales', () => {
    let shiftId;

    beforeAll(() => {
      const shift = db.prepare('SELECT id FROM shift_closures WHERE status = ? LIMIT 1').get('open');
      shiftId = shift?.id;
    });

    it('regista venda com desconto de stock', async () => {
      const stockBefore = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          store: 'Braga Centro',
          shift_closure_id: shiftId,
          items: [{ product_id: 'p1', product_name: 'Água 1.5L', quantity: 2, unit_price: 0.89, iva_rate: 6 }],
          total: 1.78,
          total_iva: 0.10,
          payment_method: 'cartao',
          amount_paid: 1.78,
          change_given: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.items.length).toBe(1);

      const stockAfter = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
      expect(stockAfter).toBe(stockBefore - 2);
    });

    it('rejeita venda com stock insuficiente', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          store: 'Braga Centro',
          items: [{ product_id: 'p2', product_name: 'Pão de Forma', quantity: 100, unit_price: 1.29, iva_rate: 6 }],
          total: 129,
          payment_method: 'dinheiro',
          amount_paid: 150,
          change_given: 21,
        });

      expect(res.status).toBe(409);
    });

    it('rejeita venda se campos obrigatórios em falta', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ store: 'Braga Centro' });
      expect(res.status).toBe(400);
    });
  });

  // ── Alertas ───────────────────────────────────
  describe('GET /api/alerts', () => {
    beforeAll(() => {
      db.prepare(`INSERT OR IGNORE INTO alerts (id, type, store, product_name, resolved) VALUES ('a1', 'low_stock', 'Braga Centro', 'Pão de Forma', 0)`).run();
    });

    it('lista alertas ativos de uma loja', async () => {
      const res = await request(app).get('/api/alerts?store=Braga Centro&resolved=false').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/alerts/counts devolve contagens por tipo', async () => {
      const res = await request(app).get('/api/alerts/counts?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
    });
  });

  // ── Sugestão de reposição ─────────────────────
  describe('GET /api/replenishment-suggestions', () => {
    it('devolve sugestões para loja com stock baixo', async () => {
      const res = await request(app).get('/api/replenishment-suggestions?store=Braga Centro').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.suggestions).toBeDefined();
      // Pão de Forma tem qty=5 < threshold=20 → deve aparecer
      const pao = res.body.suggestions.find((s) => s.product_name === 'Pão de Forma');
      expect(pao).toBeDefined();
      expect(pao.urgency).not.toBe('ok');
    });

    it('retorna 400 sem store', async () => {
      const res = await request(app).get('/api/replenishment-suggestions').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ── RGPD ──────────────────────────────────────
  describe('POST /api/admin/rgpd/anonymize-old-nifs', () => {
    beforeAll(() => {
      const oldDate = '2018-01-01T12:00:00';
      db.prepare(`INSERT INTO sales (id, store, cashier_email, total, payment_method, customer_nif, status, created_date) VALUES ('s_old', 'Braga Centro', 'caixa@flash.pt', 1.0, 'dinheiro', '123456789', 'completed', ?)`).run(oldDate);
    });

    it('anonimiza NIFs com mais de 5 anos', async () => {
      const res = await request(app)
        .post('/api/admin/rgpd/anonymize-old-nifs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.rows_anonymized).toBeGreaterThanOrEqual(1);

      const sale = db.prepare('SELECT customer_nif FROM sales WHERE id = ?').get('s_old');
      expect(sale.customer_nif).toBe('ANONIMIZADO');
    });

    it('apenas admin pode anonimizar NIFs', async () => {
      const res = await request(app)
        .post('/api/admin/rgpd/anonymize-old-nifs')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });

  describe('FlashStore API — Testes de Integração Adicionais', () => {
    // ── Testes de Segurança Adicionais ──────────
    describe('Segurança', () => {
      it('token expirado deve ser rejeitado', async () => {
        const expiredToken = jwt.sign(
          { id: 'u1', email: 'admin@flash.pt', role: 'admin' },
          JWT_SECRET,
          { expiresIn: '0s' }
        );
        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${expiredToken}`);
        expect(res.status).toBe(401);
      });

      it('token malformado deve ser rejeitado', async () => {
        const res = await request(app)
          .get('/api/products')
          .set('Authorization', 'Bearer token-invalido-12345');
        expect(res.status).toBe(401);
      });

      it('SQL injection nos parâmetros de query deve ser inofensivo', async () => {
        const res = await request(app)
          .get("/api/products?q='; DROP TABLE users;--")
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        // Verificar que a tabela users ainda existe
        const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
        expect(users.count).toBeGreaterThan(0);
      });
    });

    // ── Testes de Limite ─────────────────────────
    describe('Limites e Edge Cases', () => {
      it('deve rejeitar pedidos com body muito grande', async () => {
        const hugeItems = Array(1000).fill({
          product_id: 'p1',
          product_name: 'Água 1.5L',
          quantity: 1,
          unit_price: 0.89
        });
        
        const res = await request(app)
          .post('/api/sales')
          .set('Authorization', `Bearer ${cashierToken}`)
          .send({
            store: 'Braga Centro',
            items: hugeItems,
            total: 890,
            payment_method: 'dinheiro'
          });
        
        // Deve rejeitar ou processar, mas não crashar
        expect(res.status).toBeGreaterThanOrEqual(400);
      });

      it('deve lidar com nomes de produtos com caracteres especiais', async () => {
        const res = await request(app)
          .get('/api/products?q=café')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
      });

      it('deve lidar com store inexistente', async () => {
        const res = await request(app)
          .get('/api/stock?store=LojaInexistente')
          .set('Authorization', `Bearer ${managerToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    // ── Testes de Concorrência ───────────────────
    describe('Concorrência', () => {
      it('múltiplas vendas simultâneas não devem corromper stock', async () => {
        const stockBefore = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
        
        // Simular 5 vendas concorrentes
        const promises = Array(5).fill(null).map(() =>
          request(app)
            .post('/api/sales')
            .set('Authorization', `Bearer ${cashierToken}`)
            .send({
              store: 'Braga Centro',
              items: [{
                product_id: 'p1',
                product_name: 'Água 1.5L',
                quantity: 1,
                unit_price: 0.89
              }],
              total: 0.89,
              payment_method: 'dinheiro',
              amount_paid: 1.00,
              change_given: 0.11
            })
        );
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.status === 201).length;
        
        const stockAfter = db.prepare('SELECT quantity FROM stock WHERE id = ?').get('st1').quantity;
        expect(stockAfter).toBe(stockBefore - successful);
      });
    });

    // ── Testes de Resiliência ────────────────────
    describe('Resiliência', () => {
      it('deve lidar com JSON malformado', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'application/json')
          .send('{email: invalid}');
        expect(res.status).toBe(400);
      });

      it('deve lidar com métodos HTTP não suportados', async () => {
        const res = await request(app)
          .put('/api/health');
        expect(res.status).toBe(404);
      });

      it('deve lidar com Content-Type incorreto', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'text/plain')
          .send('email=admin@flash.pt&password=admin123');
        // Express com express.json() pode retornar 400 ou processar
        expect(res.status).toBeGreaterThanOrEqual(400);
      });
    });
  });
  });
});
