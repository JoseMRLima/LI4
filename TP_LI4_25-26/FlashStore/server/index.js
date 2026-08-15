/**
 * FlashStore — Servidor Backend Local
 * Express + SQLite (better-sqlite3)
 * Porta: 3001
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDB } = require('./database');
const { processSyncPush } = require('./syncPush');
const { runBackup, listBackups, scheduleDailyBackup } = require('./backup');
const { startScheduler } = require('./scheduler');
const { generateSaftXml } = require('./saft');

const JWT_SECRET = 'flashstore-dev-secret-2025'; // em produção usar variável de ambiente

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

// RNF01 — Middleware de tempo de resposta (loga requests > 500ms)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms > 500) {
      console.warn(`[perf] ${req.method} ${req.path} → ${res.statusCode} em ${ms}ms`);
    }
  });
  next();
});

// Inicializa a base de dados SQLite
const db = initDB();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'flashstore-api' });
});

/** YYYY-MM-DD no mesmo fuso que o resto da API (ISO UTC — alinhado a shift_date / dashboards). */
function calendarDateStringUTC(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// MIDDLEWARE DE AUTENTICAÇÃO
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// AUDIT LOG (RF21 / RNF08)
// ─────────────────────────────────────────────
const insertAuditStmt = () =>
  db.prepare(`
    INSERT INTO audit_logs (
      id, actor_id, actor_email, actor_role,
      action, entity, entity_id, scope, severity,
      payload_json, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

function logAudit(req, {
  action,
  entity = null,
  entity_id = null,
  scope = null,
  severity = 'info',
  payload = null,
  actor = null,
}) {
  try {
    const id = `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const reqUser = actor || req?.user || {};
    insertAuditStmt().run(
      id,
      reqUser.id || null,
      reqUser.email || null,
      reqUser.role || null,
      action,
      entity,
      entity_id,
      scope,
      severity,
      payload ? JSON.stringify(payload) : null,
      req?.ip || req?.headers?.['x-forwarded-for'] || null,
      req?.headers?.['user-agent']?.slice(0, 200) || null,
      now
    );
  } catch (err) {
    console.error('Falha a registar auditoria:', err.message);
  }
}

// Bloqueio operacional após fecho do dia (UC04)
function ensureDayNotClosed(store, dateISO) {
  const date = String(dateISO || todayISODate()).slice(0, 10);
  const closure = db.prepare(`
    SELECT * FROM day_closures
    WHERE store = ? AND closure_date = ? AND reopened_at IS NULL
  `).get(store, date);
  if (closure) {
    const err = new Error(`O dia ${date} da loja "${store}" já foi fechado. Reabra o dia para registar novas operações.`);
    err.status = 409;
    err.code = 'DAY_CLOSED';
    throw err;
  }
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password obrigatórios' });

  const bcrypt = require('bcryptjs');
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) {
    logAudit(req, {
      action: 'login_failed',
      entity: 'user',
      severity: 'medium',
      payload: { email, reason: 'user_not_found_or_inactive' },
    });
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    logAudit(req, {
      action: 'login_failed',
      entity: 'user',
      entity_id: user.id,
      severity: 'medium',
      payload: { email, reason: 'wrong_password' },
    });
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, store: user.store, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  logAudit(req, {
    action: 'login',
    entity: 'user',
    entity_id: user.id,
    scope: user.store,
    severity: 'info',
    actor: { id: user.id, email: user.email, role: user.role },
  });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, store: user.store, full_name: user.full_name } });
});

// POST /api/auth/logout
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  logAudit(req, {
    action: 'logout',
    entity: 'user',
    entity_id: req.user.id,
    scope: req.user.store,
  });
  res.json({ success: true });
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, role, store, full_name, is_active FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });
  res.json(user);
});

// ─────────────────────────────────────────────
// HELPER — gera IDs únicos simples
// ─────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeLot(serialNumber) {
  return String(serialNumber || 'SEM-LOTE').trim() || 'SEM-LOTE';
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/** Data civil ISO (YYYY-MM-DD) +/- N dias (UTC). */
function addCalendarDaysISO(isoDate, deltaDays) {
  const s = String(isoDate || '').slice(0, 10);
  const parts = s.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return todayISODate();
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(deltaDays || 0));
  return dt.toISOString().slice(0, 10);
}

function verifyManagerPassword(email, password) {
  const bcrypt = require('bcryptjs');
  if (!email || !password) return { ok: false, error: 'Credenciais do gerente em falta.' };
  const mgr = db.prepare('SELECT * FROM users WHERE lower(trim(email)) = lower(trim(?)) AND is_active = 1').get(String(email));
  if (!mgr) return { ok: false, error: 'Credenciais do gerente inválidas.' };
  if (!['manager', 'admin'].includes(mgr.role)) return { ok: false, error: 'Apenas gerente ou admin pode autorizar.' };
  if (!bcrypt.compareSync(password, mgr.password_hash)) return { ok: false, error: 'Credenciais do gerente inválidas.' };
  return { ok: true, user: mgr };
}

function managerCanAuthorizeForStore(mgr, saleStore) {
  if (mgr.role === 'admin') return true;
  return mgr.store === saleStore;
}

function assertCashierManagerApproval(req, saleStore) {
  if (req.user.role === 'manager' || req.user.role === 'admin') {
    if (req.user.role === 'manager' && req.user.store !== saleStore) {
      return { ok: false, error: 'Só pode anular ou estornar vendas da sua loja.' };
    }
    return { ok: true, manager: null };
  }
  const { manager_email, manager_password } = req.body || {};
  const v = verifyManagerPassword(manager_email, manager_password);
  if (!v.ok) return { ok: false, error: v.error };
  if (!managerCanAuthorizeForStore(v.user, saleStore)) {
    return { ok: false, error: 'O gerente não pertence a esta loja.' };
  }
  return { ok: true, manager: v.user };
}

function computeShiftExpectedDrawerCash(shiftId) {
  const sh = db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(shiftId);
  if (!sh) return null;
  const sales = db.prepare(`
    SELECT payment_method, amount_paid, total, change_given FROM sales
    WHERE shift_closure_id = ? AND status = 'completed'
  `).all(shiftId);
  let cashSales = 0;
  for (const sale of sales) {
    if (sale.payment_method !== 'Numerário') continue;
    const amountPaid = Number(sale.amount_paid || 0);
    const total = Number(sale.total || 0);
    const changeGiven = Number(sale.change_given || 0);
    cashSales += amountPaid > 0 ? (amountPaid - changeGiven) : total;
  }
  const retRows = db.prepare(`
    SELECT r.total_refunded, s.payment_method FROM sale_returns r
    JOIN sales s ON s.id = r.sale_id
    WHERE s.shift_closure_id = ?
  `).all(shiftId);
  let cashRefunds = 0;
  for (const row of retRows) {
    if (row.payment_method === 'Numerário') {
      cashRefunds += Number(row.total_refunded || 0);
    }
  }
  const drops = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS s FROM cash_drops
    WHERE shift_closure_id = ? AND status = 'approved'
  `).get(shiftId);
  const dropsTotal = Number(drops?.s || 0);
  const opening = Number(sh.opening_declared_cash || sh.opening_expected_cash || 0);
  const expectedDrawer = opening + cashSales - cashRefunds - dropsTotal;
  return {
    opening,
    cash_sales: cashSales,
    cash_refunds: cashRefunds,
    approved_drops: dropsTotal,
    expected_drawer_cash: expectedDrawer,
    num_sales: sales.length,
  };
}

function upsertStockLot({ product_id, product_name, store, quantity, minimum_threshold = 10, serial_number, expiry_date }) {
  const lot = normalizeLot(serial_number);
  const existingStock = db.prepare(`
    SELECT * FROM stock
    WHERE product_id = ? AND store = ? AND serial_number = ? AND COALESCE(expiry_date, '') = COALESCE(?, '')
  `).get(product_id, store, lot, expiry_date || null);

  if (existingStock) {
    db.prepare('UPDATE stock SET quantity = quantity + ?, product_name = ?, minimum_threshold = ? WHERE id = ?')
      .run(Number(quantity || 0), product_name || existingStock.product_name, minimum_threshold, existingStock.id);
    return db.prepare('SELECT * FROM stock WHERE id = ?').get(existingStock.id);
  }

  const id = genId();
  db.prepare(`
    INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold, serial_number, expiry_date, created_date)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(id, product_id, product_name || '', store, Number(quantity || 0), minimum_threshold, lot, expiry_date || null, new Date().toISOString());
  return db.prepare('SELECT * FROM stock WHERE id = ?').get(id);
}

