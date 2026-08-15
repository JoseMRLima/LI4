/**
 * FlashStore — Script de Seed
 * Popula a base de dados com dados de exemplo para desenvolvimento/teste
 *
 * Uso: node seed.js
 */

const bcrypt = require('bcryptjs');
const { initDB } = require('./database');

const db = initDB();

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

function buildSeedReceiptText({ sale, items }) {
  const width = 42;
  const taxRows = {};

  for (const item of items) {
    const rate = Number(item.iva || 0);
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
    sale.store,
    'FlashStore Retail S.A.',
    'NIF: 999999990',
    'Fatura Simplificada Original',
    `Nro: ${sale.invoiceNumber}`,
    `Talão: ${sale.receiptNumber}`,
    sale.createdAt.replace('T', ' ').slice(0, 16),
    '',
    'NIF: Consumidor final',
    '',
    receiptLine('IVA  DESCRICAO', 'VALOR', width),
    '-'.repeat(width),
  ];

  for (const item of items) {
    const taxCode = Number(item.iva || 0) === 6 ? '(A)' : '(C)';
    lines.push(receiptLine(`${taxCode} ${item.pname}`, money(item.subtotal), width));
    lines.push(`    ${money(item.qty)} x ${money(item.price)} EUR`);
  }

  lines.push(
    '',
    receiptLine('TOTAL A PAGAR', money(sale.total), width),
    receiptLine(sale.paymentMethod, money(sale.amountPaid), width),
    receiptLine('TROCO', money(sale.changeGiven), width),
    '',
    receiptLine('%IVA', 'Total Liq.      IVA      Total', width)
  );

  Object.values(taxRows).sort((a, b) => a.rate - b.rate).forEach((row) => {
    lines.push(receiptLine(`${money(row.rate)}%`, `${money(row.taxable)}     ${money(row.tax)}     ${money(row.gross)}`, width));
  });

  lines.push('', 'Obrigado pela sua compra.', '-'.repeat(width));
  return lines.join('\n');
}

console.log('\n🌱 A popular a base de dados com dados de exemplo...\n');

