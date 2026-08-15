const fs = require('fs');
const path = require('path');
const { openDatabase } = require('./sqlAdapter.cjs');
const { applyLocalSchema, SCHEMA_VERSION } = require('./localSchema.cjs');
const { seedDemoIfEmpty } = require('./seedDemo.cjs');

let dbInstance = null;
let storeConfig = null;

function slugifyStoreId(name) {
  return (
    String(name || 'dev')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'dev'
  );
}

function getDbPath(app, storeLabel) {
  const slug = slugifyStoreId(storeLabel);
  const dir = path.join(app.getPath('userData'), 'stores', slug);
  fs.mkdirSync(dir, { recursive: true });
  return { dbPath: path.join(dir, 'flashstore-local.db'), storeSlug: slug };
}

async function initLocalDatabase(app) {
  const storeLabel = process.env.FLASHSTORE_STORE_ID || process.env.FLASHSTORE_STORE || 'Dev';
  const { dbPath, storeSlug } = getDbPath(app, storeLabel);

  const db = await openDatabase(dbPath);
  db.pragma('PRAGMA foreign_keys = ON');

  applyLocalSchema(db);

  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run('store_label', storeLabel);
  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run('store_slug', storeSlug);

  const seedResult =
    process.env.FLASHSTORE_DEMO_SEED === '1' ? seedDemoIfEmpty(db, storeLabel) : { seeded: false };

  dbInstance = db;
  storeConfig = { storeLabel, storeSlug, dbPath, seedResult };

  console.log(`[FlashStore] BD local: ${dbPath} (loja: ${storeLabel})`);
  return storeConfig;
}

function getDb() {
  if (!dbInstance) {
    throw new Error('Base de dados local não inicializada.');
  }
  return dbInstance;
}

function getStoreConfig() {
  if (!storeConfig) {
    throw new Error('Configuração da loja não disponível.');
  }
  return storeConfig;
}

function closeLocalDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    storeConfig = null;
  }
}

module.exports = {
  initLocalDatabase,
  getDb,
  getStoreConfig,
  closeLocalDatabase,
  SCHEMA_VERSION,
};
