const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Missing token' }));
    return;
  }
  const token = auth.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Invalid token' }));
    return;
  }
  req.user = payload;
  next();
}

function roleMiddleware(roles) {
  return function (req, res, next) {
    if (!roles.includes(req.user.role)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    next();
  };
}

module.exports = { authMiddleware, roleMiddleware };
