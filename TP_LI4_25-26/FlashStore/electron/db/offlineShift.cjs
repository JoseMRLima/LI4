/**
 * FlashStore — Operações de turno offline (Electron local DB)
 * Suporta abertura e fecho de turno sem ligação ao servidor central.
 * Ambas as operações entram no outbox para sync posterior.
 */

const crypto = require('crypto');

function genId() {
  return crypto.randomUUID();
}

/**
 * Abre um turno na BD local e coloca a operação no outbox.
 */
function openShiftOffline(db, payload) {
  const {
    store,
    pos_terminal_id,
    cashier_email,
    cashier_name,
    shift_date,
    opening_declared_cash = 0,
  } = payload;

  if (!store || !cashier_email) {
    const err = new Error('store e cashier_email são obrigatórios para abrir turno offline.');
    err.status = 400;
    throw err;
  }

  const existing = db.prepare(
    `SELECT id FROM shift_closures WHERE store = ? AND status = 'open' LIMIT 1`
  ).get(store);
  if (existing) {
    const err = new Error('Já existe um turno aberto nesta loja na BD local.');
    err.status = 409;
    throw err;
  }

  const shiftId = `sh-${genId()}`;
  const now = new Date().toISOString();
  const date = shift_date || now.slice(0, 10);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO shift_closures (id, store, pos_terminal_id, cashier_email, cashier_name, shift_date, status, sync_status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, 'open', 'pending_local', ?)
    `).run(shiftId, store, pos_terminal_id || null, cashier_email, cashier_name || '', date, now);

    db.prepare(`
      INSERT INTO sync_outbox (id, operation, entity, entity_id, payload_json, status, created_at)
      VALUES (?, 'shift.open', 'shift_closure', ?, ?, 'pending', ?)
    `).run(
      genId(),
      shiftId,
      JSON.stringify({
        id: shiftId,
        store,
        pos_terminal_id,
        cashier_email,
        cashier_name,
        shift_date: date,
        opening_declared_cash,
        created_date: now,
      }),
      now
    );
  })();

  return db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(shiftId);
}

/**
 * Fecha um turno na BD local e coloca a operação no outbox.
 */
function closeShiftOffline(db, payload) {
  const {
    shift_id,
    store,
    cashier_email,
    closing_cash,
    notes = '',
  } = payload;

  if (!shift_id || closing_cash === undefined) {
    const err = new Error('shift_id e closing_cash são obrigatórios para fechar turno offline.');
    err.status = 400;
    throw err;
  }

  const shift = db.prepare(`SELECT * FROM shift_closures WHERE id = ? AND status = 'open'`).get(shift_id);
  if (!shift) {
    const err = new Error('Turno não encontrado ou já fechado na BD local.');
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE shift_closures SET status = 'pending_approval', sync_status = 'pending_local' WHERE id = ?
    `).run(shift_id);

    db.prepare(`
      INSERT INTO sync_outbox (id, operation, entity, entity_id, payload_json, status, created_at)
      VALUES (?, 'shift.close', 'shift_closure', ?, ?, 'pending', ?)
    `).run(
      genId(),
      shift_id,
      JSON.stringify({
        shift_id,
        store: store || shift.store,
        cashier_email: cashier_email || shift.cashier_email,
        closing_cash,
        notes,
        closed_at: now,
      }),
      now
    );
  })();

  return db.prepare('SELECT * FROM shift_closures WHERE id = ?').get(shift_id);
}

/**
 * Devolve o turno aberto atualmente na BD local para esta loja.
 */
function getOpenShiftOffline(db, store) {
  return db.prepare(
    `SELECT * FROM shift_closures WHERE store = ? AND status = 'open' ORDER BY created_date DESC LIMIT 1`
  ).get(store) || null;
}

module.exports = { openShiftOffline, closeShiftOffline, getOpenShiftOffline };
