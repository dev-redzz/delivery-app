const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'brasa-pizza-secret-2024';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necessário' });
  }
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authMiddleware, SECRET };