function allocateStockForSale({ productId, store, requestedQuantity, preferredStockId = null }) {
  let remaining = Number(requestedQuantity || 0);
  const allocations = [];

  const lots = preferredStockId
    ? db.prepare(`
        SELECT * FROM stock
        WHERE id = ? AND product_id = ? AND store = ? AND quantity > 0
          AND (expiry_date IS NULL OR expiry_date = '' OR expiry_date >= ?)
      `).all(preferredStockId, productId, store, todayISODate())
    : db.prepare(`
        SELECT * FROM stock
        WHERE product_id = ? AND store = ? AND quantity > 0
          AND (expiry_date IS NULL OR expiry_date = '' OR expiry_date >= ?)
        ORDER BY
          CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END,
          expiry_date ASC,
          created_date ASC
      `).all(productId, store, todayISODate());

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(Number(lot.quantity || 0), remaining);
    if (take <= 0) continue;
    allocations.push({ lot, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
    throw Object.assign(new Error(`Stock insuficiente para ${product?.name || 'produto'}.`), { status: 400 });
  }

  return allocations;
}

function money(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function receiptLine(left, right = '', width = 42) {
  const l = String(left || '');
  const r = String(right || '');
  if (!r) return l.slice(0, width);
  const gap = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(gap)}${r}`.slice(0, width);
}

function buildReceiptText({ sale, items }) {
  const width = 42;
  const createdAt = new Date(sale.created_date);
  const date = createdAt.toLocaleDateString('pt-PT');
  const time = createdAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const taxRows = {};

  for (const item of items) {
    const rate = Number(item.iva_rate || 0);
    const subtotal = Number(item.subtotal || 0);
    const tax = subtotal * rate / (100 + rate);
    if (!taxRows[rate]) taxRows[rate] = { rate, taxable: 0, tax: 0, gross: 0 };
    taxRows[rate].gross += subtotal;
    taxRows[rate].tax += tax;
    taxRows[rate].taxable += subtotal - tax;
  }

  const lines = [
    'FLASHSTORE'.padStart(26),
    '',
    sale.store || 'Loja FlashStore',
    'FlashStore Retail S.A.',
    'NIF: 999999990',
    'C.S: 403.827,00 EUR',
    sale.document_type || 'Fatura Simplificada Original',
    `Nro: ${sale.invoice_number}`,
    `Talão: ${sale.receipt_number}`,
    `${date} ${time}`,
    '',
    `NIF: ${sale.customer_nif || 'Consumidor final'}`,
    '',
    receiptLine('IVA  DESCRICAO', 'VALOR', width),
    '-'.repeat(width),
  ];

  for (const item of items) {
    const taxCode = Number(item.iva_rate || 0) === 6 ? '(A)' : '(C)';
    lines.push(receiptLine(`${taxCode} ${item.product_name}`, money(item.subtotal), width));
    lines.push(`    ${money(item.quantity)} x ${money(item.unit_price)} EUR`);
  }

  lines.push(
    '',
    receiptLine('TOTAL A PAGAR', money(sale.total), width),
    receiptLine(sale.payment_method || 'Pagamento', money(sale.amount_paid), width),
    receiptLine('TROCO', money(sale.change_given), width),
    '',
    receiptLine('%IVA', 'Total Liq.      IVA      Total', width)
  );

  Object.values(taxRows).sort((a, b) => a.rate - b.rate).forEach((row) => {
    lines.push(receiptLine(`${money(row.rate)}%`, `${money(row.taxable)}     ${money(row.tax)}     ${money(row.gross)}`, width));
  });

  lines.push('', 'Obrigado pela sua compra.', '-'.repeat(width));
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────
app.get('/api/products', authMiddleware, (req, res) => {
  const { is_active, q, barcode, category, limit: lim, offset: off } = req.query;
  const maxLimit = Math.min(parseInt(lim) || 200, 500);
  const offset = parseInt(off) || 0;

  // Pesquisa por barcode — lookup direto por índice (RNF02)
  if (barcode) {
    const row = db.prepare('SELECT * FROM products WHERE barcode = ? AND is_active = 1').get(barcode.trim());
    return res.json(row ? [row] : []);
  }

  // Pesquisa full-text via FTS5 (RNF02: < 2s com 10k produtos)
  if (q && q.trim().length >= 2) {
    const term = q.trim().replace(/[^a-zA-ZÀ-ú0-9 ]/g, '') + '*';
    try {
      const rows = db.prepare(`
        SELECT p.* FROM products p
        JOIN products_fts f ON p.rowid = f.rowid
        WHERE products_fts MATCH ?
          AND p.is_active = 1
          ${category ? 'AND p.category = ?' : ''}
        ORDER BY rank
        LIMIT ? OFFSET ?
      `).all(...(category ? [term, category, maxLimit, offset] : [term, maxLimit, offset]));
      return res.json(rows);
    } catch {
      // fallback para LIKE se FTS falhar
      const like = `%${q.trim()}%`;
      const rows = db.prepare(`
        SELECT * FROM products
        WHERE (name LIKE ? OR barcode LIKE ?)
          AND is_active = 1
          ${category ? 'AND category = ?' : ''}
        ORDER BY name LIMIT ? OFFSET ?
      `).all(...(category ? [like, like, category, maxLimit, offset] : [like, like, maxLimit, offset]));
      return res.json(rows);
    }
  }

  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (is_active !== undefined) { query += ' AND is_active = ?'; params.push(is_active === 'true' ? 1 : 0); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY name LIMIT ? OFFSET ?';
  params.push(maxLimit, offset);
  res.json(db.prepare(query).all(...params));
});

app.get('/api/products/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(row);
});

app.post('/api/products', authMiddleware, (req, res) => {
  const { name, barcode, price, category, image_url, supplier_id = null, supplier_name = null, iva_rate = 23, is_perishable = false, default_shelf_life_days = null, is_active = true } = req.body;
  if (!name || !price || !category) return res.status(400).json({ error: 'name, price e category são obrigatórios' });
  const id = genId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO products (id, name, barcode, price, category, image_url, supplier_id, supplier_name, iva_rate, is_perishable, default_shelf_life_days, is_active, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, barcode || null, price, category, image_url || null, supplier_id || null, supplier_name || null, iva_rate, is_perishable ? 1 : 0, default_shelf_life_days || null, is_active ? 1 : 0, now);
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
  const { name, barcode, price, category, image_url, supplier_id, supplier_name, iva_rate, is_perishable, default_shelf_life_days, is_active } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
  db.prepare(`
    UPDATE products SET name=?, barcode=?, price=?, category=?, image_url=?, supplier_id=?, supplier_name=?, iva_rate=?, is_perishable=?, default_shelf_life_days=?, is_active=?
    WHERE id=?
  `).run(
    name ?? existing.name, barcode ?? existing.barcode, price ?? existing.price,
    category ?? existing.category, image_url ?? existing.image_url,
    supplier_id !== undefined ? (supplier_id || null) : existing.supplier_id,
    supplier_name !== undefined ? (supplier_name || null) : existing.supplier_name,
    iva_rate ?? existing.iva_rate, is_perishable !== undefined ? (is_perishable ? 1 : 0) : existing.is_perishable,
    default_shelf_life_days !== undefined ? (default_shelf_life_days || null) : existing.default_shelf_life_days,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// CATEGORIAS (catálogo global)
// ─────────────────────────────────────────────
app.get('/api/categories', authMiddleware, (req, res) => {
  res.json(
    db.prepare('SELECT id, name, created_date FROM product_categories ORDER BY name COLLATE NOCASE').all()
  );
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
  const oldName = row.name;
  if (oldName === name) {
    return res.json(db.prepare('SELECT id, name, created_date FROM product_categories WHERE id = ?').get(row.id));
  }
  try {
    db.transaction(() => {
      db.prepare('UPDATE product_categories SET name = ? WHERE id = ?').run(name, row.id);
      db.prepare('UPDATE products SET category = ? WHERE category = ?').run(name, oldName);
      db.prepare(`UPDATE promotions SET target_name = ? WHERE applies_to = 'category' AND target_name = ?`).run(
        name,
        oldName
      );
    })();
    res.json(db.prepare('SELECT id, name, created_date FROM product_categories WHERE id = ?').get(row.id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
    }
    throw e;
  }
});

app.delete('/api/admin/categories/:id', authMiddleware, adminMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Categoria não encontrada.' });
  const totalCats = db.prepare('SELECT COUNT(*) AS c FROM product_categories').get().c;
  if (totalCats <= 1) {
    return res.status(400).json({ error: 'Tem de existir pelo menos uma categoria no sistema.' });
  }
  const fallback = db
    .prepare(
      `
    SELECT id, name FROM product_categories
    WHERE id != ?
    ORDER BY CASE WHEN TRIM(name) = 'Outros' COLLATE NOCASE THEN 0 ELSE 1 END, name COLLATE NOCASE
    LIMIT 1
  `
    )
    .get(row.id);
  if (!fallback) return res.status(400).json({ error: 'Não foi possível determinar categoria de destino.' });

  const deletedName = row.name;
  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category = ?').get(deletedName).c;

  db.transaction(() => {
    db.prepare('UPDATE products SET category = ? WHERE category = ?').run(fallback.name, deletedName);
    db.prepare(`UPDATE promotions SET target_name = ? WHERE applies_to = 'category' AND target_name = ?`).run(
      fallback.name,
      deletedName
    );
    db.prepare('DELETE FROM product_categories WHERE id = ?').run(row.id);
  })();

  res.json({
    success: true,
    reassigned_to: fallback.name,
    products_reassigned: productCount,
  });
});

// ─────────────────────────────────────────────
// SALES
// ─────────────────────────────────────────────
app.get('/api/sales', authMiddleware, (req, res) => {
  const { store, cashier_email, status, limit = 500, shift_closure_id } = req.query;

  let query = 'SELECT * FROM sales';
  const conditions = [];
  const params = [];

  if (store) {
    conditions.push('store = ?');
    params.push(store);
  }

  if (cashier_email) {
    conditions.push('cashier_email = ?');
    params.push(cashier_email);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (shift_closure_id) {
    conditions.push('shift_closure_id = ?');
    params.push(shift_closure_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_date DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  const sales = db.prepare(query).all(...params);
  const itemsStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');

  res.json(sales.map(s => ({ ...s, items: itemsStmt.all(s.id) })));
});

app.post('/api/sales', authMiddleware, (req, res) => {
  const {
    store,
    items,
    total,
    total_iva,
    payment_method,
    amount_paid,
    change_given,
    customer_nif,
    cashier_email,
    cashier_name,
    invoice_number,
    status = 'completed',
    shift_closure_id,
  } = req.body;
  if (!store || !items || !total || !payment_method) return res.status(400).json({ error: 'Campos obrigatórios em falta' });

  try {
    ensureDayNotClosed(store, todayISODate());
  } catch (err) {
    return res.status(err.status || 409).json({ error: err.message });
  }

  let shiftId = shift_closure_id || null;
  if (req.user.role === 'cashier') {
    if (!shift_closure_id) {
      return res.status(400).json({
        error: 'É obrigatório um turno aberto para registar vendas. Abra o turno no POS.',
      });
    }
    const sh = db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(shift_closure_id);
    if (!sh || sh.status !== 'open') {
      return res.status(409).json({ error: 'Turno inválido ou já fechado. Abra o turno novamente.' });
    }
    if (sh.store !== store || sh.cashier_email !== req.user.email) {
      return res.status(403).json({ error: 'O turno aberto não corresponde a este operador ou loja.' });
    }
    shiftId = shift_closure_id;
  }

  const id = genId();
  const now = new Date().toISOString();
  const inv = invoice_number || `FS-${Date.now()}`;
  const receiptNumber = `TL-${Date.now()}`;

  try {
    const created = db.transaction(() => {
      db.prepare(`
        INSERT INTO sales (
          id, store, total, total_iva, payment_method, amount_paid, change_given, customer_nif,
          cashier_email, cashier_name, invoice_number, document_type, receipt_number, receipt_issued_at,
          status, shift_closure_id, created_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        store,
        total,
        total_iva || 0,
        payment_method,
        amount_paid || total,
        change_given || 0,
        customer_nif || '',
        cashier_email || '',
        cashier_name || '',
        inv,
        'Fatura Simplificada',
        receiptNumber,
        now,
        status,
        shiftId,
        now
      );

      const insertItem = db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal, stock_id, serial_number, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const saleItems = [];

      for (const item of items) {
        const allocations = allocateStockForSale({
          productId: item.product_id,
          store,
          requestedQuantity: item.quantity,
          preferredStockId: item.stock_id || null,
        });

        for (const allocation of allocations) {
          const lineSubtotal = Number(allocation.quantity) * Number(item.unit_price || 0);
          const line = {
            ...item,
            quantity: allocation.quantity,
            subtotal: lineSubtotal,
            stock_id: allocation.lot.id,
            serial_number: allocation.lot.serial_number,
            expiry_date: allocation.lot.expiry_date,
          };

          insertItem.run(
            genId(),
            id,
            item.product_id,
            item.product_name,
            allocation.quantity,
            item.unit_price,
            item.iva_rate || 23,
            lineSubtotal,
            allocation.lot.id,
            allocation.lot.serial_number,
            allocation.lot.expiry_date || null
          );

          db.prepare('UPDATE stock SET quantity = quantity - ? WHERE id = ?')
            .run(allocation.quantity, allocation.lot.id);

          saleItems.push(line);
        }
      }

      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
      const receiptText = buildReceiptText({ sale, items: saleItems });
      db.prepare('UPDATE sales SET receipt_text = ? WHERE id = ?').run(receiptText, id);

      return { sale: { ...sale, receipt_text: receiptText }, items: saleItems };
    })();

    logAudit(req, {
      action: 'sale_created',
      entity: 'sale',
      entity_id: id,
      scope: store,
      severity: 'info',
      payload: {
        invoice_number: inv,
        total: Number(total),
        items: created.items.length,
        payment_method,
        shift_closure_id: shiftId,
      },
    });

    res.status(201).json({ ...created.sale, items: created.items });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Erro ao registar venda' });
  }
});

// ─────────────────────────────────────────────
// STOCK
// ─────────────────────────────────────────────
app.get('/api/stock', authMiddleware, (req, res) => {
  const { store } = req.query;
  let query = `
    SELECT s.*, p.name as product_name, p.barcode, p.category, p.is_perishable, p.default_shelf_life_days
    FROM stock s
    LEFT JOIN products p ON s.product_id = p.id
  `;
  const params = [];
  if (store) { query += ' WHERE s.store = ?'; params.push(store); }
  query += `
    ORDER BY p.name,
      CASE WHEN s.expiry_date IS NULL OR s.expiry_date = '' THEN 1 ELSE 0 END,
      s.expiry_date ASC,
      s.created_date ASC
  `;
  res.json(db.prepare(query).all(...params));
});

app.post('/api/stock', authMiddleware, (req, res) => {
  const { product_id, product_name, store, quantity, minimum_threshold = 10, serial_number, expiry_date } = req.body;
  if (!product_id || !store || quantity === undefined) return res.status(400).json({ error: 'Campos obrigatórios em falta' });

  const stock = upsertStockLot({ product_id, product_name, store, quantity, minimum_threshold, serial_number, expiry_date });
  res.status(201).json(stock);
});

app.put('/api/stock/:id', authMiddleware, (req, res) => {
  const { quantity, minimum_threshold, serial_number, expiry_date } = req.body;
  const existing = db.prepare('SELECT * FROM stock WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Stock não encontrado' });
  db.prepare('UPDATE stock SET quantity=?, minimum_threshold=?, serial_number=?, expiry_date=? WHERE id=?')
    .run(
      quantity ?? existing.quantity,
      minimum_threshold ?? existing.minimum_threshold,
      serial_number !== undefined ? normalizeLot(serial_number) : existing.serial_number,
      expiry_date !== undefined ? (expiry_date || null) : existing.expiry_date,
      req.params.id
    );
  res.json(db.prepare('SELECT * FROM stock WHERE id=?').get(req.params.id));
});

// ─────────────────────────────────────────────
// ADMIN — franquia (produtos + stock por loja + mínimos)
// ─────────────────────────────────────────────
app.get('/api/admin/franchise-products', authMiddleware, adminMiddleware, (req, res) => {
  const products = db
    .prepare(
      `
    SELECT id, name, barcode, category, price, is_active, iva_rate
    FROM products
    ORDER BY name COLLATE NOCASE
  `
    )
    .all();

  const stockAgg = db
    .prepare(
      `
    SELECT product_id, store,
      SUM(quantity) AS total_quantity,
      MAX(minimum_threshold) AS minimum_threshold
    FROM stock
    WHERE TRIM(store) != 'Sede'
    GROUP BY product_id, store
  `
    )
    .all();

  const byProduct = new Map();
  for (const row of stockAgg) {
    const qty = Number(row.total_quantity || 0);
    const minT = Number(row.minimum_threshold ?? 10);
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
    byProduct.get(row.product_id).push({
      store: row.store,
      quantity: qty,
      minimum_threshold: minT,
      below_minimum: qty <= minT,
    });
  }

  const storeNames = db
    .prepare(
      `
    SELECT DISTINCT store FROM (
      SELECT store FROM stock WHERE TRIM(store) != 'Sede'
      UNION
      SELECT store FROM users
      WHERE store IS NOT NULL AND TRIM(store) != '' AND TRIM(store) != 'Sede'
    )
    ORDER BY store COLLATE NOCASE
  `
    )
    .all()
    .map((r) => r.store);

  res.json({
    stores: storeNames,
    products: products.map((p) => ({
      ...p,
      is_active: Boolean(p.is_active),
      stores: byProduct.get(p.id) || [],
    })),
  });
});

app.put('/api/admin/stock-minimum', authMiddleware, adminMiddleware, (req, res) => {
  const { product_id, store, minimum_threshold } = req.body;
  if (!product_id || !store || minimum_threshold === undefined) {
    return res.status(400).json({ error: 'product_id, store e minimum_threshold são obrigatórios.' });
  }
  if (!String(store).trim() || String(store).trim() === 'Sede') {
    return res.status(400).json({ error: 'A Sede não gere stock físico. Escolha uma loja operacional.' });
  }
  const min = Math.max(0, Number(minimum_threshold));
  if (Number.isNaN(min)) {
    return res.status(400).json({ error: 'minimum_threshold inválido.' });
  }

  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

  const updated = db
    .prepare('UPDATE stock SET minimum_threshold = ? WHERE product_id = ? AND store = ?')
    .run(min, product_id, store);

  if (updated.changes === 0) {
    upsertStockLot({
      product_id,
      product_name: product.name,
      store,
      quantity: 0,
      minimum_threshold: min,
      serial_number: 'SEM-LOTE',
      expiry_date: null,
    });
  }

  const agg = db
    .prepare(
      `
    SELECT store,
      SUM(quantity) AS total_quantity,
      MAX(minimum_threshold) AS minimum_threshold
    FROM stock
    WHERE product_id = ? AND store = ?
    GROUP BY store
  `
    )
    .get(product_id, store);

  const qty = Number(agg?.total_quantity || 0);
  const minT = Number(agg?.minimum_threshold ?? min);
  res.json({
    product_id,
    store,
    quantity: qty,
    minimum_threshold: minT,
    below_minimum: qty <= minT,
  });
});

// ─────────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────────
app.get('/api/suppliers', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});

app.post('/api/suppliers', authMiddleware, (req, res) => {
  const { name, contact, email, nif, address, is_active = true } = req.body;
  if (!name || !nif) return res.status(400).json({ error: 'name e nif são obrigatórios' });
  const id = genId();
  db.prepare('INSERT INTO suppliers (id, name, contact, email, nif, address, is_active) VALUES (?,?,?,?,?,?,?)')
    .run(id, name, contact || '', email || '', nif, address || '', is_active ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(id));
});

app.put('/api/suppliers/:id', authMiddleware, (req, res) => {
  const { name, contact, email, nif, address, is_active } = req.body;
  const e = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Fornecedor não encontrado' });
  db.prepare('UPDATE suppliers SET name=?, contact=?, email=?, nif=?, address=?, is_active=? WHERE id=?')
    .run(name ?? e.name, contact ?? e.contact, email ?? e.email, nif ?? e.nif, address ?? e.address, is_active !== undefined ? (is_active ? 1 : 0) : e.is_active, req.params.id);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id));
});

app.delete('/api/suppliers/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// PROMOTIONS
// ─────────────────────────────────────────────
function parsePromotionStores(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch { /* trata como string única */ }
  }
  return null;
}

function decoratePromotion(row) {
  if (!row) return row;
  let stores = null;
  if (row.applies_to_stores) {
    try { stores = JSON.parse(row.applies_to_stores); } catch { stores = null; }
  }
  return { ...row, applies_to_stores_list: stores };
}