// ─────────────────────────────────────────────
// UTILIZADORES
// ─────────────────────────────────────────────
const users = [
  // ── Administração central
  { email: 'admin@flashstore.pt',          full_name: 'Helena Matos',        role: 'admin',   store: 'Sede' },

  // ── Gerentes de loja (1 por loja)
  { email: 'gerente.braga@flashstore.pt',  full_name: 'Carlos Ferreira',     role: 'manager', store: 'Braga Centro' },
  { email: 'gerente.gualtar@flashstore.pt',full_name: 'Marta Oliveira',      role: 'manager', store: 'Gualtar' },
  { email: 'gerente.guim@flashstore.pt',   full_name: 'Rui Mendes',          role: 'manager', store: 'Guimarães' },
  { email: 'gerente.barc@flashstore.pt',   full_name: 'Sofia Carvalho',      role: 'manager', store: 'Barcelos' },
  { email: 'gerente.povoa@flashstore.pt',  full_name: 'António Sousa',       role: 'manager', store: 'Póvoa de Lanhoso' },
  { email: 'gerente.vnf@flashstore.pt',    full_name: 'Cristina Lima',       role: 'manager', store: 'Vila Nova de Famalicão' },
  { email: 'gerente.espo@flashstore.pt',   full_name: 'Paulo Rodrigues',     role: 'manager', store: 'Esposende' },
  { email: 'gerente.vizela@flashstore.pt', full_name: 'Inês Martins',        role: 'manager', store: 'Vizela' },

  // ── Caixas — Braga Centro (2 POS)
  { email: 'caixa1.braga@flashstore.pt',   full_name: 'Ana Silva',           role: 'cashier', store: 'Braga Centro' },
  { email: 'caixa2.braga@flashstore.pt',   full_name: 'Tiago Pinto',         role: 'cashier', store: 'Braga Centro' },

  // ── Caixas — Gualtar (2 POS)
  { email: 'caixa1.gualtar@flashstore.pt', full_name: 'Catarina Lopes',      role: 'cashier', store: 'Gualtar' },
  { email: 'caixa2.gualtar@flashstore.pt', full_name: 'Diogo Cunha',         role: 'cashier', store: 'Gualtar' },

  // ── Caixas — Guimarães (2 POS)
  { email: 'caixa1.guim@flashstore.pt',    full_name: 'João Costa',          role: 'cashier', store: 'Guimarães' },
  { email: 'caixa2.guim@flashstore.pt',    full_name: 'Beatriz Gomes',       role: 'cashier', store: 'Guimarães' },

  // ── Caixas — Barcelos (1 POS)
  { email: 'caixa1.barc@flashstore.pt',    full_name: 'Maria Santos',        role: 'cashier', store: 'Barcelos' },

  // ── Caixas — Póvoa de Lanhoso (2 POS)
  { email: 'caixa1.povoa@flashstore.pt',   full_name: 'Filipe Araújo',       role: 'cashier', store: 'Póvoa de Lanhoso' },
  { email: 'caixa2.povoa@flashstore.pt',   full_name: 'Joana Vieira',        role: 'cashier', store: 'Póvoa de Lanhoso' },

  // ── Caixas — Vila Nova de Famalicão (4 POS)
  { email: 'caixa1.vnf@flashstore.pt',     full_name: 'Ricardo Pereira',     role: 'cashier', store: 'Vila Nova de Famalicão' },
  { email: 'caixa2.vnf@flashstore.pt',     full_name: 'Leonor Figueiredo',   role: 'cashier', store: 'Vila Nova de Famalicão' },
  { email: 'caixa3.vnf@flashstore.pt',     full_name: 'Bruno Almeida',       role: 'cashier', store: 'Vila Nova de Famalicão' },
  { email: 'caixa4.vnf@flashstore.pt',     full_name: 'Sara Neves',          role: 'cashier', store: 'Vila Nova de Famalicão' },

  // ── Caixas — Esposende (2 POS)
  { email: 'caixa1.espo@flashstore.pt',    full_name: 'Miguel Correia',      role: 'cashier', store: 'Esposende' },
  { email: 'caixa2.espo@flashstore.pt',    full_name: 'Andreia Moreira',     role: 'cashier', store: 'Esposende' },

  // ── Caixas — Vizela (1 POS)
  { email: 'caixa1.vizela@flashstore.pt',  full_name: 'Margarida Teixeira',  role: 'cashier', store: 'Vizela' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, email, full_name, role, store, password_hash, is_active, created_date)
  VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
`);

const SEED_PASSWORD = '123456';
for (const u of users) {
  const hash = bcrypt.hashSync(SEED_PASSWORD, 10);
  insertUser.run(genId(), u.email, u.full_name, u.role, u.store, hash);
}
console.log(`✅ ${users.length} utilizadores criados (password: ${SEED_PASSWORD})`);

// ─────────────────────────────────────────────
// FORNECEDORES
// ─────────────────────────────────────────────
const suppliers = [
  { name: 'Unicer Bebidas', nif: '500000001', email: 'comercial@unicer.pt', contact: '253 000 001', address: 'Leça do Balio, Porto' },
  { name: 'Continente Distribuição', nif: '500000002', email: 'fornecedor@continente.pt', contact: '21 000 0002', address: 'Lisboa' },
  { name: 'Pingo Doce Atacado', nif: '500000003', email: 'atacado@pingodoce.pt', contact: '22 000 0003', address: 'Porto' },
  { name: 'Tabacaria Nacional', nif: '500000004', email: 'geral@tabacaria.pt', contact: '21 000 0004', address: 'Lisboa' },
];

const insertSupplier = db.prepare(`
  INSERT OR IGNORE INTO suppliers (id, name, contact, email, nif, address, is_active)
  VALUES (?, ?, ?, ?, ?, ?, 1)
`);
const supplierIds = [];
for (const s of suppliers) {
  const id = genId();
  insertSupplier.run(id, s.name, s.contact, s.email, s.nif, s.address);
  const savedSupplier = db.prepare('SELECT id FROM suppliers WHERE nif = ?').get(s.nif);
  supplierIds.push(savedSupplier?.id || id);
}
console.log(`✅ ${suppliers.length} fornecedores criados`);

const supplierMapByName = Object.fromEntries(suppliers.map((supplier, index) => [supplier.name, { ...supplier, id: supplierIds[index] }]));

// ─────────────────────────────────────────────
// PRODUTOS
// ─────────────────────────────────────────────
const products = [
  { name: 'Super Bock Original 33cl',      barcode: '5601006001001', price: 1.49, category: 'Bebidas',     supplierName: 'Unicer Bebidas', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/SuperBock33.png' },
  { name: 'Sagres Sem Álcool 33cl',        barcode: '5601006001002', price: 1.29, category: 'Bebidas',     supplierName: 'Unicer Bebidas', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/SagresSemAlcool.png' },
  { name: 'Água Monchique 0.5L',           barcode: '5601006001003', price: 0.69, category: 'Bebidas',     supplierName: 'Unicer Bebidas', iva_rate: 6,  is_perishable: false, default_shelf_life_days: null, image_url: '/images/AguaMonchique1.5L.png' },
  { name: 'Coca-Cola 0.33L',               barcode: '5601006001004', price: 1.19, category: 'Bebidas',     supplierName: 'Unicer Bebidas', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/coca-cola-0.33.png' },
  { name: 'Red Bull 0.25L',                barcode: '5601006001005', price: 2.49, category: 'Bebidas',     supplierName: 'Unicer Bebidas', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/redbull.png' },

  { name: 'Pingo Doce Leite Meio-Gordo 1L', barcode: '5601006002001', price: 0.89, category: 'Lacticínios', supplierName: 'Pingo Doce Atacado', iva_rate: 6,  is_perishable: true,  default_shelf_life_days: 14, image_url: '/images/leitemeiogordo.png' },
  { name: 'Iogurte Natural Activia',        barcode: '5601006002002', price: 1.39, category: 'Lacticínios', supplierName: 'Pingo Doce Atacado', iva_rate: 6,  is_perishable: true,  default_shelf_life_days: 10, image_url: '/images/Iogurte-Liquido-Aveia-Activia-Danone-800g.png' },
  { name: 'Manteiga Mimosa 250g',           barcode: '5601006002003', price: 2.19, category: 'Lacticínios', supplierName: 'Pingo Doce Atacado', iva_rate: 6,  is_perishable: true,  default_shelf_life_days: 20, image_url: '/images/manteigamimosa.png' },

  { name: 'Pão de Forma Bimbo',             barcode: '5601006003001', price: 1.79, category: 'Padaria',     supplierName: 'Pingo Doce Atacado', iva_rate: 6,  is_perishable: true,  default_shelf_life_days: 7, image_url: '/images/paodeformaBimbo.png' },
  { name: 'Croissant Amanteigado',          barcode: '5601006003002', price: 0.89, category: 'Padaria',     supplierName: 'Pingo Doce Atacado', iva_rate: 6,  is_perishable: true,  default_shelf_life_days: 3, image_url: '/images/croissantamanteigado.png' },

  { name: 'Lays Original 45g',              barcode: '5601006004001', price: 1.19, category: 'Snacks',      supplierName: 'Continente Distribuição', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/Lays-Chips-Original-45g.png' },
  { name: 'Bolachas Maria OleBolé',         barcode: '5601006004002', price: 0.99, category: 'Snacks',      supplierName: 'Continente Distribuição', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/bolacha-vieira-maria-200g.png' },
  { name: 'Kit Kat Chocolate',              barcode: '5601006004003', price: 1.49, category: 'Snacks',      supplierName: 'Continente Distribuição', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/kitkat.png' },

  { name: 'Marlboro Red 20',                barcode: '5601006005001', price: 5.60, category: 'Tabaco',      supplierName: 'Tabacaria Nacional', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/malborored.png' },
  { name: 'L&M Blue 20',                    barcode: '5601006005002', price: 5.10, category: 'Tabaco',      supplierName: 'Tabacaria Nacional', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/l&m.png' },
  { name: 'Isqueiro BIC',                   barcode: '5601006005003', price: 1.99, category: 'Outros',      supplierName: 'Tabacaria Nacional', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/isqueiro.png' },

  { name: 'Sabonete Dove 90g',              barcode: '5601006006001', price: 1.69, category: 'Higiene',     supplierName: 'Continente Distribuição', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/dove.jpg' },
  { name: 'Pasta Colgate Total 75ml',       barcode: '5601006006002', price: 2.49, category: 'Higiene',     supplierName: 'Continente Distribuição', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/pastacolgate.jpg' },

  { name: 'Pizza Frango Congelada',         barcode: '5601006007001', price: 3.49, category: 'Congelados',  supplierName: 'Continente Distribuição', iva_rate: 6,  is_perishable: true,  default_shelf_life_days: 60, image_url: '/images/pizzafrango.png' },
  { name: 'Detergente Roupa Skip 1.5L',     barcode: '5601006008001', price: 4.99, category: 'Limpeza',     supplierName: 'Continente Distribuição', iva_rate: 23, is_perishable: false, default_shelf_life_days: null, image_url: '/images/skip.jpg' },
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (
    id,
    name,
    barcode,
    price,
    category,
    image_url,
    supplier_id,
    supplier_name,
    iva_rate,
    is_perishable,
    default_shelf_life_days,
    is_active,
    created_date
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
`);

