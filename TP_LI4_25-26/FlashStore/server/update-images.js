/**
 * Atualiza apenas as imagens dos produtos na base de dados existente.
 * Uso: node update-images.js
 */
const { initDB } = require('./database');
const db = initDB();

const BASE = 'http://localhost:3001/images';

const images = [
  { name: 'Super Bock Original 33cl',       url: `${BASE}/SuperBock33.png` },
  { name: 'Sagres Sem Álcool 33cl',         url: `${BASE}/SagresSemAlcool.png` },
  { name: 'Água Monchique 1.5L',            url: `${BASE}/AguaMonchique1.5L.png` },
  { name: 'Coca-Cola 0.33L',                url: `${BASE}/coca-cola-0.33.png` },
  { name: 'Red Bull 0.25L',                 url: `${BASE}/redbull.png` },
  { name: 'Leite Meio-Gordo 1L',            url: `${BASE}/leitemeiogordo.png` },
  { name: 'Iogurte Natural Activia',         url: `${BASE}/Iogurte-Liquido-Aveia-Activia-Danone-800g.png` },
  { name: 'Manteiga Mimosa 250g',            url: `${BASE}/manteigamimosa.png` },
  { name: 'Pão de Forma Bimbo',             url: `${BASE}/paodeformaBimbo.png` },
  { name: 'Croissant Amanteigado',          url: `${BASE}/croissantamanteigado.png` },
  { name: 'Lays Original 45g',              url: `${BASE}/Lays-Chips-Original-45g.png` },
  { name: 'Bolachas Maria',                 url: `${BASE}/bolacha-vieira-maria-200g.png` },
  { name: 'Kit Kat Chocolate',              url: `${BASE}/kitkat.png` },
  { name: 'Marlboro Red 20',                url: `${BASE}/malborored.png` },
  { name: 'L&M Blue 20',                    url: `${BASE}/l&m.png` },
  { name: 'Isqueiro BIC',                   url: `${BASE}/isqueiro.png` },
  { name: 'Sabonete Dove 90g',              url: `${BASE}/dove.jpg` },
  { name: 'Pasta Colgate Total 75ml',       url: `${BASE}/pastacolgate.jpg` },
  { name: 'Pizza Frango Congelada',         url: `${BASE}/pizzafrango.png` },
  { name: 'Detergente Roupa Skip 1.5L',     url: `${BASE}/skip.jpg` },
];

const update = db.prepare('UPDATE products SET image_url = ? WHERE name = ?');
let updated = 0;
for (const { name, url } of images) {
  const result = update.run(url, name);
  if (result.changes > 0) updated++;
}
console.log(`✅ ${updated}/${images.length} imagens atualizadas.`);
