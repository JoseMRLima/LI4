#!/usr/bin/env node
/**
 * Repõe a BD local Electron a partir de flashstore.db (central).
 * Uso: node scripts/rebuild-local-db-from-central.cjs "Braga Centro" [slug]
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const store = process.argv[2] || 'Braga Centro';
const slug = process.argv[3] || store.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dev';

const serverDir = path.join(__dirname, '../server');
const Database = require(path.join(serverDir, 'node_modules/better-sqlite3'));
const centralPath = path.join(serverDir, 'flashstore.db');
const localPath = path.join(os.homedir(), '.config/flashstore/stores', slug, 'flashstore-local.db');

if (!fs.existsSync(centralPath)) {
  console.error('Central não encontrado:', centralPath);
  process.exit(1);
}
if (!fs.existsSync(localPath)) {
  console.error('BD local não encontrada:', localPath);
  process.exit(1);
}

const central = new Database(centralPath, { readonly: true });
const local = new Database(localPath);

const products = central.prepare('SELECT * FROM products WHERE is_active = 1').all();
const stock = central.prepare('SELECT * FROM stock WHERE store = ?').all(store);
const promotions = central.prepare('SELECT * FROM promotions').all();

const { importCatalog } = require('../electron/db/catalogImport.cjs');

const result = importCatalog(local, { store, products, stock, promotions });

console.log('✅ BD local reconstruída:', localPath);
console.log('   Loja:', store, '| produtos:', result.productCount, '| lotes stock:', result.stockCount);
console.log('   Reinicie o Electron para carregar do disco.');

central.close();
local.close();
