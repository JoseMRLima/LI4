/**
 * Dados mínimos para testar BD local sem pull do servidor (desenvolvimento).
 */
function seedDemoIfEmpty(db, storeLabel) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return { seeded: false, products: count };

  const store = storeLabel || 'Dev';
  const now = new Date().toISOString();

  const products = [
    { id: 'demo-p1', name: 'Água 50cl', barcode: '5600000000011', price: 0.89, category: 'Bebidas' },
    { id: 'demo-p2', name: 'Leite Meio Gordo 1L', barcode: '5600000000028', price: 1.19, category: 'Laticínios' },
    { id: 'demo-p3', name: 'Pão de Forma', barcode: '5600000000035', price: 1.49, category: 'Padaria' },
  ];

  const insProduct = db.prepare(`
    INSERT INTO products (id, name, barcode, price, category, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  const insStock = db.prepare(`
    INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold, serial_number, updated_at)
    VALUES (?, ?, ?, ?, ?, 10, 'SEM-LOTE', ?)
  `);

  for (const p of products) {
    insProduct.run(p.id, p.name, p.barcode, p.price, p.category, now);
    insStock.run(`demo-s-${p.id}`, p.id, p.name, store, 50, now);
  }

  return { seeded: true, products: products.length };
}

module.exports = { seedDemoIfEmpty };
