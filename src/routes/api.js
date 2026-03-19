const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { run, get, all } = require('../database');
const { authMiddleware, SECRET } = require('../middleware/auth');

// Multer setup
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── AUTH ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Dados incompletos' });

  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// ─── PUBLIC MENU ─────────────────────────────────────────────────────────────
router.get('/menu', (req, res) => {
  const categories = all('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order');
  const subcategories = all('SELECT * FROM subcategories WHERE active = 1 ORDER BY sort_order');
  const products = all('SELECT * FROM products WHERE active = 1 ORDER BY sort_order, id');
  const banners = all('SELECT * FROM banners WHERE active = 1 ORDER BY sort_order');
  const settings = all('SELECT * FROM settings');

  const settingsObj = {};
  for (const s of settings) settingsObj[s.key] = s.value;

  const menu = categories.map(cat => ({
    ...cat,
    subcategories: subcategories.filter(s => s.category_id === cat.id).map(sub => ({
      ...sub,
      products: products.filter(p => p.subcategory_id === sub.id)
    })),
    products: products.filter(p => p.category_id === cat.id && !p.subcategory_id)
  }));

  res.json({ menu, banners, settings: settingsObj });
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────
router.post('/orders', (req, res) => {
  const { customer_name, customer_phone, delivery_type, address_street, address_number,
    address_neighborhood, payment_method, change_amount, items, total } = req.body;

  if (!customer_name || !customer_phone || !items || !total) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  run(`INSERT INTO orders (customer_name, customer_phone, delivery_type, address_street,
    address_number, address_neighborhood, payment_method, change_amount, items, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_name, customer_phone, delivery_type, address_street, address_number,
     address_neighborhood, payment_method, change_amount || null,
     typeof items === 'string' ? items : JSON.stringify(items), total]);

  res.json({ success: true, message: 'Pedido registrado com sucesso!' });
});

// ─── ADMIN: CATEGORIES ───────────────────────────────────────────────────────
router.get('/admin/categories', authMiddleware, (req, res) => {
  res.json(all('SELECT * FROM categories ORDER BY sort_order'));
});

router.post('/admin/categories', authMiddleware, (req, res) => {
  const { name, slug, icon, sort_order } = req.body;
  run('INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)',
    [name, slug || name.toLowerCase().replace(/\s+/g, '-'), icon, sort_order || 0]);
  res.json({ success: true });
});

router.put('/admin/categories/:id', authMiddleware, (req, res) => {
  const { name, slug, icon, sort_order, active } = req.body;
  run('UPDATE categories SET name=?, slug=?, icon=?, sort_order=?, active=? WHERE id=?',
    [name, slug, icon, sort_order, active ? 1 : 0, req.params.id]);
  res.json({ success: true });
});

router.delete('/admin/categories/:id', authMiddleware, (req, res) => {
  run('DELETE FROM categories WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ─── ADMIN: SUBCATEGORIES ────────────────────────────────────────────────────
router.get('/admin/subcategories', authMiddleware, (req, res) => {
  res.json(all('SELECT s.*, c.name as category_name FROM subcategories s LEFT JOIN categories c ON c.id=s.category_id ORDER BY s.sort_order'));
});

router.post('/admin/subcategories', authMiddleware, (req, res) => {
  const { category_id, name, slug, sort_order } = req.body;
  run('INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES (?, ?, ?, ?)',
    [category_id, name, slug || name.toLowerCase().replace(/\s+/g, '-'), sort_order || 0]);
  res.json({ success: true });
});

router.put('/admin/subcategories/:id', authMiddleware, (req, res) => {
  const { category_id, name, slug, sort_order, active } = req.body;
  run('UPDATE subcategories SET category_id=?, name=?, slug=?, sort_order=?, active=? WHERE id=?',
    [category_id, name, slug, sort_order, active ? 1 : 0, req.params.id]);
  res.json({ success: true });
});

router.delete('/admin/subcategories/:id', authMiddleware, (req, res) => {
  run('DELETE FROM subcategories WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ─── ADMIN: PRODUCTS ─────────────────────────────────────────────────────────
router.get('/admin/products', authMiddleware, (req, res) => {
  res.json(all(`SELECT p.*, c.name as category_name, s.name as subcategory_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    ORDER BY p.sort_order, p.id`));
});

router.post('/admin/products', authMiddleware, upload.single('image'), (req, res) => {
  const { category_id, subcategory_id, name, description, price, has_half_half, removable_ingredients, sort_order, active } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  run(`INSERT INTO products (category_id, subcategory_id, name, description, price, image, has_half_half, removable_ingredients, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, subcategory_id || null, name, description, parseFloat(price), image, has_half_half ? 1 : 0, removable_ingredients, sort_order || 0, active !== '0' ? 1 : 0]);
  res.json({ success: true });
});

router.put('/admin/products/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { category_id, subcategory_id, name, description, price, has_half_half, removable_ingredients, sort_order, active } = req.body;
  const existing = get('SELECT image FROM products WHERE id=?', [req.params.id]);
  const image = req.file ? `/uploads/${req.file.filename}` : existing?.image;
  run(`UPDATE products SET category_id=?, subcategory_id=?, name=?, description=?, price=?, image=?, has_half_half=?, removable_ingredients=?, sort_order=?, active=? WHERE id=?`,
    [category_id, subcategory_id || null, name, description, parseFloat(price), image, has_half_half ? 1 : 0, removable_ingredients, sort_order || 0, active !== '0' ? 1 : 0, req.params.id]);
  res.json({ success: true });
});

router.delete('/admin/products/:id', authMiddleware, (req, res) => {
  const prod = get('SELECT image FROM products WHERE id=?', [req.params.id]);
  if (prod?.image) {
    const imgPath = path.join(__dirname, '../../public', prod.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  run('DELETE FROM products WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ─── ADMIN: BANNERS ──────────────────────────────────────────────────────────
router.get('/admin/banners', authMiddleware, (req, res) => {
  res.json(all('SELECT * FROM banners ORDER BY sort_order'));
});

router.post('/admin/banners', authMiddleware, (req, res) => {
  const { title, subtitle, badge, color_from, color_to, sort_order } = req.body;
  run('INSERT INTO banners (title, subtitle, badge, color_from, color_to, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [title, subtitle, badge, color_from, color_to, sort_order || 0]);
  res.json({ success: true });
});

router.put('/admin/banners/:id', authMiddleware, (req, res) => {
  const { title, subtitle, badge, color_from, color_to, sort_order, active } = req.body;
  run('UPDATE banners SET title=?, subtitle=?, badge=?, color_from=?, color_to=?, sort_order=?, active=? WHERE id=?',
    [title, subtitle, badge, color_from, color_to, sort_order, active ? 1 : 0, req.params.id]);
  res.json({ success: true });
});

router.delete('/admin/banners/:id', authMiddleware, (req, res) => {
  run('DELETE FROM banners WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ─── ADMIN: SETTINGS ─────────────────────────────────────────────────────────
router.get('/admin/settings', authMiddleware, (req, res) => {
  const rows = all('SELECT * FROM settings');
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

router.put('/admin/settings', authMiddleware, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    const exists = get('SELECT key FROM settings WHERE key=?', [key]);
    if (exists) run('UPDATE settings SET value=? WHERE key=?', [value, key]);
    else run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  res.json({ success: true });
});

// ─── ADMIN: ORDERS ───────────────────────────────────────────────────────────
router.get('/admin/orders', authMiddleware, (req, res) => {
  const orders = all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
  res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })));
});

router.put('/admin/orders/:id/status', authMiddleware, (req, res) => {
  run('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id]);
  res.json({ success: true });
});

// ─── UPLOAD IMAGE ────────────────────────────────────────────────────────────
router.post('/admin/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
