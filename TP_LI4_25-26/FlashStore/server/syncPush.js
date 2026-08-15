/**
 * FlashStore — sincronização push (Electron → central SQLite)
 */

function assertStoreAccess(req, store) {
  if (!store) {
    const err = new Error('Campo store é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (req.user.role === 'cashier' && req.user.store !== store) {
    const err = new Error('Sem permissão para sincronizar dados de outra loja.');
    err.status = 403;
    throw err;
  }
}

function resolveShiftId(db, shiftClosureId) {
  if (!shiftClosureId) return null;
  const sh = db.prepare('SELECT id FROM shift_closures WHERE id = ?').get(shiftClosureId);
  return sh ? shiftClosureId : null;
}

function resolveCentralProductId(db, item) {
  const byId = db.prepare('SELECT id FROM products WHERE id = ?').get(item.product_id);
  if (byId) return byId.id;

  if (item.product_name) {
    const byName = db
      .prepare(`SELECT id FROM products WHERE name = ? COLLATE NOCASE AND is_active = 1 LIMIT 1`)
      .get(item.product_name);
    if (byName) return byName.id;
  }

  const err = new Error(
    `Produto "${item.product_name || item.product_id}" não existe no servidor central. ` +
      'Com online, aguarde o catálogo importar antes de vender offline.'
  );
  err.status = 400;
  throw err;
}

function allocateForSyncItem(db, allocateStockForSale, item, store) {
  const productId = resolveCentralProductId(db, item);
  const qty = item.quantity;
  const preferred = item.stock_id || null;

  if (preferred) {
    try {
      return allocateStockForSale({
        productId,
        store,
        requestedQuantity: qty,
        preferredStockId: preferred,
      });
    } catch {
      /* lote local pode não existir no central — tenta FIFO */
    }
  }

  try {
    return allocateStockForSale({
      productId,
      store,
      requestedQuantity: qty,
      preferredStockId: null,
    });
  } catch (err) {
    const name =
      db.prepare('SELECT name FROM products WHERE id = ?').get(productId)?.name || 'produto';
    const sellable = db
      .prepare(
        `
      SELECT COALESCE(SUM(quantity), 0) AS q FROM stock
      WHERE product_id = ? AND store = ? AND quantity > 0
        AND (expiry_date IS NULL OR expiry_date = '' OR expiry_date >= date('now'))
    `
      )
      .get(productId, store);
    if (Number(sellable?.q || 0) <= 0) {
      throw Object.assign(
        new Error(
          `Stock insuficiente para ${name}: no central só há lotes expirados ou sem stock válido. ` +
            'Não venda este produto offline até haver entrada de mercadoria.'
        ),
        { status: 400 }
      );
    }
    throw err;
  }
}

function processShiftOpen(db, req, helpers, payload, reqStore) {
  const { genId, logAudit } = helpers;
  const { id, store, pos_terminal_id, cashier_email, cashier_name, shift_date, opening_declared_cash, created_date } = payload;

  assertStoreAccess(req, store || reqStore);

  const shiftId = id || `sh-${genId()}`;
  const existing = db.prepare('SELECT id FROM shift_closures WHERE id = ?').get(shiftId);
  if (existing) return { entity_id: shiftId, skipped: true };

  const now = created_date || new Date().toISOString();
  const date = shift_date || now.slice(0, 10);

  const terminal = pos_terminal_id
    ? db.prepare('SELECT * FROM pos_terminals WHERE store = ? AND UPPER(TRIM(code)) = UPPER(TRIM(?)) AND is_active = 1').get(store, pos_terminal_id)
    : null;
  const posCode = terminal?.code || pos_terminal_id || null;

  db.prepare(`
    INSERT INTO shift_closures (
      id, store, pos_terminal_id, cashier_email, cashier_name, shift_date,
      start_time, opening_declared_cash, status, created_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(
    shiftId, store || reqStore, posCode, cashier_email || req.user.email,
    cashier_name || '', date, now.slice(11, 16),
    Number(opening_declared_cash || 0), now
  );

  logAudit(req, { action: 'shift_synced_open', entity: 'shift_closure', entity_id: shiftId, scope: store, severity: 'info', payload: { source: 'electron_outbox' } });
  return { entity_id: shiftId, skipped: false };
}

function processShiftClose(db, req, helpers, payload, reqStore) {
  const { logAudit } = helpers;
  const { shift_id, store, closing_cash, notes, closed_at } = payload;

  assertStoreAccess(req, store || reqStore);

  const shift = db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(shift_id);
  if (!shift) {
    const err = new Error(`Turno ${shift_id} não encontrado no servidor central.`);
    err.status = 404;
    throw err;
  }
  if (shift.status !== 'open') return { entity_id: shift_id, skipped: true };

  const now = closed_at || new Date().toISOString();
  db.prepare(`
    UPDATE shift_closures
    SET status = 'pending_approval', end_time = ?, closing_declared_cash = ?, notes = ?
    WHERE id = ?
  `).run(now.slice(11, 16), Number(closing_cash || 0), notes || '', shift_id);

  logAudit(req, { action: 'shift_synced_close', entity: 'shift_closure', entity_id: shift_id, scope: store, severity: 'info', payload: { source: 'electron_outbox' } });
  return { entity_id: shift_id, skipped: false };
}

function processSaleCreate(db, req, helpers, payload) {
  const {
    genId,
    allocateStockForSale,
    buildReceiptText,
    ensureDayNotClosed,
    logAudit,
  } = helpers;

  const id = payload.id;
  if (!id) {
    const err = new Error('Venda sem id (obrigatório para sync).');
    err.status = 400;
    throw err;
  }

  const existing = db.prepare('SELECT id FROM sales WHERE id = ?').get(id);
  if (existing) {
    return { entity_id: id, skipped: true };
  }

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
    receipt_number,
    created_date,
    status = 'completed',
    shift_closure_id,
  } = payload;

  if (!store || !items?.length || total == null || !payment_method) {
    const err = new Error('Payload de venda incompleto.');
    err.status = 400;
    throw err;
  }

  assertStoreAccess(req, store);

  const saleDate = String(created_date || new Date().toISOString()).slice(0, 10);
  ensureDayNotClosed(store, saleDate);

  const now = created_date || new Date().toISOString();
  const inv = invoice_number || `FS-SYNC-${Date.now()}`;
  const receiptNum = receipt_number || `TL-SYNC-${Date.now()}`;
  const shiftId = resolveShiftId(db, shift_closure_id);

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
      amount_paid ?? total,
      change_given || 0,
      customer_nif || '',
      cashier_email || '',
      cashier_name || '',
      inv,
      'Fatura Simplificada',
      receiptNum,
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
      const centralProductId = resolveCentralProductId(db, item);
      const allocations = allocateForSyncItem(db, allocateStockForSale, item, store);

      for (const allocation of allocations) {
        const lineSubtotal = Number(allocation.quantity) * Number(item.unit_price || 0);
        const line = {
          ...item,
          product_id: centralProductId,
          quantity: allocation.quantity,
          subtotal: lineSubtotal,
          stock_id: allocation.lot.id,
          serial_number: allocation.lot.serial_number,
          expiry_date: allocation.lot.expiry_date,
          iva_rate: item.iva_rate || 23,
        };

        insertItem.run(
          genId(),
          id,
          centralProductId,
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
    action: 'sale_synced',
    entity: 'sale',
    entity_id: id,
    scope: store,
    severity: 'info',
    payload: {
      invoice_number: inv,
      total: Number(total),
      items: created.items.length,
      source: 'electron_outbox',
    },
  });

  return { entity_id: id, skipped: false };
}

function processSyncPush(db, req, helpers, body) {
  const { store, operations } = body;
  if (!Array.isArray(operations) || operations.length === 0) {
    const err = new Error('Lista operations vazia ou inválida.');
    err.status = 400;
    throw err;
  }

  assertStoreAccess(req, store);

  const results = [];
  const maxBatch = 50;
  const batch = operations.slice(0, maxBatch);

  for (const op of batch) {
    const outboxId = op.outbox_id || op.id;
    const operation = op.operation;
    const payload = op.payload || op.payload_json;

    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

      if (operation === 'sale.create') {
        const saleStore = parsed?.store || store;
        if (!saleStore) {
          results.push({ outbox_id: outboxId, status: 'failed', error: 'Venda sem loja no payload.' });
          continue;
        }
        if (saleStore !== store) {
          results.push({ outbox_id: outboxId, status: 'failed', error: `Loja da venda (${saleStore}) não coincide com o pedido (${store}).` });
          continue;
        }
        const outcome = processSaleCreate(db, req, helpers, parsed);
        results.push({ outbox_id: outboxId, status: 'synced', entity_id: outcome.entity_id, skipped: Boolean(outcome.skipped) });

      } else if (operation === 'shift.open') {
        const outcome = processShiftOpen(db, req, helpers, parsed, store);
        results.push({ outbox_id: outboxId, status: 'synced', entity_id: outcome.entity_id, skipped: Boolean(outcome.skipped) });

      } else if (operation === 'shift.close') {
        const outcome = processShiftClose(db, req, helpers, parsed, store);
        results.push({ outbox_id: outboxId, status: 'synced', entity_id: outcome.entity_id, skipped: Boolean(outcome.skipped) });

      } else {
        results.push({ outbox_id: outboxId, status: 'failed', error: `Operação não suportada: ${operation}` });
      }
    } catch (err) {
      results.push({
        outbox_id: outboxId,
        status: 'failed',
        error: err.message || 'Erro ao sincronizar',
        http_status: err.status || 500,
      });
    }
  }

  const synced = results.filter((r) => r.status === 'synced').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return {
    store,
    processed: results.length,
    synced,
    failed,
    results,
    has_more: operations.length > maxBatch,
  };
}

module.exports = { processSyncPush };