app.get('/api/promotions', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM promotions ORDER BY created_date DESC').all();
  res.json(rows.map(decoratePromotion));
});

app.post('/api/promotions', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas administradores ou gerentes podem criar promoções.' });
  }
  const { name, type, value, applies_to, target_id, target_name, start_date, end_date, is_active = true, applies_to_stores } = req.body;
  const id = genId();
  const now = new Date().toISOString();
  const storesJson = parsePromotionStores(applies_to_stores);
  db.prepare('INSERT INTO promotions (id, name, type, value, applies_to, target_id, target_name, start_date, end_date, is_active, applies_to_stores, created_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, name, type, value, applies_to, target_id || null, target_name || null, start_date, end_date, is_active ? 1 : 0, storesJson, now);
  const created = db.prepare('SELECT * FROM promotions WHERE id=?').get(id);
  logAudit(req, {
    action: 'promotion_created',
    entity: 'promotion',
    entity_id: id,
    severity: 'medium',
    payload: { name, type, value, applies_to, target_name, applies_to_stores: storesJson },
  });
  res.status(201).json(decoratePromotion(created));
});

app.put('/api/promotions/:id', authMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM promotions WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Promoção não encontrada' });
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas administradores ou gerentes podem editar promoções.' });
  }
  const { name, type, value, applies_to, target_id, target_name, start_date, end_date, is_active, applies_to_stores } = req.body;
  const storesJson = applies_to_stores !== undefined ? parsePromotionStores(applies_to_stores) : e.applies_to_stores;
  db.prepare('UPDATE promotions SET name=?, type=?, value=?, applies_to=?, target_id=?, target_name=?, start_date=?, end_date=?, is_active=?, applies_to_stores=? WHERE id=?')
    .run(name ?? e.name, type ?? e.type, value ?? e.value, applies_to ?? e.applies_to, target_id ?? e.target_id, target_name ?? e.target_name, start_date ?? e.start_date, end_date ?? e.end_date, is_active !== undefined ? (is_active ? 1 : 0) : e.is_active, storesJson, req.params.id);
  const updated = db.prepare('SELECT * FROM promotions WHERE id=?').get(req.params.id);
  logAudit(req, {
    action: 'promotion_updated',
    entity: 'promotion',
    entity_id: req.params.id,
    severity: 'medium',
    payload: { before: e, after: updated },
  });
  res.json(decoratePromotion(updated));
});

app.delete('/api/promotions/:id', authMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM promotions WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Promoção não encontrada' });
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas administradores ou gerentes podem remover promoções.' });
  }
  db.prepare('DELETE FROM promotions WHERE id=?').run(req.params.id);
  logAudit(req, {
    action: 'promotion_deleted',
    entity: 'promotion',
    entity_id: req.params.id,
    severity: 'high',
    payload: { name: e.name },
  });
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// USERS (Employees)
// ─────────────────────────────────────────────
app.get('/api/users', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT id, email, full_name, role, store, is_active, created_date FROM users ORDER BY full_name').all());
});

app.post('/api/users', authMiddleware, (req, res) => {
  const bcrypt = require('bcryptjs');
  const { email, full_name, role = 'cashier', store, password = '123456', is_active = true } = req.body;
  if (!email || !full_name) return res.status(400).json({ error: 'email e full_name são obrigatórios' });
  if (!['admin', 'manager', 'cashier', 'repositor'].includes(role)) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }
  if (role !== 'admin' && !store) return res.status(400).json({ error: 'A loja é obrigatória para os perfis com loja associada.' });
  const id = genId();
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (id, email, full_name, role, store, password_hash, is_active, created_date) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, email, full_name, role, role === 'admin' ? 'Sede' : store, hash, is_active ? 1 : 0, now);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe um utilizador com esse email.' });
    }
    throw e;
  }
  const created = db.prepare('SELECT id, email, full_name, role, store, is_active FROM users WHERE id=?').get(id);
  logAudit(req, {
    action: 'user_created',
    entity: 'user',
    entity_id: id,
    scope: created.store,
    severity: 'medium',
    payload: { email: created.email, role: created.role },
  });
  res.status(201).json(created);
});

