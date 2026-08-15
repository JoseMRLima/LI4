const crypto = require('crypto');

function genId() {
  return crypto.randomUUID();
}

/**
 * Importa catálogo do servidor para a BD local (produtos + stock da loja).
 */
function importCatalog(db, { store, products = [], stock = [], promotions = [] }) {
  if (!store) throw new Error('store é obrigatório');

  const importedProductIds = products.map((p) => p?.id).filter(Boolean);

  const upsertProduct = db.prepare(`
    INSERT INTO products (id, name, barcode, price, category, image_url, iva_rate, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      barcode = excluded.barcode,
      price = excluded.price,
      category = excluded.category,
      image_url = excluded.image_url,
      iva_rate = excluded.iva_rate,
      is_active = excluded.is_active,
      updated_at = datetime('now')
  `);

  const upsertStock = db.prepare(`
    INSERT INTO stock (
      id, product_id, product_name, store, quantity, minimum_threshold,
      serial_number, expiry_date, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      quantity = excluded.quantity,
      minimum_threshold = excluded.minimum_threshold,
      serial_number = excluded.serial_number,
      expiry_date = excluded.expiry_date,
      updated_at = datetime('now')
  `);

  const upsertPromo = db.prepare(`
    INSERT INTO promotions (
      id, name, type, value, applies_to, target_id, target_name,
      start_date, end_date, is_active, applies_to_stores, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      value = excluded.value,
      applies_to = excluded.applies_to,
      target_id = excluded.target_id,
      target_name = excluded.target_name,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      is_active = excluded.is_active,
      applies_to_stores = excluded.applies_to_stores,
      updated_at = datetime('now')
  `);

  let productCount = 0;
  let stockCount = 0;
  let promoCount = 0;

  db.transaction(() => {
    // Apaga TODO o stock local e repõe só a loja pedida (espelho do central)
    db.prepare('DELETE FROM stock').run();

    for (const p of products) {
      if (!p?.id) continue;
      upsertProduct.run(
        p.id,
        p.name,
        p.barcode || null,
        Number(p.price || 0),
        p.category || 'Outros',
        p.image_url || null,
        Number(p.iva_rate ?? 23),
        p.is_active === false || p.is_active === 0 ? 0 : 1
      );
      productCount += 1;
    }

    if (importedProductIds.length > 0) {
      const placeholders = importedProductIds.map(() => '?').join(',');
      db.prepare(`UPDATE products SET is_active = 0 WHERE id NOT IN (${placeholders})`).run(
        ...importedProductIds
      );
    }

    for (const s of stock) {
      if (!s?.product_id || s.store !== store) continue;
      const id = s.id || genId();
      upsertStock.run(
        id,
        s.product_id,
        s.product_name || s.product_id,
        store,
        Number(s.quantity || 0),
        Number(s.minimum_threshold ?? 10),
        s.serial_number || 'SEM-LOTE',
        s.expiry_date || null
      );
      stockCount += 1;
    }

    for (const pr of promotions) {
      if (!pr?.id) continue;
      upsertPromo.run(
        pr.id,
        pr.name,
        pr.type,
        Number(pr.value || 0),
        pr.applies_to,
        pr.target_id || null,
        pr.target_name || null,
        pr.start_date,
        pr.end_date,
        pr.is_active === false || pr.is_active === 0 ? 0 : 1,
        pr.applies_to_stores || null
      );
      promoCount += 1;
    }
  })();

  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run('catalog_imported_at', new Date().toISOString());

  return { productCount, stockCount, promoCount, store };
}

module.exports = { importCatalog };
