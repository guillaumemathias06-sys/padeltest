const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { licenseExists } = require('./utils/license');
const { createToken } = require('./utils/jwt');
const { authMiddleware } = require('./middleware/auth');

const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const ROLES = ['Joueur', 'JA', 'Club', 'Fédération'];

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function parseBody(req, callback) {
  let data = '';
  req.on('data', chunk => (data += chunk));
  req.on('end', () => {
    try {
      callback(JSON.parse(data));
    } catch {
      callback(null);
    }
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === hashed;
}

function signup(req, res) {
  parseBody(req, body => {
    if (!body) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    const { email, password, role, license_id } = body;
    if (!email || !password || !role || !license_id) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing fields' }));
    }
    if (!ROLES.includes(role)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid role' }));
    }
    if (!licenseExists(license_id)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid license' }));
    }
    const users = readUsers();
    if (users.find(u => u.email === email)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'User exists' }));
    }
    const user = {
      email,
      password: hashPassword(password),
      role,
      license_id,
      photo: '',
      stats: { wins: 0, losses: 0 },
      tournaments: []
    };
    users.push(user);
    writeUsers(users);
    res.end(JSON.stringify({ status: 'ok' }));
  });
}

function login(req, res) {
  parseBody(req, body => {
    if (!body) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    const { email, password } = body;
    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user || !verifyPassword(password, user.password)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Invalid credentials' }));
    }
    const token = createToken({ email: user.email, role: user.role });
    res.end(JSON.stringify({ token }));
  });
}

function profile(req, res) {
  const users = readUsers();
  const user = users.find(u => u.email === req.user.email);
  if (!user) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Not found' }));
  }
  const { password, ...publicUser } = user;
  res.end(JSON.stringify(publicUser));
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const parsed = url.parse(req.url, true);
  if (req.method === 'POST' && parsed.pathname === '/auth/signup') {
    return signup(req, res);
  }
  if (req.method === 'POST' && parsed.pathname === '/auth/login') {
    return login(req, res);
  }
  if (req.method === 'GET' && parsed.pathname === '/profile') {
    return authMiddleware(req, res, () => profile(req, res));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(3000, () => console.log('Server running on port 3000'));