app.put('/api/users/:id', authMiddleware, (req, res) => {
  const bcrypt = require('bcryptjs');
  const e = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Utilizador não encontrado' });
  const { email, full_name, role, store, password, is_active } = req.body;
  const nextRole = role ?? e.role;
  const nextIsActive = is_active !== undefined ? (is_active ? 1 : 0) : e.is_active;
  const activeAdmins = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1').get('admin').count;
  const wouldRemoveLastActiveAdmin =
    e.role === 'admin' &&
    e.is_active === 1 &&
    activeAdmins <= 1 &&
    (nextRole !== 'admin' || nextIsActive !== 1);

  if (wouldRemoveLastActiveAdmin) {
    return res.status(400).json({ error: 'O último admin ativo não pode ser rebaixado nem suspenso.' });
  }
  const nextStore = nextRole === 'admin' ? 'Sede' : (store ?? e.store);
  if (nextRole !== 'admin' && !nextStore) {
    return res.status(400).json({ error: 'A loja é obrigatória para gerente e caixa.' });
  }

  const hash = password ? bcrypt.hashSync(password, 10) : e.password_hash;
  db.prepare('UPDATE users SET email=?, full_name=?, role=?, store=?, password_hash=?, is_active=? WHERE id=?')
    .run(email ?? e.email, full_name ?? e.full_name, nextRole, nextStore, hash, nextIsActive, req.params.id);

  const updated = db.prepare('SELECT id, email, full_name, role, store, is_active FROM users WHERE id=?').get(req.params.id);
  logAudit(req, {
    action: 'user_updated',
    entity: 'user',
    entity_id: req.params.id,
    scope: updated.store,
    severity: 'medium',
    payload: {
      email: updated.email,
      role_changed: e.role !== nextRole ? { from: e.role, to: nextRole } : undefined,
      active_changed: e.is_active !== nextIsActive ? { from: e.is_active, to: nextIsActive } : undefined,
      password_changed: !!password || undefined,
    },
  });
  res.json(updated);
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Utilizador não encontrado' });

  // Não permitir remover o último admin ativo
  if (e.role === 'admin' && e.is_active === 1) {
    const active = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1").get().c;
    if (active <= 1) {
      return res.status(400).json({ error: 'O último admin ativo não pode ser removido.' });
    }
  }

  // Se tiver atividade associada, desativar em vez de apagar
  const hasSales = db.prepare('SELECT 1 FROM sales WHERE cashier_email = ? LIMIT 1').get(e.email);
  const hasShifts = db.prepare('SELECT 1 FROM shift_closures WHERE cashier_email = ? LIMIT 1').get(e.email);
  if (hasSales || hasShifts) {
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
    logAudit(req, {
      action: 'user_deactivated',
      entity: 'user',
      entity_id: req.params.id,
      scope: e.store,
      severity: 'high',
      payload: { email: e.email, reason: 'has_activity' },
    });
    return res.json({ success: true, deactivated: true });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logAudit(req, {
    action: 'user_deleted',
    entity: 'user',
    entity_id: req.params.id,
    scope: e.store,
    severity: 'high',
    payload: { email: e.email, role: e.role },
  });
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// POS TERMINALS (caixas por loja)
// ─────────────────────────────────────────────
function normalizePosCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

app.get('/api/pos-terminals', authMiddleware, (req, res) => {
  const { store, include_inactive } = req.query;
  if (!store) return res.status(400).json({ error: 'store é obrigatório.' });
  if (req.user.role === 'cashier' && req.user.store !== store) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  if (req.user.role === 'manager' && req.user.store !== store) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  let q = 'SELECT * FROM pos_terminals WHERE store = ?';
  const params = [store];
  if (include_inactive !== '1') {
    q += ' AND is_active = 1';
  }
  q += ' ORDER BY sort_order ASC, code ASC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/pos-terminals', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas gerentes podem gerir caixas.' });
  }
  const { store, code, label, sort_order } = req.body;
  if (!store || !code) return res.status(400).json({ error: 'store e code são obrigatórios.' });
  if (req.user.role === 'manager' && req.user.store !== store) {
    return res.status(403).json({ error: 'Só pode gerir a sua loja.' });
  }
  const normalized = normalizePosCode(code);
  if (normalized.length < 2) {
    return res.status(400).json({ error: 'Código do caixa inválido (mín. 2 caracteres alfanuméricos).' });
  }

  const id = `pt-${genId()}`;
  try {
    db.prepare(`
      INSERT INTO pos_terminals (id, store, code, label, sort_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(
      id,
      store,
      normalized,
      label != null ? String(label).trim() || null : null,
      sort_order != null ? Number(sort_order) : 0
    );
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe um caixa com este código nesta loja.' });
    }
    throw err;
  }

  const row = db.prepare('SELECT * FROM pos_terminals WHERE id = ?').get(id);
  logAudit(req, {
    action: 'pos_terminal_created',
    entity: 'pos_terminal',
    entity_id: id,
    scope: store,
    severity: 'low',
    payload: { code: normalized, label: row.label },
  });
  res.status(201).json(row);
});

app.put('/api/pos-terminals/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas gerentes podem alterar caixas.' });
  }
  const row = db.prepare('SELECT * FROM pos_terminals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Caixa não encontrado.' });
  if (req.user.role === 'manager' && req.user.store !== row.store) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }

  let { code, label, sort_order, is_active } = req.body;
  let nextCode = row.code;
  if (code !== undefined && code !== null && String(code).trim() !== '') {
    const normalized = normalizePosCode(code);
    if (normalized.length < 2) {
      return res.status(400).json({ error: 'Código do caixa inválido.' });
    }
    nextCode = normalized;
  }
  if (nextCode !== row.code) {
    const clash = db.prepare(`
      SELECT id FROM pos_terminals WHERE store = ? AND code = ? AND id != ?
    `).get(row.store, nextCode, row.id);
    if (clash) return res.status(409).json({ error: 'Já existe outro caixa com este código.' });
  }

  const open = db.prepare(`
    SELECT id FROM shift_closures WHERE store = ? AND pos_terminal_id = ? AND status = 'open' LIMIT 1
  `).get(row.store, row.code);
  if (open && nextCode !== row.code) {
    return res.status(409).json({ error: 'Existe um turno aberto neste caixa. Feche-o antes de mudar o código.' });
  }

  if (is_active === 0 || is_active === false) {
    const openSame = db.prepare(`
      SELECT id FROM shift_closures WHERE store = ? AND pos_terminal_id = ? AND status = 'open' LIMIT 1
    `).get(row.store, row.code);
    if (openSame) {
      return res.status(409).json({ error: 'Não pode desativar: há um turno aberto neste caixa.' });
    }
  }

  db.prepare(`
    UPDATE pos_terminals
    SET code = ?, label = ?, sort_order = ?, is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    nextCode,
    label !== undefined ? (label != null ? String(label).trim() || null : null) : row.label,
    sort_order != null ? Number(sort_order) : row.sort_order,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM pos_terminals WHERE id = ?').get(req.params.id);
  logAudit(req, {
    action: 'pos_terminal_updated',
    entity: 'pos_terminal',
    entity_id: req.params.id,
    scope: row.store,
    severity: 'low',
    payload: { from_code: row.code, to_code: updated.code, is_active: updated.is_active },
  });
  res.json(updated);
});

// ─────────────────────────────────────────────
// REGISTER OPENING FLOATS (gerente define fundo por caixa/dia)
// ─────────────────────────────────────────────
app.get('/api/register-opening-floats', authMiddleware, (req, res) => {
  const { store, business_date } = req.query;
  if (!store || !business_date) {
    return res.status(400).json({ error: 'store e business_date são obrigatórios.' });
  }
  if (req.user.role === 'manager' && req.user.store !== store) {
    return res.status(403).json({ error: 'Sem permissão para esta loja.' });
  }
  if (req.user.role === 'cashier' && req.user.store !== store) {
    return res.status(403).json({ error: 'Sem permissão para esta loja.' });
  }
  const rows = db.prepare(`
    SELECT * FROM register_opening_floats WHERE store = ? AND business_date = ?
    ORDER BY terminal_id
  `).all(store, business_date);
  res.json(rows);
});

app.post('/api/register-opening-floats', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas gerentes podem definir fundos de abertura.' });
  }
  const { store, terminal_id, business_date, opening_float, notes } = req.body;
  if (!store || !terminal_id || !business_date || opening_float === undefined) {
    return res.status(400).json({ error: 'store, terminal_id, business_date e opening_float são obrigatórios.' });
  }
  if (req.user.role === 'manager' && req.user.store !== store) {
    return res.status(403).json({ error: 'Só pode configurar a sua loja.' });
  }
  const ptOk = db.prepare(`
    SELECT 1 FROM pos_terminals WHERE store = ? AND UPPER(code) = UPPER(?) AND is_active = 1
  `).get(store, String(terminal_id).trim());
  if (!ptOk) {
    return res.status(400).json({
      error: 'Este código de caixa não existe ou está inativo para a loja. Adicione-o em Caixas da loja.',
    });
  }
  try {
    ensureDayNotClosed(store, business_date);
  } catch (err) {
    return res.status(err.status || 409).json({ error: err.message });
  }
  const now = new Date().toISOString();
  const val = Number(opening_float);
  const existing = db.prepare(`
    SELECT id FROM register_opening_floats WHERE store = ? AND terminal_id = ? AND business_date = ?
  `).get(store, terminal_id, business_date);

  if (existing) {
    db.prepare(`
      UPDATE register_opening_floats
      SET opening_float = ?, set_by_email = ?, set_by_name = ?, notes = ?, created_at = ?
      WHERE id = ?
    `).run(val, req.user.email, req.user.full_name || '', notes || null, now, existing.id);
  } else {
    const id = `rof-${genId()}`;
    db.prepare(`
      INSERT INTO register_opening_floats (
        id, store, terminal_id, business_date, opening_float, set_by_email, set_by_name, notes, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, store, terminal_id, business_date, val, req.user.email, req.user.full_name || '', notes || null, now);
  }

  const row = db.prepare(`
    SELECT * FROM register_opening_floats WHERE store = ? AND terminal_id = ? AND business_date = ?
  `).get(store, terminal_id, business_date);

  logAudit(req, {
    action: 'register_opening_float_set',
    entity: 'register_opening_float',
    entity_id: row.id,
    scope: store,
    severity: 'medium',
    payload: { terminal_id, business_date, opening_float: val },
  });
  res.status(201).json(row);
});

// ─────────────────────────────────────────────
// CASH DROPS (sangrias — aprovação gerente)
// ─────────────────────────────────────────────
app.get('/api/cash-drops', authMiddleware, (req, res) => {
  const { store, shift_closure_id, status } = req.query;
  const conditions = [];
  const params = [];
  if (store) {
    conditions.push('store = ?');
    params.push(store);
  }
  if (shift_closure_id) {
    conditions.push('shift_closure_id = ?');
    params.push(shift_closure_id);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM cash_drops ${where} ORDER BY created_at DESC`).all(...params);
  res.json(rows);
});

app.post('/api/cash-drops', authMiddleware, (req, res) => {
  if (req.user.role !== 'cashier') {
    return res.status(403).json({ error: 'Apenas operadores de caixa podem pedir sangrias.' });
  }
  const { shift_closure_id, amount, reason } = req.body;
  if (!shift_closure_id || amount === undefined) {
    return res.status(400).json({ error: 'shift_closure_id e amount são obrigatórios.' });
  }
  const sh = db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(shift_closure_id);
  if (!sh || sh.status !== 'open') return res.status(400).json({ error: 'Turno inválido ou já fechado.' });
  if (sh.cashier_email !== req.user.email || sh.store !== req.user.store) {
    return res.status(403).json({ error: 'Este turno não lhe pertence.' });
  }
  try {
    ensureDayNotClosed(sh.store, sh.shift_date);
  } catch (err) {
    return res.status(err.status || 409).json({ error: err.message });
  }

  const id = `cdr-${genId()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cash_drops (
      id, shift_closure_id, store, amount, reason, status,
      requested_by_email, requested_by_name, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    shift_closure_id,
    sh.store,
    Number(amount),
    reason || null,
    'pending',
    req.user.email,
    req.user.full_name || '',
    now
  );

  const created = db.prepare('SELECT * FROM cash_drops WHERE id = ?').get(id);
  logAudit(req, {
    action: 'cash_drop_requested',
    entity: 'cash_drop',
    entity_id: id,
    scope: sh.store,
    severity: 'medium',
    payload: { shift_closure_id, amount: Number(amount), reason: reason || null },
  });
  res.status(201).json(created);
});

app.put('/api/cash-drops/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas gerentes podem aprovar ou rejeitar sangrias.' });
  }
  const row = db.prepare('SELECT * FROM cash_drops WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sangria não encontrada.' });
  if (req.user.role === 'manager' && req.user.store !== row.store) {
    return res.status(403).json({ error: 'Sem permissão nesta loja.' });
  }
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status deve ser approved ou rejected.' });
  }
  if (row.status !== 'pending') {
    return res.status(409).json({ error: 'Esta sangria já foi tratada.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE cash_drops
    SET status = ?, approved_by_email = ?, approved_by_name = ?, approved_at = ?
    WHERE id = ?
  `).run(status, req.user.email, req.user.full_name || '', now, req.params.id);

  const updated = db.prepare('SELECT * FROM cash_drops WHERE id = ?').get(req.params.id);
  logAudit(req, {
    action: status === 'approved' ? 'cash_drop_approved' : 'cash_drop_rejected',
    entity: 'cash_drop',
    entity_id: req.params.id,
    scope: row.store,
    severity: 'medium',
    payload: {
      amount: row.amount,
      reason: row.reason,
      shift_closure_id: row.shift_closure_id,
      approved_by: req.user.email,
    },
  });
  res.json(updated);
});

// ─────────────────────────────────────────────
// SHIFT CLOSURES / TURNOS (abertura + fecho)
// ─────────────────────────────────────────────
app.get('/api/shift-closures', authMiddleware, (req, res) => {
  const { store, cashier_email, status, pos_terminal_id } = req.query;

  let q = 'SELECT * FROM shift_closures';
  const conditions = [];
  const params = [];

  if (store) {
    conditions.push('store = ?');
    params.push(store);
  }

  if (cashier_email) {
    conditions.push('cashier_email = ?');
    params.push(cashier_email);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (pos_terminal_id) {
    conditions.push('pos_terminal_id = ?');
    params.push(pos_terminal_id);
  }

  if (conditions.length > 0) {
    q += ' WHERE ' + conditions.join(' AND ');
  }

  q += ' ORDER BY created_date DESC';

  res.json(db.prepare(q).all(...params));
});

app.get('/api/shift-closures/my-open', authMiddleware, (req, res) => {
  const { store } = req.query;
  if (!store) return res.status(400).json({ error: 'store é obrigatório.' });
  if (req.user.role !== 'cashier') {
    return res.status(403).json({ error: 'Apenas operador de caixa pode consultar o seu turno aberto.' });
  }
  if (req.user.store !== store) {
    return res.status(403).json({ error: 'Loja inválida.' });
  }
  const row = db.prepare(`
    SELECT * FROM shift_closures
    WHERE store = ? AND cashier_email = ? AND status = 'open'
    ORDER BY datetime(COALESCE(opened_at, created_date)) DESC LIMIT 1
  `).get(store, req.user.email);
  res.json(row || null);
});

app.get('/api/shift-closures/active', authMiddleware, (req, res) => {
  const { store, pos_terminal_id } = req.query;
  if (!store || !pos_terminal_id) {
    return res.status(400).json({ error: 'store e pos_terminal_id são obrigatórios.' });
  }
  if (req.user.role === 'cashier' && req.user.store !== store) {
    return res.status(403).json({ error: 'Loja inválida.' });
  }
  if (req.user.role === 'manager' && req.user.store !== store) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  const row = db.prepare(`
    SELECT * FROM shift_closures
    WHERE store = ? AND pos_terminal_id = ? AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1
  `).get(store, pos_terminal_id);
  res.json(row || null);
});

app.get('/api/shift-closures/:id/cash-summary', authMiddleware, (req, res) => {
  const sh = db.prepare('SELECT * FROM shift_closures WHERE id=?').get(req.params.id);
  if (!sh) return res.status(404).json({ error: 'Turno não encontrado.' });
  if (req.user.role === 'cashier') {
    if (sh.cashier_email !== req.user.email || sh.store !== req.user.store) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }
  } else if (req.user.role === 'manager' && req.user.store !== sh.store) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  const cashInfo = computeShiftExpectedDrawerCash(sh.id);
  const pendingDrops = db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS s FROM cash_drops WHERE shift_closure_id = ? AND status = 'pending'
  `).get(sh.id);
  res.json({
    ...cashInfo,
    shift_id: sh.id,
    pos_terminal_id: sh.pos_terminal_id,
    shift_status: sh.status,
    opening_expected_cash: sh.opening_expected_cash,
    opening_declared_cash: sh.opening_declared_cash,
    opening_mismatch: !!sh.opening_mismatch,
    pending_drops_total: Number(pendingDrops?.s || 0),
  });
});

app.post('/api/shift-closures/open', authMiddleware, (req, res) => {
  if (req.user.role !== 'cashier') {
    return res.status(403).json({ error: 'Apenas caixa pode abrir turno.' });
  }
  const { store, pos_terminal_id, opening_declared_cash, shift_date: bodyDate } = req.body;
  if (!store || !pos_terminal_id || opening_declared_cash === undefined) {
    return res.status(400).json({ error: 'store, pos_terminal_id e opening_declared_cash são obrigatórios.' });
  }
  if (req.user.store !== store) {
    return res.status(403).json({ error: 'A loja não corresponde ao seu utilizador.' });
  }

  const termRow = db.prepare(`
    SELECT * FROM pos_terminals WHERE store = ? AND UPPER(TRIM(code)) = UPPER(TRIM(?)) AND is_active = 1
  `).get(store, pos_terminal_id);
  if (!termRow) {
    return res.status(400).json({
      error: 'Caixa inválido ou inativo. O gerente tem de registá-lo na configuração da loja.',
    });
  }
  const posCode = termRow.code;

  const shift_date = bodyDate || todayISODate();
  try {
    ensureDayNotClosed(store, shift_date);
  } catch (err) {
    return res.status(err.status || 409).json({ error: err.message });
  }

  // RNF05 — bloquear abertura de turno se o dia anterior não foi fechado
  // Só bloqueia se houver turnos submetidos/aprovados ontem sem fecho de dia.
  // Vendas sem shift_closure (ex: seed/importação) não disparam o bloqueio.
  const yesterday = new Date(shift_date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const prevDayClosed = db.prepare(`
    SELECT id FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL
  `).get(store, yesterdayStr);
  const prevDayHadClosedShifts = db.prepare(`
    SELECT id FROM shift_closures
    WHERE store = ? AND shift_date = ? AND status IN ('pending_approval', 'approved', 'closed')
    LIMIT 1
  `).get(store, yesterdayStr);
  if (prevDayHadClosedShifts && !prevDayClosed) {
    return res.status(409).json({
      error: `O dia ${yesterdayStr} da loja "${store}" ainda não foi fechado. O gerente tem de fazer o fecho do dia anterior antes de abrir novos turnos.`,
      code: 'PREV_DAY_NOT_CLOSED',
      previous_date: yesterdayStr,
    });
  }

  const other = db.prepare(`
    SELECT id FROM shift_closures WHERE store = ? AND pos_terminal_id = ? AND status = 'open' LIMIT 1
  `).get(store, posCode);
  if (other) {
    return res.status(409).json({ error: 'Já existe um turno aberto neste caixa. Feche-o antes de abrir outro.' });
  }

  const reg = db.prepare(`
    SELECT opening_float FROM register_opening_floats
    WHERE store = ? AND UPPER(TRIM(terminal_id)) = UPPER(TRIM(?)) AND business_date = ?
  `).get(store, posCode, shift_date);

  const opening_expected = reg ? Number(reg.opening_float) : 0;
  const opening_declared = Number(opening_declared_cash);
  const opening_mismatch = Math.abs(opening_expected - opening_declared) >= 0.01 ? 1 : 0;

  const id = `sh-${genId()}`;
  const now = new Date().toISOString();
  const startTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  db.prepare(`
    INSERT INTO shift_closures (
      id, store, cashier_email, cashier_name, shift_date, start_time, end_time,
      expected_cash, counted_cash, withdrawn_cash, cash_left_in_store,
      discrepancy, total_sales, num_transactions, status, created_date,
      pos_terminal_id, opening_expected_cash, opening_declared_cash, opening_mismatch, opened_at
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    store,
    req.user.email,
    req.user.full_name || '',
    shift_date,
    startTime,
    null,
    opening_declared,
    0,
    0,
    0,
    0,
    0,
    0,
    'open',
    now,
    posCode,
    opening_expected,
    opening_declared,
    opening_mismatch,
    now
  );

  const created = db.prepare('SELECT * FROM shift_closures WHERE id=?').get(id);
  logAudit(req, {
    action: opening_mismatch ? 'shift_opened_mismatch' : 'shift_opened',
    entity: 'shift_closure',
    entity_id: id,
    scope: store,
    severity: opening_mismatch ? 'high' : 'medium',
    payload: {
      pos_terminal_id: posCode,
      opening_expected_cash: opening_expected,
      opening_declared_cash: opening_declared,
      cashier_email: req.user.email,
    },
  });

  res.status(201).json({
    ...created,
    opening_warning: opening_mismatch
      ? `O valor contado (${opening_declared.toFixed(2)}€) não coincide com o fundo definido pelo gerente (${opening_expected.toFixed(2)}€). O turno foi aberto na mesma; informe o gerente.`
      : null,
  });
});

/** @deprecated Em POS novo o fecho usa PUT /api/shift-closures/:id no turno aberto */
app.post('/api/shift-closures', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (status === 'pending_approval') {
    return res.status(400).json({
      error: 'Utilize PUT /api/shift-closures/:id no turno aberto para submeter o fecho.',
    });
  }
  return res.status(400).json({ error: 'Utilize POST /api/shift-closures/open para abrir um turno.' });
});

app.put('/api/shift-closures/:id', authMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM shift_closures WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Fecho de turno não encontrado' });

  let {
    end_time,
    counted_cash,
    withdrawn_cash,
    cash_left_in_store,
    discrepancy,
    total_sales,
    num_transactions,
    status,
  } = req.body;

  const closing = e.status === 'open' && status === 'pending_approval';
  if (closing) {
    if (req.user.role !== 'cashier' || req.user.email !== e.cashier_email) {
      return res.status(403).json({ error: 'Só o operador do turno pode submeter o fecho.' });
    }
    const cashInfo = computeShiftExpectedDrawerCash(e.id);
    if (!cashInfo) return res.status(400).json({ error: 'Não foi possível calcular o numerário esperado.' });

    const pending = db.prepare(`
      SELECT COALESCE(SUM(amount),0) AS s FROM cash_drops
      WHERE shift_closure_id = ? AND status = 'pending'
    `).get(e.id);
    if (Number(pending?.s || 0) > 0) {
      return res.status(409).json({
        error: 'Existem sangrias por aprovar. O gerente deve aprovar ou rejeitar antes do fecho.',
      });
    }

    const agg = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS t, COUNT(*) AS c FROM sales
      WHERE shift_closure_id = ? AND status = 'completed'
    `).get(e.id);

    total_sales = Number(agg?.t || 0);
    num_transactions = Number(agg?.c || 0);
    const expectedCash = cashInfo.expected_drawer_cash;
    const counted = Number(counted_cash);
    if (Number.isNaN(counted) || counted_cash === undefined || counted_cash === null || counted_cash === '') {
      return res.status(400).json({ error: 'Indique o numerário contado (counted_cash).' });
    }
    discrepancy = counted - expectedCash;
    counted_cash = counted;
  }

  const approving = status === 'approved' && e.status !== 'approved' && e.status !== 'closed';
  if (approving) {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Apenas gerentes podem aprovar fechos de turno.' });
    }
    if (req.user.role === 'manager' && req.user.store !== e.store) {
      return res.status(403).json({ error: 'Só pode aprovar fechos da sua loja.' });
    }
    if (e.status !== 'pending_approval') {
      return res.status(409).json({ error: 'Este turno não está pendente de aprovação.' });
    }
  }

  const approvedByEmail = approving ? req.user.email : e.approved_by_email;
  const approvedByName = approving ? req.user.full_name : e.approved_by_name;
  const approvedDate = approving ? new Date().toISOString() : e.approved_date;

  let expected_cash_final = e.expected_cash;
  if (closing) {
    const c2 = computeShiftExpectedDrawerCash(e.id);
    expected_cash_final = c2.expected_drawer_cash;
  }

  db.prepare(`
    UPDATE shift_closures
    SET end_time=?,
        expected_cash=?,
        counted_cash=?,
        withdrawn_cash=?,
        cash_left_in_store=?,
        discrepancy=?,
        total_sales=?,
        num_transactions=?,
        status=?,
        approved_by_email=?,
        approved_by_name=?,
        approved_date=?
    WHERE id=?
  `).run(
    end_time ?? e.end_time,
    closing ? expected_cash_final : (req.body.expected_cash ?? e.expected_cash),
    counted_cash ?? e.counted_cash,
    withdrawn_cash ?? e.withdrawn_cash,
    cash_left_in_store ?? e.cash_left_in_store,
    discrepancy ?? e.discrepancy,
    total_sales ?? e.total_sales,
    num_transactions ?? e.num_transactions,
    status ?? e.status,
    approvedByEmail,
    approvedByName,
    approvedDate,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM shift_closures WHERE id=?').get(req.params.id);
  if (closing && updated) {
    const left = Number(updated.cash_left_in_store ?? 0);
    const termRaw = String(e.pos_terminal_id || '').trim();
    const bizDate = String(e.shift_date || '').slice(0, 10);
    if (termRaw && bizDate && e.store) {
      const pt = db.prepare(`
        SELECT code FROM pos_terminals
        WHERE store = ? AND UPPER(TRIM(code)) = UPPER(TRIM(?)) AND is_active = 1
      `).get(e.store, termRaw);
      const termId = pt?.code || termRaw;
      const nowIso = new Date().toISOString();
      const note = 'Actualizado automaticamente com o numerário que ficou em caixa no fecho do turno.';
      const existing = db.prepare(`
        SELECT id FROM register_opening_floats
        WHERE store = ? AND UPPER(TRIM(terminal_id)) = UPPER(TRIM(?)) AND business_date = ?
      `).get(e.store, termId, bizDate);
      if (existing) {
        db.prepare(`
          UPDATE register_opening_floats
          SET opening_float = ?, set_by_email = ?, set_by_name = ?, notes = ?, created_at = ?
          WHERE id = ?
        `).run(left, req.user.email, req.user.full_name || '', note, nowIso, existing.id);
      } else {
        const rid = `rof-${genId()}`;
        db.prepare(`
          INSERT INTO register_opening_floats (
            id, store, terminal_id, business_date, opening_float, set_by_email, set_by_name, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?)
        `).run(rid, e.store, termId, bizDate, left, req.user.email, req.user.full_name || '', note, nowIso);
      }
    }
    logAudit(req, {
      action: 'shift_submitted',
      entity: 'shift_closure',
      entity_id: req.params.id,
      scope: e.store,
      severity: Math.abs(discrepancy || 0) >= 0.01 ? 'high' : 'medium',
      payload: {
        expected_cash: expected_cash_final,
        counted_cash: counted_cash,
        discrepancy,
        total_sales: updated.total_sales,
        pos_terminal_id: e.pos_terminal_id,
        register_float_rolled_to_cash_left: Number(updated.cash_left_in_store ?? 0),
      },
    });
  }
  if (status && status !== e.status) {
    logAudit(req, {
      action: status === 'approved' ? 'shift_approved' : status === 'rejected' ? 'shift_rejected' : `shift_status_${status}`,
      entity: 'shift_closure',
      entity_id: req.params.id,
      scope: e.store,
      severity: status === 'rejected' ? 'high' : 'medium',
      payload: {
        from: e.status,
        to: status,
        total_sales: updated.total_sales,
        discrepancy: updated.discrepancy,
        closed_with_difference: Math.abs(Number(updated.discrepancy || 0)) >= 0.01,
      },
    });
  }
  res.json(updated);
});

// ─────────────────────────────────────────────
// SUPPLIER ORDERS
// ─────────────────────────────────────────────
app.get('/api/supplier-orders', authMiddleware, (req, res) => {
  const orders = db.prepare('SELECT * FROM supplier_orders ORDER BY created_date DESC').all();
  const itemsStmt = db.prepare('SELECT * FROM supplier_order_items WHERE order_id=?');
  res.json(orders.map(o => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.post('/api/supplier-orders', authMiddleware, (req, res) => {
  const { supplier_id, supplier_name, store, items = [], total, urgency = 'normal', status = 'pending', notes } = req.body;
  for (const item of items) {
    const product = db.prepare('SELECT supplier_name FROM products WHERE id = ?').get(item.product_id);
    if (product?.supplier_name && product.supplier_name !== supplier_name) {
      return res.status(400).json({ error: `${item.product_name} pertence ao fornecedor ${product.supplier_name}.` });
    }
  }
  const id = genId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO supplier_orders (id, supplier_id, supplier_name, store, total, urgency, status, notes, created_date) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, supplier_id, supplier_name || '', store, total || 0, urgency, status, notes || '', now);
  const ins = db.prepare('INSERT INTO supplier_order_items (id, order_id, product_id, product_name, quantity, unit_cost, serial_number, expiry_date) VALUES (?,?,?,?,?,?,?,?)');
  for (const item of items) ins.run(genId(), id, item.product_id, item.product_name, item.quantity, item.unit_cost || 0, item.serial_number || null, item.expiry_date || null);
  res.status(201).json({ ...db.prepare('SELECT * FROM supplier_orders WHERE id=?').get(id), items });
});

app.put('/api/supplier-orders/:id', authMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM supplier_orders WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Encomenda não encontrada' });
  const { status, notes, total, urgency, items } = req.body;
  const nextStatus = status ?? e.status;

  if (Array.isArray(items)) {
    const updateItem = db.prepare(`
      UPDATE supplier_order_items
      SET serial_number = ?, expiry_date = ?
      WHERE id = ? AND order_id = ?
    `);
    for (const item of items) {
      updateItem.run(item.serial_number || null, item.expiry_date || null, item.id, req.params.id);
    }
  }

  if (e.status !== 'received' && nextStatus === 'received') {
    const orderItems = db.prepare('SELECT * FROM supplier_order_items WHERE order_id=?').all(req.params.id);
    const insertEntry = db.prepare(`
      INSERT INTO merchandise_entries (id, supplier_id, supplier_name, store, invoice_reference, notes, created_date)
      VALUES (?,?,?,?,?,?,?)
    `);
    const insertEntryItem = db.prepare(`
      INSERT INTO merchandise_entry_items (id, entry_id, product_id, product_name, quantity, serial_number, expiry_date)
      VALUES (?,?,?,?,?,?,?)
    `);
    const entryId = genId();
    const now = new Date().toISOString();

    insertEntry.run(entryId, e.supplier_id || null, e.supplier_name || '', e.store, `ORD-${e.id}`, `Receção automática da encomenda ${e.id}`, now);

    for (const item of orderItems) {
      insertEntryItem.run(genId(), entryId, item.product_id || null, item.product_name, item.quantity, item.serial_number || null, item.expiry_date || null);
      upsertStockLot({
        product_id: item.product_id,
        product_name: item.product_name,
        store: e.store,
        quantity: item.quantity,
        serial_number: item.serial_number,
        expiry_date: item.expiry_date || null,
      });
    }
  }

  db.prepare('UPDATE supplier_orders SET status=?, notes=?, total=?, urgency=? WHERE id=?')
    .run(nextStatus, notes ?? e.notes, total ?? e.total, urgency ?? e.urgency, req.params.id);

  const updatedItems = db.prepare('SELECT * FROM supplier_order_items WHERE order_id=?').all(req.params.id);
  res.json({ ...db.prepare('SELECT * FROM supplier_orders WHERE id=?').get(req.params.id), items: updatedItems });
});

// ─────────────────────────────────────────────
// MERCHANDISE ENTRIES
// ─────────────────────────────────────────────
app.get('/api/merchandise-entries', authMiddleware, (req, res) => {
  const entries = db.prepare('SELECT * FROM merchandise_entries ORDER BY created_date DESC').all();
  const itemsStmt = db.prepare('SELECT * FROM merchandise_entry_items WHERE entry_id=?');
  res.json(entries.map(e => ({ ...e, items: itemsStmt.all(e.id) })));
});

app.post('/api/merchandise-entries', authMiddleware, (req, res) => {
  const { supplier_id, supplier_name, store, items = [], invoice_reference, notes } = req.body;
  const id = genId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO merchandise_entries (id, supplier_id, supplier_name, store, invoice_reference, notes, created_date) VALUES (?,?,?,?,?,?,?)')
    .run(id, supplier_id, supplier_name || '', store, invoice_reference || '', notes || '', now);
  const ins = db.prepare('INSERT INTO merchandise_entry_items (id, entry_id, product_id, product_name, quantity, serial_number, expiry_date) VALUES (?,?,?,?,?,?,?)');
  for (const item of items) {
    ins.run(genId(), id, item.product_id, item.product_name, item.quantity, item.serial_number || null, item.expiry_date || null);
    upsertStockLot({
      product_id: item.product_id,
      product_name: item.product_name,
      store,
      quantity: item.quantity,
      serial_number: item.serial_number,
      expiry_date: item.expiry_date || null,
    });
  }
  res.status(201).json({ ...db.prepare('SELECT * FROM merchandise_entries WHERE id=?').get(id), items });
});

// PUT /api/sales/:id — anular venda (status → cancelled) e repor stock
app.put('/api/sales/:id', authMiddleware, (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });

  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status é obrigatório' });

  if (status === 'cancelled' && sale.status !== 'cancelled') {
    try {
      ensureDayNotClosed(sale.store, String(sale.created_date).slice(0, 10));
    } catch (err) {
      return res.status(err.status || 409).json({ error: err.message });
    }

    const authz = assertCashierManagerApproval(req, sale.store);
    if (!authz.ok) return res.status(403).json({ error: authz.error });

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(sale.id);
    for (const item of items) {
      if (item.stock_id) {
        const updated = db.prepare('UPDATE stock SET quantity = quantity + ? WHERE id = ?')
          .run(item.quantity, item.stock_id);
        if (updated.changes > 0) continue;
      }

      upsertStockLot({
        product_id: item.product_id,
        product_name: item.product_name,
        store: sale.store,
        quantity: item.quantity,
        serial_number: item.serial_number,
        expiry_date: item.expiry_date || null,
      });
    }

    logAudit(req, {
      action: 'sale_cancelled',
      entity: 'sale',
      entity_id: sale.id,
      scope: sale.store,
      severity: 'high',
      payload: {
        invoice_number: sale.invoice_number,
        total: sale.total,
        authorized_by_manager: authz.manager ? authz.manager.email : req.user.email,
      },
    });
  }

  db.prepare('UPDATE sales SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ...db.prepare('SELECT * FROM sales WHERE id=?').get(req.params.id), items: db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(req.params.id) });
});

// ─────────────────────────────────────────────
// AUDIT LOGS — leitura
// ─────────────────────────────────────────────
app.get('/api/audit-logs', authMiddleware, (req, res) => {
  const { from, to, actor, severity, action, entity, q, limit = 200, offset = 0 } = req.query;
  const conditions = [];
  const params = [];

  if (from) { conditions.push('created_at >= ?'); params.push(from); }
  if (to)   { conditions.push('created_at <= ?'); params.push(to); }
  if (actor) {
    conditions.push('(actor_email LIKE ? OR actor_id = ?)');
    params.push(`%${actor}%`, actor);
  }
  if (severity) { conditions.push('severity = ?'); params.push(severity); }
  if (action)   { conditions.push('action = ?'); params.push(action); }
  if (entity)   { conditions.push('entity = ?'); params.push(entity); }
  if (q) {
    conditions.push('(action LIKE ? OR scope LIKE ? OR payload_json LIKE ? OR entity LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Number(limit) || 200, 1000);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const rows = db.prepare(`
    SELECT * FROM audit_logs ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, safeOffset);

  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs ${where}`).get(...params).c;

  res.json({
    total,
    rows: rows.map((row) => ({
      ...row,
      payload: (() => {
        try { return row.payload_json ? JSON.parse(row.payload_json) : null; }
        catch { return null; }
      })(),
    })),
  });
});

// ─────────────────────────────────────────────
// STORES — gestão central de lojas
// ─────────────────────────────────────────────
app.get('/api/stores', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.full_name AS manager_name, u.email AS manager_email
    FROM stores s
    LEFT JOIN users u ON u.id = s.manager_user_id
    ORDER BY s.name COLLATE NOCASE
  `).all();
  res.json(rows);
});

