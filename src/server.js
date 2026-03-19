require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Health check imediato — Railway usa isso para saber se o servidor está vivo
let dbReady = false;
app.get('/health', (req, res) => res.json({ status: 'ok', db: dbReady }));

// Bloqueia /api/* com 503 enquanto o banco não estiver pronto
app.use('/api', (req, res, next) => {
  if (!dbReady) return res.status(503).json({ error: 'Iniciando, aguarde...' });
  next();
});

// Servidor sobe IMEDIATAMENTE (antes do banco carregar)
app.listen(PORT, () => {
  console.log(`🔥 Gran Prime ouvindo na porta ${PORT}`);
  console.log(`⏳ Iniciando banco de dados...`);
});

// Inicia banco em segundo plano e registra as rotas depois
initDB().then(() => {
  dbReady = true;
  const apiRoutes = require('./routes/api');
  app.use('/api', apiRoutes);
  app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
  console.log(`✅ Banco pronto! Sistema operacional.`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin`);
  console.log(`   Login: admin@brasa.com / admin123`);
}).catch(err => {
  console.error('❌ Erro ao iniciar banco:', err);
  process.exit(1);
});