const updateProduct = db.prepare(`
  UPDATE products
  SET name = ?,
      price = ?,
      category = ?,
      image_url = ?,
      supplier_id = ?,
      supplier_name = ?,
      iva_rate = ?,
      is_perishable = ?,
      default_shelf_life_days = ?,
      is_active = 1
  WHERE barcode = ?
`);

const productIds = [];
for (const p of products) {
  const id = genId();
  const supplier = supplierMapByName[p.supplierName];
  insertProduct.run(
    id,
    p.name,
    p.barcode,
    p.price,
    p.category,
    p.image_url || null,
    supplier?.id || null,
    p.supplierName || null,
    p.iva_rate,
    p.is_perishable ? 1 : 0,
    p.default_shelf_life_days || null
  );
  updateProduct.run(
    p.name,
    p.price,
    p.category,
    p.image_url || null,
    supplier?.id || null,
    p.supplierName || null,
    p.iva_rate,
    p.is_perishable ? 1 : 0,
    p.default_shelf_life_days || null,
    p.barcode
  );
  const savedProduct = db.prepare('SELECT id FROM products WHERE barcode = ?').get(p.barcode);
  productIds.push(savedProduct?.id || id);
}
console.log(`✅ ${products.length} produtos criados/atualizados`);
// ─────────────────────────────────────────────
// STOCK (em todas as lojas)
// ─────────────────────────────────────────────
const stores = ['Braga Centro', 'Gualtar', 'Guimarães', 'Barcelos', 'Póvoa de Lanhoso', 'Vila Nova de Famalicão', 'Esposende', 'Vizela'];