app.post('/api/stores', authMiddleware, adminMiddleware, (req, res) => {
  const { code, name, city, address, manager_user_id, status = 'active' } = req.body;
  if (!name) return res.status(400).json({ error: 'O nome da loja é obrigatório.' });
  const id = `store-${genId()}`;
  const finalCode = String(code || name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12) || 'LOJA';
  try {
    db.prepare(`
      INSERT INTO stores (id, code, name, city, address, manager_user_id, status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, finalCode, name, city || null, address || null, manager_user_id || null, status, new Date().toISOString());
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe uma loja com esse nome ou código.' });
    }
    throw e;
  }
  const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  logAudit(req, { action: 'store_created', entity: 'store', entity_id: id, severity: 'medium', payload: row });
  res.status(201).json(row);
});

app.put('/api/stores/:id', authMiddleware, adminMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Loja não encontrada.' });
  const { code, name, city, address, manager_user_id, status } = req.body;
  const oldName = e.name;
  const newName = name ?? e.name;
  try {
    db.prepare(`
      UPDATE stores SET code=?, name=?, city=?, address=?, manager_user_id=?, status=? WHERE id=?
    `).run(
      code ?? e.code,
      newName,
      city !== undefined ? (city || null) : e.city,
      address !== undefined ? (address || null) : e.address,
      manager_user_id !== undefined ? (manager_user_id || null) : e.manager_user_id,
      status ?? e.status,
      req.params.id
    );
    if (oldName !== newName) {
      // Propaga a renomeação às tabelas que guardam loja como string
      db.prepare('UPDATE users SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE sales SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE stock SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE shift_closures SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE supplier_orders SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE merchandise_entries SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE day_closures SET store = ? WHERE store = ?').run(newName, oldName);
      db.prepare('UPDATE sale_returns SET store = ? WHERE store = ?').run(newName, oldName);
    }
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe uma loja com esse nome ou código.' });
    }
    throw err;
  }
  const updated = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  logAudit(req, { action: 'store_updated', entity: 'store', entity_id: req.params.id, severity: 'medium', payload: { before: e, after: updated } });
  res.json(updated);
});

app.delete('/api/stores/:id', authMiddleware, adminMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Loja não encontrada.' });

  const refs = db.prepare('SELECT COUNT(*) AS c FROM users WHERE store = ?').get(e.name).c
            + db.prepare('SELECT COUNT(*) AS c FROM sales WHERE store = ?').get(e.name).c
            + db.prepare('SELECT COUNT(*) AS c FROM stock WHERE store = ?').get(e.name).c;
  if (refs > 0) {
    db.prepare('UPDATE stores SET status = ? WHERE id = ?').run('inactive', req.params.id);
    logAudit(req, { action: 'store_deactivated', entity: 'store', entity_id: req.params.id, severity: 'high', payload: { name: e.name, refs } });
    return res.json({ success: true, deactivated: true, refs });
  }

  db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
  logAudit(req, { action: 'store_deleted', entity: 'store', entity_id: req.params.id, severity: 'high', payload: { name: e.name } });
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// DASHBOARD — agregações para Manager (loja) e Admin (cadeia)
// ─────────────────────────────────────────────
function dailyKPIs(store, dateISO) {
  const date = String(dateISO || todayISODate()).slice(0, 10);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0) AS total_sales,
      COALESCE(SUM(CASE WHEN status='completed' THEN total_iva ELSE 0 END), 0) AS total_iva,
      COUNT(CASE WHEN status='completed' THEN 1 END) AS transactions,
      COUNT(CASE WHEN status='cancelled' THEN 1 END) AS cancelled
    FROM sales
    WHERE store = ? AND created_date >= ? AND created_date <= ?
  `).get(store, start, end);

  const byMethod = db.prepare(`
    SELECT payment_method AS method, SUM(total) AS total, COUNT(*) AS count
    FROM sales
    WHERE store = ? AND status='completed' AND created_date >= ? AND created_date <= ?
    GROUP BY payment_method
  `).all(store, start, end);

  const hourly = db.prepare(`
    SELECT substr(created_date, 12, 2) AS hour,
           COALESCE(SUM(total), 0) AS total,
           COUNT(*) AS transactions
    FROM sales
    WHERE store = ? AND status='completed' AND created_date >= ? AND created_date <= ?
    GROUP BY hour
    ORDER BY hour
  `).all(store, start, end);

  return { totals, byMethod, hourly };
}

app.get('/api/dashboard/store/:store', authMiddleware, (req, res) => {
  const store = decodeURIComponent(req.params.store);
  const date = String(req.query.date || todayISODate()).slice(0, 10);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const { totals, byMethod, hourly } = dailyKPIs(store, date);

  const lowStock = db.prepare(`
    SELECT product_id, product_name,
      SUM(quantity) AS quantity,
      MAX(minimum_threshold) AS minimum_threshold
    FROM stock
    WHERE store = ?
    GROUP BY product_id, product_name
    HAVING SUM(quantity) <= MAX(minimum_threshold)
    ORDER BY (SUM(quantity) - MAX(minimum_threshold)) ASC
    LIMIT 20
  `).all(store);

  const expiring = db.prepare(`
    SELECT product_name, expiry_date, SUM(quantity) AS quantity
    FROM stock
    WHERE store = ? AND expiry_date IS NOT NULL AND expiry_date != ''
      AND date(expiry_date) <= date('now', '+7 day')
      AND quantity > 0
    GROUP BY product_name, expiry_date
    ORDER BY expiry_date ASC
    LIMIT 10
  `).all(store);

  const topProducts = db.prepare(`
    SELECT si.product_name AS name, SUM(si.quantity) AS units, SUM(si.subtotal) AS revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.store = ? AND s.status='completed' AND s.created_date >= ? AND s.created_date <= ?
    GROUP BY si.product_name
    ORDER BY units DESC
    LIMIT 5
  `).all(store, start, end);

  const openShifts = db.prepare(`
    SELECT * FROM shift_closures
    WHERE store = ? AND shift_date = ? AND status IN ('open', 'pending_approval')
  `).all(store, date);

  const dayClosure = db.prepare(`
    SELECT * FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL
  `).get(store, date);

  const prevDate = addCalendarDaysISO(date, -1);
  const yesterdayDayClosure = db.prepare(`
    SELECT * FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL
  `).get(store, prevDate);
  const pendingShiftApprovals = Number(
    db.prepare(`
      SELECT COUNT(*) AS c FROM shift_closures WHERE store = ? AND status = 'pending_approval'
    `).get(store).c || 0
  );
  const pendingCashDrops = Number(
    db.prepare(`
      SELECT COUNT(*) AS c FROM cash_drops WHERE store = ? AND status = 'pending'
    `).get(store).c || 0
  );

  res.json({
    store,
    date,
    totals,
    byMethod,
    hourly,
    lowStock,
    expiring,
    topProducts,
    openShifts,
    dayClosure: dayClosure || null,
    yesterday: {
      date: prevDate,
      dayClosure: yesterdayDayClosure || null,
    },
    shiftWorkflow: {
      pending_shift_approvals: pendingShiftApprovals,
      pending_cash_drops: pendingCashDrops,
    },
  });
});

app.get('/api/dashboard/global', authMiddleware, adminMiddleware, (req, res) => {
  const date = String(req.query.date || todayISODate()).slice(0, 10);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const stores = db.prepare(`
    SELECT * FROM stores WHERE status = 'active' ORDER BY name COLLATE NOCASE
  `).all();

  const salesByStore = db.prepare(`
    SELECT store,
      COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0) AS total_sales,
      COUNT(CASE WHEN status='completed' THEN 1 END) AS transactions
    FROM sales
    WHERE created_date >= ? AND created_date <= ?
    GROUP BY store
  `).all(start, end);

  const stockBreaks = db.prepare(`
    SELECT store, product_id, product_name,
      SUM(quantity) AS quantity,
      MAX(minimum_threshold) AS minimum_threshold
    FROM stock
    WHERE TRIM(store) != 'Sede'
    GROUP BY store, product_id, product_name
    HAVING SUM(quantity) <= MAX(minimum_threshold)
    ORDER BY (SUM(quantity) - MAX(minimum_threshold)) ASC
    LIMIT 30
  `).all();

  const topCategories = db.prepare(`
    SELECT p.category AS name,
      SUM(si.subtotal) AS sales,
      COUNT(*) AS lines
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE s.status='completed' AND s.created_date >= ? AND s.created_date <= ?
    GROUP BY p.category
    ORDER BY sales DESC
  `).all(start, end);

  const totalSales = topCategories.reduce((sum, c) => sum + Number(c.sales || 0), 0);
  const categoriesWithShare = topCategories.map((c) => ({
    name: c.name,
    sales: Number(c.sales || 0),
    share: totalSales > 0 ? Math.round((Number(c.sales || 0) / totalSales) * 1000) / 10 : 0,
  }));

  const pendingOrders = db.prepare(`
    SELECT id, supplier_name, store, total, status, urgency, created_date
    FROM supplier_orders
    WHERE status IN ('pending', 'sent')
    ORDER BY created_date DESC
    LIMIT 10
  `).all();

  const recentSales = db.prepare(`
    SELECT id, store, total, payment_method, created_date, cashier_name
    FROM sales WHERE status='completed'
    ORDER BY created_date DESC LIMIT 10
  `).all();

  // KPIs agregados
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0) AS total_sales,
      COUNT(CASE WHEN status='completed' THEN 1 END) AS transactions
    FROM sales WHERE created_date >= ? AND created_date <= ?
  `).get(start, end);

  const shiftWorkflow = {
    pending_shift_closures: Number(
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM shift_closures WHERE status = 'pending_approval' AND shift_date = ?`
        )
        .get(date).c || 0
    ),
    open_shifts: Number(
      db.prepare(`SELECT COUNT(*) AS c FROM shift_closures WHERE status = 'open' AND shift_date = ?`).get(date)
        .c || 0
    ),
    pending_cash_drops: Number(
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM cash_drops cd
           JOIN shift_closures sc ON sc.id = cd.shift_closure_id
           WHERE cd.status = 'pending' AND sc.shift_date = ?`
        )
        .get(date).c || 0
    ),
  };
  const pendingShiftClosuresList = db
    .prepare(
      `
    SELECT id, store, shift_date, pos_terminal_id, cashier_name, cashier_email,
           discrepancy, total_sales, opened_at, end_time
    FROM shift_closures
    WHERE status = 'pending_approval' AND shift_date = ?
    ORDER BY datetime(COALESCE(opened_at, end_time, '1970-01-01')) DESC
    LIMIT 14
  `
    )
    .all(date);

  res.json({
    date,
    stores: stores.map((s) => {
      const sales = salesByStore.find((row) => row.store === s.name);
      const breaks = stockBreaks.filter((row) => row.store === s.name).length;
      return {
        ...s,
        daily_sales: Number(sales?.total_sales || 0),
        transactions: Number(sales?.transactions || 0),
        stock_breaks: breaks,
      };
    }),
    salesByStore,
    stockBreaks,
    topCategories: categoriesWithShare,
    pendingOrders,
    recentSales,
    totals,
    shiftWorkflow,
    pendingShiftClosuresList,
  });
});

// ─────────────────────────────────────────────
// RELATÓRIOS COMPARATIVOS — RF16 / UC08
// ─────────────────────────────────────────────
app.get('/api/reports/comparative', authMiddleware, adminMiddleware, (req, res) => {
  const { date_from, date_to, store, category, group_by = 'store' } = req.query;
  const from = date_from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const to   = date_to   || new Date().toISOString().slice(0, 10);
  const fromTs = `${from}T00:00:00`;
  const toTs   = `${to}T23:59:59`;

  const storeFilter   = store    ? `AND s.store = ?`         : '';
  const categoryFilter = category ? `AND p.category = ?`    : '';
  const storeParam    = store    ? [store]    : [];
  const categoryParam = category ? [category] : [];
  const baseParams    = [fromTs, toTs, ...storeParam, ...categoryParam];

  let rows = [];
  if (group_by === 'day') {
    rows = db.prepare(`
      SELECT substr(s.created_date, 1, 10) AS period,
        ROUND(SUM(s.total), 2) AS total_sales,
        COUNT(DISTINCT s.id) AS transactions,
        ROUND(AVG(s.total), 2) AS avg_ticket,
        ROUND(SUM(CASE WHEN s.payment_method='Numerário' THEN s.total ELSE 0 END),2) AS cash,
        ROUND(SUM(CASE WHEN s.payment_method IN ('Cartão','Multibanco') THEN s.total ELSE 0 END),2) AS card,
        ROUND(SUM(CASE WHEN s.payment_method='MB Way' THEN s.total ELSE 0 END),2) AS mbway
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed'
        AND s.created_date >= ? AND s.created_date <= ?
        ${storeFilter} ${categoryFilter}
      GROUP BY period
      ORDER BY period ASC
    `).all(...baseParams);
  } else if (group_by === 'category') {
    rows = db.prepare(`
      SELECT COALESCE(p.category, 'Sem categoria') AS period,
        ROUND(SUM(si.subtotal), 2) AS total_sales,
        COUNT(DISTINCT s.id) AS transactions,
        SUM(si.quantity) AS units_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed'
        AND s.created_date >= ? AND s.created_date <= ?
        ${storeFilter}
      GROUP BY period
      ORDER BY total_sales DESC
    `).all(...[fromTs, toTs, ...storeParam]);
  } else {
    rows = db.prepare(`
      SELECT s.store AS period,
        ROUND(SUM(s.total), 2) AS total_sales,
        COUNT(DISTINCT s.id) AS transactions,
        ROUND(AVG(s.total), 2) AS avg_ticket,
        ROUND(SUM(CASE WHEN s.payment_method='Numerário' THEN s.total ELSE 0 END),2) AS cash,
        ROUND(SUM(CASE WHEN s.payment_method IN ('Cartão','Multibanco') THEN s.total ELSE 0 END),2) AS card,
        ROUND(SUM(CASE WHEN s.payment_method='MB Way' THEN s.total ELSE 0 END),2) AS mbway
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed'
        AND s.created_date >= ? AND s.created_date <= ?
        ${categoryFilter}
      GROUP BY s.store
      ORDER BY total_sales DESC
    `).all(...[fromTs, toTs, ...categoryParam]);
  }

  const totals = rows.reduce((acc, r) => ({
    total_sales: (acc.total_sales || 0) + Number(r.total_sales || 0),
    transactions: (acc.transactions || 0) + Number(r.transactions || 0),
  }), {});

  const categories = db.prepare(`SELECT DISTINCT category FROM products WHERE is_active=1 ORDER BY category`).all().map(r=>r.category);
  const stores = db.prepare(`SELECT DISTINCT store FROM sales WHERE created_date >= ? AND created_date <= ? ORDER BY store`).all(fromTs, toTs).map(r=>r.store);

  res.json({ rows, totals, meta: { from, to, group_by, categories, stores } });
});

// ─────────────────────────────────────────────
// DAY CLOSURES — UC04 (Fecho de Dia Operacional)
// ─────────────────────────────────────────────
app.get('/api/day-closures', authMiddleware, (req, res) => {
  const { store, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (store) { conditions.push('store = ?'); params.push(store); }
  if (from)  { conditions.push('closure_date >= ?'); params.push(from); }
  if (to)    { conditions.push('closure_date <= ?'); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  res.json(db.prepare(`SELECT * FROM day_closures ${where} ORDER BY closure_date DESC`).all(...params));
});

app.get('/api/day-closures/:store/:date', authMiddleware, (req, res) => {
  const row = db.prepare(`
    SELECT * FROM day_closures WHERE store = ? AND closure_date = ?
  `).get(req.params.store, req.params.date);
  res.json(row || null);
});

app.post('/api/day-closures', authMiddleware, (req, res) => {
  const { store, closure_date, notes } = req.body;
  if (!store || !closure_date) return res.status(400).json({ error: 'store e closure_date são obrigatórios.' });

  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Apenas gerentes ou administradores podem fechar o dia.' });
  }
  if (req.user.role === 'manager' && req.user.store && req.user.store !== store) {
    return res.status(403).json({ error: 'Só pode fechar o dia da sua loja.' });
  }

  const existing = db.prepare(`
    SELECT * FROM day_closures WHERE store = ? AND closure_date = ? AND reopened_at IS NULL
  `).get(store, closure_date);
  if (existing) {
    return res.status(409).json({ error: 'O dia já está fechado para esta loja.' });
  }

  const openShifts = db.prepare(`
    SELECT id, cashier_email, cashier_name, status FROM shift_closures
    WHERE store = ? AND shift_date = ? AND status IN ('open', 'pending_approval')
  `).all(store, closure_date);
  if (openShifts.length > 0) {
    return res.status(409).json({
      error: 'Existem turnos por fechar ou por aprovar. Resolva-os antes de fechar o dia.',
      open_shifts: openShifts,
    });
  }

  const pendingDrop = db.prepare(`
    SELECT cd.id FROM cash_drops cd
    JOIN shift_closures sc ON sc.id = cd.shift_closure_id
    WHERE sc.store = ? AND sc.shift_date = ? AND cd.status = 'pending'
    LIMIT 1
  `).get(store, closure_date);
  if (pendingDrop) {
    return res.status(409).json({
      error: 'Existem sangrias por aprovar neste dia. Aprove ou rejeite antes de fechar o dia.',
    });
  }

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(total_sales), 0) AS total_sales,
      COALESCE(SUM(num_transactions), 0) AS total_transactions,
      COALESCE(SUM(discrepancy), 0) AS total_discrepancy,
      COALESCE(SUM(cash_left_in_store), 0) AS total_cash_left,
      COALESCE(SUM(withdrawn_cash), 0) AS total_withdrawn,
      COUNT(*) AS shift_count
    FROM shift_closures
    WHERE store = ? AND shift_date = ? AND status IN ('approved', 'closed')
  `).get(store, closure_date);

  const id = `dayc-${genId()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO day_closures (
      id, store, closure_date, total_sales, total_transactions, total_discrepancy,
      total_cash_left, total_withdrawn, shift_count, closed_by_email, closed_by_name,
      closed_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, store, closure_date,
    stats.total_sales, stats.total_transactions, stats.total_discrepancy,
    stats.total_cash_left, stats.total_withdrawn, stats.shift_count,
    req.user.email, req.user.full_name || null, now, notes || null
  );

  const row = db.prepare('SELECT * FROM day_closures WHERE id = ?').get(id);
  logAudit(req, {
    action: 'day_closed',
    entity: 'day_closure',
    entity_id: id,
    scope: store,
    severity: 'high',
    payload: row,
  });
  res.status(201).json(row);
});

app.post('/api/day-closures/:id/reopen', authMiddleware, adminMiddleware, (req, res) => {
  const e = db.prepare('SELECT * FROM day_closures WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Fecho de dia não encontrado.' });
  if (e.reopened_at) return res.status(409).json({ error: 'Este dia já foi reaberto.' });

  const todayCal = calendarDateStringUTC();
  const closedCal = String(e.closure_date).slice(0, 10);
  if (closedCal !== todayCal) {
    return res.status(403).json({
      error:
        'Só é permitido reabrir o fecho do dia corrente no calendário (hoje). Fechos de datas que já passaram não podem ser revertidos.',
    });
  }

  db.prepare(`
    UPDATE day_closures SET reopened_at = ?, reopened_by_email = ? WHERE id = ?
  `).run(new Date().toISOString(), req.user.email, req.params.id);

  logAudit(req, {
    action: 'day_reopened',
    entity: 'day_closure',
    entity_id: req.params.id,
    scope: e.store,
    severity: 'critical',
    payload: { closure_date: e.closure_date, reason: req.body?.reason || null },
  });

  res.json(db.prepare('SELECT * FROM day_closures WHERE id = ?').get(req.params.id));
});

// ─────────────────────────────────────────────
// SALES RETURNS (devoluções/anulações parciais)
// ─────────────────────────────────────────────
app.post('/api/sales/:id/return', authMiddleware, (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venda não encontrada.' });
  if (sale.status === 'cancelled') return res.status(400).json({ error: 'A venda já está totalmente anulada.' });

  try {
    ensureDayNotClosed(sale.store, String(sale.created_date).slice(0, 10));
  } catch (err) {
    return res.status(err.status || 409).json({ error: err.message });
  }

  const authz = assertCashierManagerApproval(req, sale.store);
  if (!authz.ok) return res.status(403).json({ error: authz.error });

  const { items = [], reason } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Indique pelo menos um item para devolução.' });
  }

  const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  const previouslyReturned = db.prepare(`
    SELECT sale_item_id, COALESCE(SUM(quantity), 0) AS qty
    FROM sale_return_items
    WHERE return_id IN (SELECT id FROM sale_returns WHERE sale_id = ?)
    GROUP BY sale_item_id
  `).all(sale.id);
  const returnedMap = Object.fromEntries(previouslyReturned.map((r) => [r.sale_item_id, Number(r.qty)]));

  for (const item of items) {
    const orig = saleItems.find((s) => s.id === item.sale_item_id);
    if (!orig) return res.status(400).json({ error: `Item ${item.sale_item_id} não pertence a esta venda.` });
    const requested = Number(item.quantity || 0);
    if (!(requested > 0)) return res.status(400).json({ error: 'Quantidade de devolução tem de ser maior que zero.' });
    const alreadyReturned = returnedMap[orig.id] || 0;
    if (requested + alreadyReturned > Number(orig.quantity)) {
      return res.status(400).json({
        error: `Quantidade a devolver (${requested}) excede o disponível para "${orig.product_name}" (${Number(orig.quantity) - alreadyReturned}).`,
      });
    }
  }

  const id = `ret-${genId()}`;
  const now = new Date().toISOString();
  let totalRefunded = 0;

  const result = db.transaction(() => {
    db.prepare(`
      INSERT INTO sale_returns (id, sale_id, store, reason, total_refunded, cashier_email, cashier_name, created_date)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(id, sale.id, sale.store, reason || null, req.user.email || null, req.user.full_name || null, now);

    const insertReturnItem = db.prepare(`
      INSERT INTO sale_return_items (
        id, return_id, sale_item_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal,
        stock_id, serial_number, expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const orig = saleItems.find((s) => s.id === item.sale_item_id);
      const qty = Number(item.quantity);
      const subtotal = Math.round(qty * Number(orig.unit_price) * 100) / 100;
      totalRefunded += subtotal;

      insertReturnItem.run(
        `reti-${genId()}`,
        id,
        orig.id,
        orig.product_id,
        orig.product_name,
        qty,
        orig.unit_price,
        orig.iva_rate,
        subtotal,
        orig.stock_id,
        orig.serial_number,
        orig.expiry_date
      );

      // Repor stock
      if (orig.stock_id) {
        const updated = db.prepare('UPDATE stock SET quantity = quantity + ? WHERE id = ?')
          .run(qty, orig.stock_id);
        if (updated.changes === 0) {
          upsertStockLot({
            product_id: orig.product_id,
            product_name: orig.product_name,
            store: sale.store,
            quantity: qty,
            serial_number: orig.serial_number,
            expiry_date: orig.expiry_date || null,
          });
        }
      } else {
        upsertStockLot({
          product_id: orig.product_id,
          product_name: orig.product_name,
          store: sale.store,
          quantity: qty,
          serial_number: orig.serial_number,
          expiry_date: orig.expiry_date || null,
        });
      }
    }

    db.prepare('UPDATE sale_returns SET total_refunded = ? WHERE id = ?').run(totalRefunded, id);

    // Se TUDO devolvido → marca venda como cancelada
    const remaining = db.prepare(`
      SELECT
        (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE sale_id = ?) -
        (SELECT COALESCE(SUM(quantity), 0) FROM sale_return_items
         WHERE return_id IN (SELECT id FROM sale_returns WHERE sale_id = ?)) AS qty
    `).get(sale.id, sale.id);
    if (Number(remaining?.qty || 0) <= 0) {
      db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('cancelled', sale.id);
    }
  });
  result();

  const created = db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(id);
  const createdItems = db.prepare('SELECT * FROM sale_return_items WHERE return_id = ?').all(id);

  logAudit(req, {
    action: 'sale_returned',
    entity: 'sale',
    entity_id: sale.id,
    scope: sale.store,
    severity: 'medium',
    payload: {
      return_id: id,
      total_refunded: totalRefunded,
      items: createdItems.length,
      reason: reason || null,
      authorized_by_manager: authz.manager ? authz.manager.email : req.user.email,
    },
  });

  res.status(201).json({ ...created, items: createdItems });
});

app.get('/api/sales/:id/returns', authMiddleware, (req, res) => {
  const returns = db.prepare('SELECT * FROM sale_returns WHERE sale_id = ? ORDER BY created_date DESC').all(req.params.id);
  const itemsStmt = db.prepare('SELECT * FROM sale_return_items WHERE return_id = ?');
  res.json(returns.map((r) => ({ ...r, items: itemsStmt.all(r.id) })));
});

// ─────────────────────────────────────────────
// DAILY REPORT (UC07) — fecho do dia por caixa
// ─────────────────────────────────────────────
app.get('/api/sales/daily-report', authMiddleware, (req, res) => {
  const { date = todayISODate(), store, cashier } = req.query;
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const conditions = [
    's.created_date >= ?',
    's.created_date <= ?',
    "u.role = 'cashier'",
    'u.is_active = 1',
    'u.store = s.store',
  ];
  const params = [start, end];
  if (store)   { conditions.push('s.store = ?');         params.push(store); }
  if (cashier) { conditions.push('s.cashier_email = ?'); params.push(cashier); }

  const fromSalesWithUsers = `
    FROM sales s
    JOIN users u ON LOWER(u.email) = LOWER(s.cashier_email)
  `;
  const where = `WHERE ${conditions.join(' AND ')}`;

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN s.status='completed' THEN s.total ELSE 0 END), 0) AS total_sales,
      COALESCE(SUM(CASE WHEN s.status='completed' THEN s.total_iva ELSE 0 END), 0) AS total_iva,
      COUNT(CASE WHEN s.status='completed' THEN 1 END) AS transactions,
      COUNT(CASE WHEN s.status='cancelled' THEN 1 END) AS cancelled
    ${fromSalesWithUsers} ${where}
  `).get(...params);

  const byMethod = db.prepare(`
    SELECT s.payment_method AS method,
      SUM(CASE WHEN s.status='completed' THEN s.total ELSE 0 END) AS total,
      COUNT(CASE WHEN s.status='completed' THEN 1 END) AS count
    ${fromSalesWithUsers} ${where}
    GROUP BY s.payment_method
    ORDER BY total DESC
  `).all(...params);

  const byCashier = db.prepare(`
    SELECT s.cashier_email, COALESCE(u.full_name, s.cashier_name) AS cashier_name,
      SUM(CASE WHEN s.status='completed' THEN s.total ELSE 0 END) AS total,
      COUNT(CASE WHEN s.status='completed' THEN 1 END) AS transactions,
      COUNT(CASE WHEN s.status='cancelled' THEN 1 END) AS cancelled
    ${fromSalesWithUsers} ${where}
    GROUP BY s.cashier_email, COALESCE(u.full_name, s.cashier_name)
    ORDER BY total DESC
  `).all(...params);

  const cancelledSales = db.prepare(`
    SELECT s.id, s.invoice_number, s.total, s.payment_method, COALESCE(u.full_name, s.cashier_name) AS cashier_name, s.created_date
    ${fromSalesWithUsers} ${where} AND s.status='cancelled'
    ORDER BY s.created_date DESC
  `).all(...params);

  const returns = db.prepare(`
    SELECT r.* FROM sale_returns r
    JOIN sales s ON s.id = r.sale_id
    WHERE r.created_date >= ? AND r.created_date <= ?
      ${store ? 'AND r.store = ?' : ''}
      ${cashier ? 'AND r.cashier_email = ?' : ''}
    ORDER BY r.created_date DESC
  `).all(...[start, end, ...(store ? [store] : []), ...(cashier ? [cashier] : [])]);

  const ticketAvg = totals.transactions > 0 ? Number(totals.total_sales) / totals.transactions : 0;

  res.json({
    date,
    store: store || null,
    cashier: cashier || null,
    totals,
    ticket_average: Math.round(ticketAvg * 100) / 100,
    byMethod,
    byCashier,
    cancelledSales,
    returns,
  });
});

