const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/delivery.db');

let db;
let SQL;

async function initDB() {
  SQL = await initSqlJs();
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  seedData();
  saveDB();
  
  // Auto-save every 30s
  setInterval(saveDB, 30000);
  
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getDB() {
  return db;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    subcategory_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    sizes_prices TEXT,
    image TEXT,
    active INTEGER DEFAULT 1,
    has_half_half INTEGER DEFAULT 0,
    removable_ingredients TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
  )`);

  // Migration: add sizes_prices if upgrading from older schema
  try { db.run('ALTER TABLE products ADD COLUMN sizes_prices TEXT'); } catch(e) {}

  db.run(`CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT,
    image TEXT,
    color_from TEXT DEFAULT '#8B0000',
    color_to TEXT DEFAULT '#FFD700',
    badge TEXT,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    customer_phone TEXT,
    delivery_type TEXT,
    address_street TEXT,
    address_number TEXT,
    address_neighborhood TEXT,
    payment_method TEXT,
    change_amount REAL,
    items TEXT,
    total REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
}

function seedData() {
  const bcrypt = require('bcryptjs');
  
  // Admin user
  const existingUser = get('SELECT id FROM users WHERE email = ?', ['admin@brasa.com']);
  if (!existingUser) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT INTO users (email, password, name) VALUES (?, ?, ?)`,
      ['admin@brasa.com', hash, 'Administrador']);
  }

  // Settings
  const settings = {
    restaurant_name: 'Gran Prime - Churrascaria e Pizzaria',
    whatsapp: '5598912345678',
    open: '1',
    open_hours: '18:00 - 23:00',
    address: 'Rua das Flores, 100 - Centro',
    min_order: '20',
    delivery_fee: '5',
    logo_url: '',
  };
  for (const [key, value] of Object.entries(settings)) {
    const exists = get('SELECT key FROM settings WHERE key = ?', [key]);
    if (!exists) db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
  }

  // Categories
  const cats = [
    { name: 'Entradas', slug: 'entradas', icon: '🥗', sort_order: 1 },
    { name: 'Churrascos', slug: 'churrascos', icon: '🥩', sort_order: 2 },
    { name: 'Pizzas', slug: 'pizzas', icon: '🍕', sort_order: 3 },
    { name: 'Bebidas', slug: 'bebidas', icon: '🥤', sort_order: 4 },
  ];
  for (const cat of cats) {
    const exists = get('SELECT id FROM categories WHERE slug = ?', [cat.slug]);
    if (!exists) {
      db.run(`INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)`,
        [cat.name, cat.slug, cat.icon, cat.sort_order]);
    }
  }

  // Subcategories for pizza
  const pizzaCat = get(`SELECT id FROM categories WHERE slug = 'pizzas'`);
  if (pizzaCat) {
    const subcats = [
      { name: 'Pizzas Tradicionais', slug: 'pizzas-tradicionais', sort_order: 1 },
      { name: 'Pizzas Especiais', slug: 'pizzas-especiais', sort_order: 2 },
    ];
    for (const sub of subcats) {
      const exists = get('SELECT id FROM subcategories WHERE slug = ?', [sub.slug]);
      if (!exists) {
        db.run(`INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES (?, ?, ?, ?)`,
          [pizzaCat.id, sub.name, sub.slug, sub.sort_order]);
      }
    }
  }

  // Products
  const entradas = get(`SELECT id FROM categories WHERE slug = 'entradas'`);
  const churrascos = get(`SELECT id FROM categories WHERE slug = 'churrascos'`);
  const pizzas = get(`SELECT id FROM categories WHERE slug = 'pizzas'`);
  const bebidas = get(`SELECT id FROM categories WHERE slug = 'bebidas'`);
  const pizzaTrad = get(`SELECT id FROM subcategories WHERE slug = 'pizzas-tradicionais'`);
  const pizzaEsp = get(`SELECT id FROM subcategories WHERE slug = 'pizzas-especiais'`);

  const existingProducts = all('SELECT id FROM products');
  if (existingProducts.length > 0) return;

  const products = [
    // Entradas
    { cat: entradas?.id, sub: null, name: 'Pão de Alho Especial', desc: 'Pão artesanal com manteiga temperada e ervas frescas', price: 18.90, img: null, ingr: 'alho,manteiga' },
    { cat: entradas?.id, sub: null, name: 'Linguiça Toscana Grelhada', desc: 'Linguiça artesanal defumada, servida com molho chimichurri', price: 24.90, img: null, ingr: 'linguiça' },
    { cat: entradas?.id, sub: null, name: 'Mandioca Frita Crocante', desc: 'Mandioca fresquinha frita até dourar, com vinagrete', price: 16.90, img: null, ingr: null },
    { cat: entradas?.id, sub: null, name: 'Bolinho de Carne Seca', desc: 'Bolinhos crocantes recheados com carne seca desfiada e catupiry', price: 22.90, img: null, ingr: 'cebola,catupiry' },

    // Churrascos
    { cat: churrascos?.id, sub: null, name: 'Picanha Grelhada', desc: '300g de picanha prime temperada com sal grosso, servida com arroz, feijão e farofa', price: 89.90, img: null, ingr: 'sal grosso' },
    { cat: churrascos?.id, sub: null, name: 'Costela Bovina no Bafo', desc: '500g de costela maturada, assada lentamente por 12h, desmanchando na boca', price: 79.90, img: null, ingr: null },
    { cat: churrascos?.id, sub: null, name: 'Frango na Brasa', desc: 'Meio frango caipira temperado na vinha d\'alhos, assado na brasa', price: 49.90, img: null, ingr: 'alho,limão' },
    { cat: churrascos?.id, sub: null, name: 'Mix do Churrasqueiro', desc: 'Seleção do dia com picanha, linguiça, frango e costela — para 2 pessoas', price: 119.90, img: null, ingr: null },

    // Pizzas Tradicionais
    { cat: pizzas?.id, sub: pizzaTrad?.id, name: 'Margherita', desc: 'Molho de tomate artesanal, mussarela de búfala e manjericão fresco', price: 42.90, img: null, half: 1, ingr: 'manjericão,cebola' },
    { cat: pizzas?.id, sub: pizzaTrad?.id, name: 'Calabresa', desc: 'Molho de tomate, calabresa fatiada, cebola e azeitona', price: 44.90, img: null, half: 1, ingr: 'cebola,azeitona' },
    { cat: pizzas?.id, sub: pizzaTrad?.id, name: 'Frango com Catupiry', desc: 'Frango desfiado temperado, catupiry original e milho', price: 46.90, img: null, half: 1, ingr: 'milho,catupiry' },
    { cat: pizzas?.id, sub: pizzaTrad?.id, name: 'Quatro Queijos', desc: 'Mussarela, provolone, gorgonzola e parmesão gratinados', price: 48.90, img: null, half: 1, ingr: 'gorgonzola' },

    // Pizzas Especiais
    { cat: pizzas?.id, sub: pizzaEsp?.id, name: 'Brasa Premium', desc: 'Molho de tomate defumado, picanha fatiada, cebola caramelizada e rúcula', price: 64.90, img: null, half: 1, ingr: 'rúcula,cebola' },
    { cat: pizzas?.id, sub: pizzaEsp?.id, name: 'Costela BBQ', desc: 'Base de molho barbecue, costela desfiada, cheddar e cebola crispy', price: 62.90, img: null, half: 1, ingr: 'cebola' },
    { cat: pizzas?.id, sub: pizzaEsp?.id, name: 'Camarão ao Alho', desc: 'Camarões salteados no alho e azeite, mussarela e tomate cereja', price: 68.90, img: null, half: 1, ingr: 'alho,tomate' },
    { cat: pizzas?.id, sub: pizzaEsp?.id, name: 'Trufa com Funghi', desc: 'Creme de trufa negra, mix de funghi, mussarela e parmesão', price: 72.90, img: null, half: 1, ingr: null },

    // Bebidas
    { cat: bebidas?.id, sub: null, name: 'Refrigerante Lata', desc: 'Coca-Cola, Guaraná, Sprite ou Fanta — 350ml gelada', price: 6.90, img: null, ingr: null },
    { cat: bebidas?.id, sub: null, name: 'Água Mineral', desc: 'Com ou sem gás — 500ml', price: 4.90, img: null, ingr: null },
    { cat: bebidas?.id, sub: null, name: 'Suco Natural', desc: 'Laranja, Maracujá, Limão ou Morango — 500ml', price: 12.90, img: null, ingr: null },
    { cat: bebidas?.id, sub: null, name: 'Cerveja Long Neck', desc: 'Heineken, Budweiser ou Stella Artois — 330ml gelada', price: 14.90, img: null, ingr: null },
  ];

  for (const p of products) {
    if (!p.cat) continue;
    // Default sizes_prices for pizzas: based on price with standard multipliers
    let sizesPrices = null;
    if (p.half) {
      sizesPrices = JSON.stringify({
        P:  parseFloat((p.price * 0.70).toFixed(2)),
        M:  parseFloat((p.price * 0.85).toFixed(2)),
        G:  parseFloat((p.price * 1.00).toFixed(2)),
        GG: parseFloat((p.price * 1.20).toFixed(2)),
        F:  parseFloat((p.price * 1.45).toFixed(2)),
      });
    }
    db.run(`INSERT INTO products (category_id, subcategory_id, name, description, price, sizes_prices, image, has_half_half, removable_ingredients)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.cat, p.sub || null, p.name, p.desc, p.price, sizesPrices, p.img, p.half ? 1 : 0, p.ingr || null]);
  }

  // Banners
  const bannerExists = all('SELECT id FROM banners');
  if (bannerExists.length === 0) {
    const banners = [
      { title: 'Promoção de Quarta', subtitle: '30% OFF em todas as pizzas tradicionais', badge: '🔥 Hoje', color_from: '#8B0000', color_to: '#CC0000' },
      { title: 'Picanha do Chef', subtitle: 'Picanha Prime + 2 acompanhamentos por R$99,90', badge: '⭐ Especial', color_from: '#8B6914', color_to: '#D4AF37' },
      { title: 'Frete Grátis', subtitle: 'Pedidos acima de R$80 com entrega gratuita no bairro', badge: '🛵 Grátis', color_from: '#1a1a1a', color_to: '#4a4a4a' },
    ];
    for (const b of banners) {
      db.run(`INSERT INTO banners (title, subtitle, badge, color_from, color_to) VALUES (?, ?, ?, ?, ?)`,
        [b.title, b.subtitle, b.badge, b.color_from, b.color_to]);
    }
  }
}

module.exports = { initDB, getDB, run, get, all, saveDB };