const expiryProfiles = {
  'Padaria': [[2, 4], [5, 9]],
  'Lacticínios': [[4, 9], [10, 24]],
  'Congelados': [[45, 90], [120, 240]],
  'Bebidas': [[120, 240], [300, 540]],
  'Snacks': [[90, 180], [210, 420]],
  'Tabaco': [[240, 420], [480, 720]],
  'Higiene': [[365, 720], [730, 1080]],
  'Limpeza': [[540, 900], [900, 1440]],
};

const expiryStepDays = {
  'Padaria': 2,
  'Lacticínios': 7,
  'Congelados': 45,
  'Bebidas': 90,
  'Snacks': 60,
  'Tabaco': 120,
  'Higiene': 180,
  'Limpeza': 180,
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function productExpiryDate(product, lotIndex = 0) {
  if (product.category === 'Outros') return null;
  const windows = expiryProfiles[product.category] || [[180, 365], [365, 720]];
  const [minDays] = windows[Math.min(lotIndex, windows.length - 1)];
  return addDays(minDays);
}

function lotPrefix(product) {
  const categoryPrefix = (product.category || 'GEN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
  return `${categoryPrefix}-${String(product.barcode || '000000').slice(-5)}`;
}

const lotCounters = new Map();
const expiryCounters = new Map();

function nextLotNumber(product, supplierName = 'FS', store = 'Loja') {
  const supplierPrefix = supplierName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'FS';
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `${product.barcode}-${store}-${now.getFullYear()}`;
  const next = (lotCounters.get(key) || 1000) + 1;
  lotCounters.set(key, next);
  return `LOT-${supplierPrefix}-${lotPrefix(product)}-${ym}-${String(next).padStart(4, '0')}`;
}

function addDaysToDate(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function nextExpiryDate(product, store = 'Loja') {
  if (product.category === 'Outros') return null;
  const key = `${product.barcode}-${store}`;
  const previous = expiryCounters.get(key);
  const next = previous
    ? addDaysToDate(previous, expiryStepDays[product.category] || 90)
    : productExpiryDate(product, 0);
  expiryCounters.set(key, next);
  return next;
}

const insertStock = db.prepare(`
  INSERT OR IGNORE INTO stock (id, product_id, product_name, store, quantity, minimum_threshold, serial_number, expiry_date, created_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

let stockCount = 0;
for (const [i, pid] of productIds.entries()) {
  const product = products[i];
  const pname = product.name;
  for (const store of stores) {
    const minThreshold = product.category === 'Tabaco' ? 20 : 10;
    const numberOfLots = product.category === 'Outros' ? 1 : 2;

    for (let lotIndex = 0; lotIndex < numberOfLots; lotIndex++) {
      const qty = randomInt(lotIndex === 0 ? 4 : 12, lotIndex === 0 ? 28 : 65);
      const lotCode = nextLotNumber(product, `Stock ${store}`, store);
      insertStock.run(genId(), pid, pname, store, qty, minThreshold, lotCode, nextExpiryDate(product, store));
      stockCount++;
    }
  }
}

const expiredLotExamples = [
  { productName: 'Croissant Amanteigado', store: 'Braga Centro', quantity: 6, daysExpired: 1 },
  { productName: 'Iogurte Natural Activia', store: 'Braga Centro', quantity: 9, daysExpired: 3 },
];

for (const example of expiredLotExamples) {
  const product = products.find((entry) => entry.name === example.productName);
  const productId = productIds[products.findIndex((entry) => entry.name === example.productName)];
  if (!product || !productId) continue;

  insertStock.run(
    genId(),
    productId,
    product.name,
    example.store,
    example.quantity,
    10,
    nextLotNumber(product, 'ValidadeExpirada', example.store),
    addDays(-example.daysExpired)
  );
  stockCount++;
}

console.log(`✅ ${stockCount} lotes de stock criados com séries e validades plausíveis (inclui exemplos expirados)`);

// ─────────────────────────────────────────────
// CAIXAS POS — quantidade e códigos por loja (o gerente e o POS leem só da BD)
// ─────────────────────────────────────────────
const POS_TERMINALS_BY_STORE = {
  'Braga Centro': [
    { code: 'POS_01', label: 'Caixa 1' },
    { code: 'POS_02', label: 'Caixa 2' },
  ],
  Gualtar: [
    { code: 'POS_01', label: 'Caixa 1' },
    { code: 'POS_02', label: 'Caixa 2' },
  ],
  Guimarães: [
    { code: 'POS_01', label: 'Caixa 1' },
    { code: 'POS_02', label: 'Caixa 2' },
  ],
  Barcelos: [{ code: 'POS_01', label: 'Caixa 1' }],
  'Póvoa de Lanhoso': [
    { code: 'POS_01', label: 'Caixa 1' },
    { code: 'POS_02', label: 'Caixa 2' },
  ],
  'Vila Nova de Famalicão': [
    { code: 'POS_01', label: 'Caixa 1' },
    { code: 'POS_02', label: 'Caixa 2' },
    { code: 'POS_03', label: 'Caixa 3' },
    { code: 'POS_04', label: 'Caixa 4' },
  ],
  Esposende: [
    { code: 'POS_01', label: 'Caixa 1' },
    { code: 'POS_02', label: 'Caixa 2' },
  ],
  Vizela: [{ code: 'POS_01', label: 'Caixa 1' }],
};

function posTerminalSeedId(storeName, code) {
  const slug = String(storeName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\W+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  return `seed_pt_${slug}_${code}`;
}

const insertPosTerminal = db.prepare(`
  INSERT OR IGNORE INTO pos_terminals (id, store, code, label, sort_order, is_active, created_at)
  VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
`);

let posTerminalInserted = 0;
for (const storeName of stores) {
  const list = POS_TERMINALS_BY_STORE[storeName];
  if (!list?.length) continue;
  list.forEach((row, idx) => {
    const id = posTerminalSeedId(storeName, row.code);
    const r = insertPosTerminal.run(id, storeName, row.code, row.label || null, idx + 1);
    if (r.changes > 0) posTerminalInserted += 1;
  });
}
console.log(
  `✅ Caixas POS: ${posTerminalInserted} novos registos (por loja definidos em POS_TERMINALS_BY_STORE; reexecução ignora duplicados)`
);

// ─────────────────────────────────────────────
// ENCOMENDAS A FORNECEDOR + RECEÇÕES DE EXEMPLO
// ─────────────────────────────────────────────
const productMap = Object.fromEntries(products.map((product, index) => [product.name, { ...product, id: productIds[index] }]));
const supplierMap = Object.fromEntries(suppliers.map((supplier, index) => [supplier.name, { ...supplier, id: supplierIds[index] }]));

const insertSupplierOrder = db.prepare(`
  INSERT INTO supplier_orders (id, supplier_id, supplier_name, store, total, urgency, status, notes, created_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSupplierOrderItem = db.prepare(`
  INSERT INTO supplier_order_items (id, order_id, product_id, product_name, quantity, unit_cost, serial_number, expiry_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMerchandiseEntry = db.prepare(`
  INSERT INTO merchandise_entries (id, supplier_id, supplier_name, store, invoice_reference, notes, created_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertMerchandiseEntryItem = db.prepare(`
  INSERT INTO merchandise_entry_items (id, entry_id, product_id, product_name, quantity, serial_number, expiry_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const sampleOrders = [
  {
    supplierName: 'Pingo Doce Atacado',
    store: 'Braga Centro',
    urgency: 'urgent',
    status: 'pending',
    notes: 'Reposição urgente de frescos para o turno da tarde.',
    createdDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    items: [
      { productName: 'Pingo Doce Leite Meio-Gordo 1L', quantity: 18 },
      { productName: 'Pão de Forma Bimbo', quantity: 12 },
    ],
  },
  {
    supplierName: 'Unicer Bebidas',
    store: 'Guimarães',
    urgency: 'high',
    status: 'sent',
    notes: 'Pedido aprovado à espera de entrega do fornecedor.',
    createdDate: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    items: [
      { productName: 'Super Bock Original 33cl', quantity: 48 },
      { productName: 'Red Bull 0.25L', quantity: 24 },
    ],
  },
  {
    supplierName: 'Continente Distribuição',
    store: 'Braga Centro',
    urgency: 'normal',
    status: 'received',
    notes: 'Entrega concluída e validada pela loja.',
    createdDate: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    receiptDate: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    items: [
      {
        productName: 'Lays Original 45g',
        quantity: 20,
      },
      {
        productName: 'Pizza Frango Congelada',
        quantity: 15,
      },
      {
        productName: 'Detergente Roupa Skip 1.5L',
        quantity: 30,
      },
    ],
  },
];

for (const order of sampleOrders) {
  if (order.status === 'pending') continue;

  order.items = order.items.map((item, index) => {
    const product = productMap[item.productName];
    return {
      ...item,
      serial_number: item.serial_number || nextLotNumber(product, order.supplierName, order.store),
      expiry_date: item.expiry_date || nextExpiryDate(product, order.store) || productExpiryDate(product, index),
    };
  });
}

for (const order of sampleOrders) {
  const supplier = supplierMap[order.supplierName];
  const orderId = genId();

  insertSupplierOrder.run(
    orderId,
    supplier?.id || null,
    order.supplierName,
    order.store,
    0,
    order.urgency,
    order.status,
    order.notes,
    order.createdDate
  );

  for (const item of order.items) {
    const product = productMap[item.productName];
    insertSupplierOrderItem.run(
      genId(),
      orderId,
      product?.id || null,
      item.productName,
      item.quantity,
      0,
      item.serial_number || null,
      item.expiry_date || null
    );
  }

  if (order.status === 'received') {
    const entryId = genId();
    insertMerchandiseEntry.run(
      entryId,
      supplier?.id || null,
      order.supplierName,
      order.store,
      `ORD-${orderId}`,
      `Receção gerada pelo seed para ${order.store}`,
      order.receiptDate || order.createdDate
    );

    for (const item of order.items) {
      const product = productMap[item.productName];
      insertMerchandiseEntryItem.run(
        genId(),
        entryId,
        product?.id || null,
        item.productName,
        item.quantity,
        item.serial_number || null,
        item.expiry_date || null
      );

      const lot = item.serial_number || 'SEM-LOTE';
      const existingStock = db.prepare(`
        SELECT * FROM stock
        WHERE product_id = ? AND store = ? AND serial_number = ? AND COALESCE(expiry_date, '') = COALESCE(?, '')
      `).get(product?.id || null, order.store, lot, item.expiry_date || null);
      if (existingStock) {
        db.prepare('UPDATE stock SET quantity = ? WHERE id = ?').run(
          Number(existingStock.quantity || 0) + Number(item.quantity || 0),
          existingStock.id
        );
      } else {
        db.prepare(`
          INSERT INTO stock (id, product_id, product_name, store, quantity, minimum_threshold, serial_number, expiry_date, created_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(genId(), product?.id || null, item.productName, order.store, item.quantity, 10, lot, item.expiry_date || null, order.receiptDate || order.createdDate);
      }
    }
  }
}

console.log(`✅ ${sampleOrders.length} encomendas de exemplo criadas (inclui receção com lote e validade)`);

// ─────────────────────────────────────────────
// VENDAS DE EXEMPLO
// ─────────────────────────────────────────────
const paymentMethods = ['Numerário', 'Multibanco', 'MB Way', 'Cartão'];
const cashierEmails = ['caixa1@flashstore.pt', 'caixa2@flashstore.pt', 'caixa3@flashstore.pt'];
const cashierNames = ['Ana Silva', 'João Costa', 'Maria Santos'];

const insertSale = db.prepare(`
  INSERT INTO sales (
    id, store, total, total_iva, payment_method, amount_paid, change_given, customer_nif,
    cashier_email, cashier_name, invoice_number, document_type, receipt_number, receipt_text, receipt_issued_at, status, created_date
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Fatura Simplificada', ?, ?, ?, 'completed', ?)
`);
const insertSaleItem = db.prepare(`
  INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let saleCount = 0;
// Gera 30 dias de vendas
for (let day = 29; day >= 0; day--) {
  const date = new Date();
  date.setDate(date.getDate() - day);
  const dateStr = date.toISOString().split('T')[0];

  for (const store of stores.slice(0, 4)) { // 4 lojas para não ser excessivo
    const numSales = Math.floor(Math.random() * 8) + 3; // 3 a 10 vendas por dia
    for (let s = 0; s < numSales; s++) {
      const saleId = genId();
      const cashierIdx = Math.floor(Math.random() * cashierEmails.length);
      const pm = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const hour = Math.floor(Math.random() * 12) + 8;
      const min = Math.floor(Math.random() * 60);
      const createdAt = `${dateStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00.000Z`;

      // 1 a 4 items por venda
      const numItems = Math.floor(Math.random() * 4) + 1;
      const saleItems = [];
      let total = 0;
      let totalIva = 0;

      for (let ii = 0; ii < numItems; ii++) {
        const pIdx = Math.floor(Math.random() * products.length);
        const qty = Math.floor(Math.random() * 3) + 1;
        const price = products[pIdx].price;
        const iva = products[pIdx].iva_rate;
        const subtotal = Math.round(qty * price * 100) / 100;
        const ivaAmount = Math.round(subtotal * iva / (100 + iva) * 100) / 100;
        total += subtotal;
        totalIva += ivaAmount;
        saleItems.push({ pid: productIds[pIdx], pname: products[pIdx].name, qty, price, iva, subtotal });
      }
      total = Math.round(total * 100) / 100;
      totalIva = Math.round(totalIva * 100) / 100;
      const amountPaid = pm === 'Numerário' ? Math.ceil(total / 5) * 5 : total;
      const changeGiven = pm === 'Numerário' ? Math.round((amountPaid - total) * 100) / 100 : 0;
      const invoiceNumber = `FS-${Date.now()}-${saleCount}`;
      const receiptNumber = `TL-${Date.now()}-${saleCount}`;
      const receiptText = buildSeedReceiptText({
        sale: { store, total, paymentMethod: pm, amountPaid, changeGiven, invoiceNumber, receiptNumber, createdAt },
        items: saleItems,
      });

      insertSale.run(
        saleId, store, total, totalIva, pm,
        amountPaid,
        changeGiven,
        '', cashierEmails[cashierIdx], cashierNames[cashierIdx],
        invoiceNumber, receiptNumber, receiptText, createdAt, createdAt
      );
      for (const item of saleItems) {
        insertSaleItem.run(genId(), saleId, item.pid, item.pname, item.qty, item.price, item.iva, item.subtotal);
      }
      saleCount++;
    }
  }
}
console.log(`✅ ${saleCount} vendas de exemplo criadas (últimos 30 dias)`);

// ─────────────────────────────────────────────
// FECHO DE DIA HISTÓRICO (para dias com vendas do seed)
// Sem day_closures o bloqueio RNF05 impede a abertura de novos turnos
// ─────────────────────────────────────────────
const insertDayClosure = db.prepare(`
  INSERT OR IGNORE INTO day_closures (id, store, closure_date, total_sales, total_transactions, closed_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
`);
const daysWithSales = db.prepare(`
  SELECT store, substr(created_date, 1, 10) AS sale_date,
         ROUND(SUM(total), 2) AS day_total, COUNT(*) AS cnt
  FROM sales
  WHERE substr(created_date, 1, 10) < date('now')
  GROUP BY store, substr(created_date, 1, 10)
`).all();
let dcCount = 0;
for (const row of daysWithSales) {
  insertDayClosure.run(genId(), row.store, row.sale_date, row.day_total, row.cnt);
  dcCount++;
}
console.log(`✅ ${dcCount} fechos de dia históricos criados (dias com vendas no seed)`);

// ─────────────────────────────────────────────
// RESUMO FINAL
// ─────────────────────────────────────────────
console.log('\n🎉 Seed concluído com sucesso!\n');
console.log('Credenciais de acesso:');
console.log('  Admin    → admin@flashstore.pt   / 123456');
console.log('  Gerente  → gerente@flashstore.pt / 123456');
console.log('  Caixa 1  → caixa1@flashstore.pt  / 123456');
console.log('  Caixa 2  → caixa2@flashstore.pt  / 123456\n');
