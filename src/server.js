require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limit
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Start DB then routes
initDB().then(() => {
  const apiRoutes = require('./routes/api');
  app.use('/api', apiRoutes);

  // SPA fallback
  app.get('/admin*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
  });
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🔥 Brasa & Pizza rodando na porta ${PORT}`);
    console.log(`📊 Admin: http://localhost:${PORT}/admin`);
    console.log(`   Login: admin@brasa.com / admin123`);
  });
}).catch(err => {
  console.error('Erro ao iniciar banco:', err);
  process.exit(1);
});