// ─────────────────────────────────────────────
// SAFT-PT (XML simplificado) — UC09
// ─────────────────────────────────────────────
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSaftXml({ from, to, store, sales, products, customers }) {
  const now = new Date().toISOString();
  const fiscalYear = (from || now).slice(0, 4);

  const productsXml = products.map((p) => `
      <Product>
        <ProductType>P</ProductType>
        <ProductCode>${escapeXml(p.id)}</ProductCode>
        <ProductDescription>${escapeXml(p.name)}</ProductDescription>
        <ProductNumberCode>${escapeXml(p.barcode || p.id)}</ProductNumberCode>
      </Product>`).join('');

  const customersXml = customers.map((c, idx) => `
      <Customer>
        <CustomerID>CUST-${escapeXml(c.nif || `unk-${idx + 1}`)}</CustomerID>
        <AccountID>Desconhecido</AccountID>
        <CustomerTaxID>${escapeXml(c.nif || '999999990')}</CustomerTaxID>
        <CompanyName>${escapeXml(c.name || 'Consumidor final')}</CompanyName>
        <BillingAddress>
          <AddressDetail>Desconhecido</AddressDetail>
          <City>Desconhecido</City>
          <PostalCode>0000-000</PostalCode>
          <Country>PT</Country>
        </BillingAddress>
        <SelfBillingIndicator>0</SelfBillingIndicator>
      </Customer>`).join('');

  let totalDebit = 0;
  let totalCredit = 0;

  const invoicesXml = sales.map((sale) => {
    const linesXml = (sale.items || []).map((item, lineNumber) => {
      const credit = Number(item.subtotal || 0);
      totalCredit += credit;
      return `
          <Line>
            <LineNumber>${lineNumber + 1}</LineNumber>
            <ProductCode>${escapeXml(item.product_id)}</ProductCode>
            <ProductDescription>${escapeXml(item.product_name)}</ProductDescription>
            <Quantity>${Number(item.quantity).toFixed(2)}</Quantity>
            <UnitOfMeasure>UN</UnitOfMeasure>
            <UnitPrice>${Number(item.unit_price).toFixed(4)}</UnitPrice>
            <TaxPointDate>${escapeXml(String(sale.created_date).slice(0, 10))}</TaxPointDate>
            <Description>${escapeXml(item.product_name)}</Description>
            <CreditAmount>${credit.toFixed(2)}</CreditAmount>
            <Tax>
              <TaxType>IVA</TaxType>
              <TaxCountryRegion>PT</TaxCountryRegion>
              <TaxCode>${Number(item.iva_rate || 23) === 6 ? 'RED' : Number(item.iva_rate || 23) === 13 ? 'INT' : 'NOR'}</TaxCode>
              <TaxPercentage>${Number(item.iva_rate || 23).toFixed(2)}</TaxPercentage>
            </Tax>
          </Line>`;
    }).join('');

    return `
        <Invoice>
          <InvoiceNo>${escapeXml(sale.invoice_number || sale.id)}</InvoiceNo>
          <DocumentStatus>
            <InvoiceStatus>${sale.status === 'cancelled' ? 'A' : 'N'}</InvoiceStatus>
            <InvoiceStatusDate>${escapeXml(sale.created_date)}</InvoiceStatusDate>
            <SourceID>${escapeXml(sale.cashier_email || 'system')}</SourceID>
            <SourceBilling>P</SourceBilling>
          </DocumentStatus>
          <Hash>0</Hash>
          <HashControl>0</HashControl>
          <Period>${Number(String(sale.created_date).slice(5, 7))}</Period>
          <InvoiceDate>${escapeXml(String(sale.created_date).slice(0, 10))}</InvoiceDate>
          <InvoiceType>${sale.document_type === 'Fatura Simplificada' ? 'FS' : 'FT'}</InvoiceType>
          <SpecialRegimes>
            <SelfBillingIndicator>0</SelfBillingIndicator>
            <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
            <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
          </SpecialRegimes>
          <SourceID>${escapeXml(sale.cashier_email || 'system')}</SourceID>
          <SystemEntryDate>${escapeXml(sale.created_date)}</SystemEntryDate>
          <CustomerID>CUST-${escapeXml(sale.customer_nif || '999999990')}</CustomerID>${linesXml}
          <DocumentTotals>
            <TaxPayable>${Number(sale.total_iva || 0).toFixed(2)}</TaxPayable>
            <NetTotal>${(Number(sale.total || 0) - Number(sale.total_iva || 0)).toFixed(2)}</NetTotal>
            <GrossTotal>${Number(sale.total || 0).toFixed(2)}</GrossTotal>
          </DocumentTotals>
        </Invoice>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>999999990</CompanyID>
    <TaxRegistrationNumber>999999990</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>FlashStore Retail S.A.</CompanyName>
    <BusinessName>FlashStore</BusinessName>
    <CompanyAddress>
      <AddressDetail>Rua Exemplo</AddressDetail>
      <City>Braga</City>
      <PostalCode>4700-000</PostalCode>
      <Country>PT</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${escapeXml(from)}</StartDate>
    <EndDate>${escapeXml(to)}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${now.slice(0, 10)}</DateCreated>
    <TaxEntity>${escapeXml(store || 'Global')}</TaxEntity>
    <ProductCompanyTaxID>999999990</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>FlashStore/FlashStore</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <MasterFiles>
    <Customer>${customersXml}
    </Customer>
    <Product>${productsXml}
    </Product>
    <TaxTable>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>RED</TaxCode>
        <Description>Taxa Reduzida</Description>
        <TaxPercentage>6.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>INT</TaxCode>
        <Description>Taxa Intermédia</Description>
        <TaxPercentage>13.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>Taxa Normal</Description>
        <TaxPercentage>23.00</TaxPercentage>
      </TaxTableEntry>
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${sales.length}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>${invoicesXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>
`;
}

app.get('/api/saft/export', authMiddleware, (req, res) => {
  const { from, to, store } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Os parâmetros from e to (datas YYYY-MM-DD) são obrigatórios.' });
  if (!store) return res.status(400).json({ error: 'O parâmetro store é obrigatório para SAFT-PT.' });

  try {
    const xml = generateSaftXml(db, {
      store,
      startDate: String(from).slice(0, 10),
      endDate: String(to).slice(0, 10),
    });

    const salesCount = db.prepare(
      'SELECT COUNT(*) AS n FROM sales WHERE store = ? AND created_date >= ? AND created_date < ?'
    ).get(store, `${String(from).slice(0, 10)}T00:00:00`, `${String(to).slice(0, 10)}T23:59:59.999`).n;

    logAudit(req, {
      action: 'saft_exported',
      entity: 'saft',
      scope: store,
      severity: 'high',
      payload: { from, to, store, sales: salesCount },
    });

    const filename = `SAFT-PT_${String(from).slice(0, 10)}_${String(to).slice(0, 10)}_${store}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar SAFT-PT: ' + err.message });
  }
});

// ─────────────────────────────────────────────
// SYNC (Electron outbox → central)
// ─────────────────────────────────────────────
app.post('/api/sync/push', authMiddleware, (req, res) => {
  try {
    const syncHelpers = {
      genId,
      allocateStockForSale,
      buildReceiptText,
      ensureDayNotClosed,
      logAudit,
    };
    const result = processSyncPush(db, req, syncHelpers, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Erro no sync push' });
  }
});

// ─────────────────────────────────────────────
// ENDPOINTS — Alertas (RF12, RF13, UC06)
// ─────────────────────────────────────────────
app.get('/api/alerts', authMiddleware, (req, res) => {
  const { store, type, resolved, limit: lim } = req.query;
  const maxLimit = Math.min(parseInt(lim) || 100, 500);
  const params = [];
  let where = 'WHERE 1=1';
  if (store) { where += ' AND store = ?'; params.push(store); }
  if (type) { where += ' AND type = ?'; params.push(type); }
  if (resolved !== undefined) { where += ' AND resolved = ?'; params.push(resolved === 'true' ? 1 : 0); }
  params.push(maxLimit);
  res.json(db.prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ?`).all(...params));
});

app.get('/api/alerts/counts', authMiddleware, (req, res) => {
  const { store } = req.query;
  const params = store ? [store] : [];
  const storeFilter = store ? 'WHERE store = ? AND resolved = 0' : 'WHERE resolved = 0';
  const rows = db.prepare(
    `SELECT type, COUNT(*) AS count FROM alerts ${storeFilter} GROUP BY type`
  ).all(...params);
  const counts = { low_stock: 0, expiry: 0, missing_day_closure: 0, total: 0 };
  rows.forEach((r) => { counts[r.type] = r.count; counts.total += r.count; });
  res.json(counts);
});

app.put('/api/alerts/:id/resolve', authMiddleware, (req, res) => {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alerta não encontrado' });
  db.prepare(
    'UPDATE alerts SET resolved = 1, resolved_at = datetime(\'now\'), resolved_by = ? WHERE id = ?'
  ).run(req.user.email, req.params.id);
  res.json({ ok: true });
});

app.put('/api/alerts/resolve-all', authMiddleware, (req, res) => {
  const { store, type } = req.body;
  if (!store) return res.status(400).json({ error: 'store é obrigatório' });
  const params = [req.user.email, store];
  let extra = '';
  if (type) { extra = ' AND type = ?'; params.push(type); }
  db.prepare(
    `UPDATE alerts SET resolved = 1, resolved_at = datetime('now'), resolved_by = ? WHERE store = ? AND resolved = 0${extra}`
  ).run(...params);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// ENDPOINTS — Snapshots de stock diários (RF14)
// ─────────────────────────────────────────────
app.get('/api/stock-snapshots', authMiddleware, (req, res) => {
  const { store, date_from, date_to } = req.query;
  const params = [];
  let where = 'WHERE 1=1';
  if (store) { where += ' AND store = ?'; params.push(store); }
  if (date_from) { where += ' AND snapshot_date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND snapshot_date <= ?'; params.push(date_to); }
  res.json(db.prepare(
    `SELECT * FROM daily_stock_snapshots ${where} ORDER BY snapshot_date DESC, store ASC`
  ).all(...params));
});

// ─────────────────────────────────────────────
// ENDPOINTS — Sugestão de Reposição (RF12 + Anexo B)
// ─────────────────────────────────────────────

// GET /api/replenishment-suggestions?store=&days=30
// Devolve lista de produtos abaixo do mínimo com quantidade sugerida de encomenda
// baseada na velocidade de vendas dos últimos N dias.
app.get('/api/replenishment-suggestions', authMiddleware, (req, res) => {
  const { store, days: daysParam } = req.query;
  if (!store) return res.status(400).json({ error: 'store é obrigatório' });
  const days = Math.max(1, Math.min(parseInt(daysParam) || 30, 365));
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Stock atual por produto (apenas lotes válidos)
  const stockRows = db.prepare(`
    SELECT product_id, product_name,
           SUM(CASE WHEN expiry_date IS NULL OR expiry_date = '' OR expiry_date >= ?
                    THEN quantity ELSE 0 END) AS valid_qty,
           MAX(minimum_threshold) AS min_threshold
    FROM stock
    WHERE store = ?
    GROUP BY product_id
  `).all(today, store);

  // Velocidade de vendas nos últimos N dias
  const salesRate = db.prepare(`
    SELECT si.product_id, SUM(si.quantity) AS sold_qty
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.store = ? AND s.created_date >= ? AND s.status = 'completed'
    GROUP BY si.product_id
  `).all(store, `${since}T00:00:00`);

  const rateMap = {};
  salesRate.forEach((r) => { rateMap[r.product_id] = Number(r.sold_qty); });

  const suggestions = stockRows
    .filter((r) => Number(r.valid_qty) < Number(r.min_threshold))
    .map((r) => {
      const soldInPeriod = rateMap[r.product_id] || 0;
      const dailyRate = soldInPeriod / days;
      // Sugestão: cobrir 30 dias de consumo + repor até ao threshold
      const suggestedQty = Math.max(
        Math.ceil(dailyRate * 30 + Number(r.min_threshold) - Number(r.valid_qty)),
        Math.ceil(Number(r.min_threshold) * 2 - Number(r.valid_qty))
      );

      const product = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(r.product_id);

      return {
        product_id: r.product_id,
        product_name: r.product_name,
        barcode: product?.barcode || null,
        category: product?.category || null,
        supplier_id: product?.supplier_id || null,
        supplier_name: product?.supplier_name || null,
        current_stock: Number(r.valid_qty),
        minimum_threshold: Number(r.min_threshold),
        sold_last_n_days: soldInPeriod,
        daily_avg_sales: parseFloat(dailyRate.toFixed(3)),
        suggested_order_qty: suggestedQty,
        days_of_stock_remaining: dailyRate > 0 ? Math.floor(Number(r.valid_qty) / dailyRate) : null,
        urgency: Number(r.valid_qty) <= 0 ? 'crítico' : Number(r.valid_qty) < Number(r.min_threshold) * 0.5 ? 'alto' : 'normal',
      };
    })
    .sort((a, b) => {
      const urgencyOrder = { crítico: 0, alto: 1, normal: 2 };
      return (urgencyOrder[a.urgency] - urgencyOrder[b.urgency]) || b.sold_last_n_days - a.sold_last_n_days;
    });

  res.json({ store, period_days: days, since_date: since, suggestions });
});

// POST /api/replenishment-suggestions/create-order
// Cria encomenda ao fornecedor com base nas sugestões selecionadas
app.post('/api/replenishment-suggestions/create-order', authMiddleware, (req, res) => {
  const { store, supplier_id, items, notes } = req.body;
  if (!store || !supplier_id || !items?.length) {
    return res.status(400).json({ error: 'store, supplier_id e items são obrigatórios.' });
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
  if (!supplier) return res.status(404).json({ error: 'Fornecedor não encontrado.' });

  const orderId = `ord-${genId()}`;
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO supplier_orders (id, supplier_id, store, ordered_by_email, status, notes, created_date)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(orderId, supplier_id, store, req.user.email, notes || 'Gerada por sugestão de reposição automática', now);

    const insertItem = db.prepare(`
      INSERT INTO supplier_order_items (id, order_id, product_id, product_name, quantity_ordered, unit_cost)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    items.forEach((item) => {
      insertItem.run(genId(), orderId, item.product_id, item.product_name, item.quantity, item.unit_cost || 0);
    });
  })();

  logAudit(req, {
    action: 'replenishment_order_created',
    entity: 'supplier_order',
    entity_id: orderId,
    scope: store,
    severity: 'info',
    payload: { supplier_id, items: items.length },
  });

  res.status(201).json(db.prepare('SELECT * FROM supplier_orders WHERE id = ?').get(orderId));
});

// ─────────────────────────────────────────────
// ENDPOINTS — RGPD (RNF12)
// ─────────────────────────────────────────────

// Política de retenção: NIF de clientes em faturas com mais de 5 anos são anonimizados
// conforme RGPD Art.º 17 (direito ao apagamento) e obrigações fiscais AT (5 anos)
app.post('/api/admin/rgpd/anonymize-old-nifs', authMiddleware, adminMiddleware, (req, res) => {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const result = db.prepare(`
    UPDATE sales
    SET customer_nif = 'ANONIMIZADO'
    WHERE customer_nif IS NOT NULL
      AND customer_nif != ''
      AND customer_nif != 'ANONIMIZADO'
      AND customer_nif != '999999990'
      AND created_date < ?
  `).run(`${cutoff}T00:00:00`);

  logAudit(req, {
    action: 'rgpd_anonymize_nifs',
    entity: 'sales',
    severity: 'high',
    payload: { cutoff_date: cutoff, rows_updated: result.changes },
  });
  res.json({ ok: true, rows_anonymized: result.changes, cutoff_date: cutoff });
});

// Expurgo de dados pessoais de um NIF específico (direito ao apagamento, Art.º 17 RGPD)
app.post('/api/admin/rgpd/forget-nif', authMiddleware, adminMiddleware, (req, res) => {
  const { nif } = req.body;
  if (!nif || nif === '999999990') return res.status(400).json({ error: 'NIF inválido para expurgo.' });

  const salesCount = db.prepare('SELECT COUNT(*) AS n FROM sales WHERE customer_nif = ?').get(nif).n;

  db.prepare("UPDATE sales SET customer_nif = 'ANONIMIZADO' WHERE customer_nif = ?").run(nif);

  logAudit(req, {
    action: 'rgpd_forget_nif',
    entity: 'sales',
    severity: 'critical',
    payload: { nif_masked: `${nif.slice(0, 3)}****`, rows_updated: salesCount },
  });
  res.json({ ok: true, rows_anonymized: salesCount });
});

// Relatório de retenção de dados pessoais
app.get('/api/admin/rgpd/retention-report', authMiddleware, adminMiddleware, (_req, res) => {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const cutoff = fiveYearsAgo.toISOString().slice(0, 10);

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_sales_with_nif,
      SUM(CASE WHEN created_date < ? THEN 1 ELSE 0 END) AS overdue_for_anonymization,
      COUNT(DISTINCT customer_nif) AS distinct_nifs
    FROM sales
    WHERE customer_nif IS NOT NULL
      AND customer_nif != ''
      AND customer_nif != 'ANONIMIZADO'
      AND customer_nif != '999999990'
  `).get(`${cutoff}T00:00:00`);

  res.json({
    ...stats,
    retention_policy_years: 5,
    cutoff_date: cutoff,
    last_anonymization: db.prepare(
      "SELECT created_at FROM audit_logs WHERE action = 'rgpd_anonymize_nifs' ORDER BY created_at DESC LIMIT 1"
    ).get()?.created_at || null,
  });
});

// ─────────────────────────────────────────────
// ENDPOINTS — Backups (RNF09)
// ─────────────────────────────────────────────
app.get('/api/admin/backups', authMiddleware, adminMiddleware, (_req, res) => {
  res.json(listBackups());
});

app.post('/api/admin/backups', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const dest = await runBackup(db);
    logAudit(req, { action: 'backup_manual', entity: 'database', severity: 'info', payload: { dest } });
    res.json({ ok: true, filename: path.basename(dest) });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar backup: ' + err.message });
  }
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✅ FlashStore API a correr em http://localhost:${PORT}`);
  console.log(`   Documentação dos endpoints disponível no README\n`);
  scheduleDailyBackup(db);
  startScheduler(db);
});
