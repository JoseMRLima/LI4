const crypto = require('crypto');

function genId() {
  return crypto.randomUUID();
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function buildReceiptText({ sale, items, store }) {
  const lines = [
    'FLASHSTORE'.padStart(26),
    '',
    store || sale.store,
    'FlashStore Retail S.A.',
    'NIF: 999999990',
    'Fatura Simplificada Original',
    `Nro: ${sale.invoice_number}`,
    `Talão: ${sale.receipt_number}`,
    String(sale.created_date || '').replace('T', ' ').slice(0, 16),
    '',
    `NIF: ${sale.customer_nif || 'Consumidor final'}`,
    '',
    'IVA  DESCRICAO                    VALOR',
    '-'.repeat(42),
  ];
  for (const item of items) {
    const left = `(C) ${item.product_name}`.slice(0, 28);
    lines.push(`${left.padEnd(28)}${formatMoney(item.subtotal).padStart(14)}`);
    lines.push(`    ${formatMoney(item.quantity)} x ${formatMoney(item.unit_price)} EUR`);
  }
  lines.push(
    '',
    `TOTAL A PAGAR${' '.repeat(Math.max(1, 42 - 13 - formatMoney(sale.total).length))}${formatMoney(sale.total)}`,
    `${String(sale.payment_method).slice(0, 20).padEnd(20)}${formatMoney(sale.amount_paid).padStart(22)}`,
    `TROCO${' '.repeat(Math.max(1, 42 - 5 - formatMoney(sale.change_given).length))}${formatMoney(sale.change_given)}`,
    '',
    'Obrigado pela sua compra.',
    '-'.repeat(42),
    '',
    '[OFFLINE — pendente de sincronização]'
  );
  return lines.join('\n');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Mesmas regras do servidor central: só lotes não expirados entram na venda/sync. */
function allocateStock(db, productId, store, requestedQuantity) {
  const lots = db
    .prepare(
      `
    SELECT * FROM stock
    WHERE product_id = ? AND store = ? AND quantity > 0
      AND (expiry_date IS NULL OR expiry_date = '' OR expiry_date >= ?)
    ORDER BY
      CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END,
      expiry_date ASC,
      updated_at ASC
  `
    )
    .all(productId, store, todayISO());

  let remaining = Number(requestedQuantity);
  const allocations = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(Number(lot.quantity), remaining);
    if (take <= 0) continue;
    allocations.push({ lot, quantity: take });
    remaining -= take;
  }

  if (remaining > 0.0001) {
    const err = new Error(`Stock insuficiente para o produto ${productId}.`);
    err.status = 409;
    throw err;
  }

  return allocations;
}

function createOfflineSale(db, payload) {
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
    shift_closure_id,
  } = payload;

  if (!store || !items?.length || total == null || !payment_method) {
    const err = new Error('Campos obrigatórios em falta para venda offline.');
    err.status = 400;
    throw err;
  }

  const saleId = genId();
  const now = new Date().toISOString();
  const inv = invoice_number || `FS-OFF-${Date.now()}`;
  const receiptNumber = `TL-OFF-${Date.now()}`;
  const saleItems = [];

  db.transaction(() => {
    db.prepare(
      `
      INSERT INTO sales (
        id, store, total, total_iva, payment_method, amount_paid, change_given,
        customer_nif, cashier_email, cashier_name, invoice_number, document_type,
        receipt_number, status, shift_closure_id, sync_status, created_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      saleId,
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
      receiptNumber,
      'completed',
      shift_closure_id || null,
      'pending_local',
      now
    );

    const insertItem = db.prepare(
      `
      INSERT INTO sale_items (
        id, sale_id, product_id, product_name, quantity, unit_price, iva_rate,
        subtotal, stock_id, serial_number, expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    );

    for (const item of items) {
      const allocations = allocateStock(db, item.product_id, store, item.quantity);
      for (const { lot, quantity } of allocations) {
        const lineSubtotal = Number(quantity) * Number(item.unit_price || 0);
        const lineId = genId();
        insertItem.run(
          lineId,
          saleId,
          item.product_id,
          item.product_name,
          quantity,
          item.unit_price,
          item.iva_rate || 23,
          lineSubtotal,
          lot.id,
          lot.serial_number,
          lot.expiry_date || null
        );
        db.prepare('UPDATE stock SET quantity = quantity - ? WHERE id = ?').run(quantity, lot.id);
        saleItems.push({
          id: lineId,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity,
          unit_price: item.unit_price,
          iva_rate: item.iva_rate || 23,
          subtotal: lineSubtotal,
        });
      }
    }

    const sale = {
      id: saleId,
      store,
      total,
      total_iva: total_iva || 0,
      payment_method,
      amount_paid: amount_paid ?? total,
      change_given: change_given || 0,
      customer_nif: customer_nif || '',
      invoice_number: inv,
      receipt_number: receiptNumber,
      created_date: now,
    };

    const receiptText = buildReceiptText({ sale, items: saleItems, store });
    db.prepare('UPDATE sales SET receipt_text = ? WHERE id = ?').run(receiptText, saleId);

    db.prepare(
      `
      INSERT INTO sync_outbox (id, operation, entity, entity_id, payload_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `
    ).run(
      genId(),
      'sale.create',
      'sale',
      saleId,
      JSON.stringify({ ...payload, id: saleId, invoice_number: inv, receipt_number: receiptNumber, created_date: now, items: saleItems }),
      now
    );
  })();

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  const lines = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  return { ...sale, items: lines };
}

module.exports = { createOfflineSale };
