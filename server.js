const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { licenseExists } = require('./utils/license');
const { createToken } = require('./utils/jwt');
const { authMiddleware } = require('./middleware/auth');

const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const PLAYERS_PATH = path.join(__dirname, 'data', 'players.json');
const PAIRS_PATH = path.join(__dirname, 'data', 'pairs.json');
const TOURNAMENTS_PATH = path.join(__dirname, 'data', 'tournaments.json');
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

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
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

// ---------------------------------------------------------------------------
// Players, pairs and tournaments helpers
// ---------------------------------------------------------------------------

function addPlayer(data) {
  const players = readJSON(PLAYERS_PATH);
  const id = 'p' + crypto.randomUUID();
  players.push({ id, firstName: data.firstName, lastName: data.lastName, license: data.license || '' });
  writeJSON(PLAYERS_PATH, players);
  return id;
}

function listPlayers() {
  return readJSON(PLAYERS_PATH);
}

function addPair(p1, p2, seed) {
  const players = listPlayers();
  if (!players.find(pl => pl.id === p1) || !players.find(pl => pl.id === p2) || p1 === p2) {
    return null;
  }
  const pairs = readJSON(PAIRS_PATH);
  const id = 'pr' + crypto.randomUUID();
  pairs.push({ id, p1, p2, seed: seed || null });
  writeJSON(PAIRS_PATH, pairs);
  return id;
}

function listPairs() {
  return readJSON(PAIRS_PATH);
}

function addTournament(data) {
  const tournaments = readJSON(TOURNAMENTS_PATH);
  const id = 't' + crypto.randomUUID();
  tournaments.push({
    id,
    name: data.name,
    startDate: data.startDate,
    endDate: data.endDate,
    category: data.category,
    rules: { superTB: !!data.superTB },
    registrations: []
  });
  writeJSON(TOURNAMENTS_PATH, tournaments);
  return id;
}

function listTournaments() {
  return readJSON(TOURNAMENTS_PATH);
}

function registerPair(tournamentId, pairId) {
  const tournaments = readJSON(TOURNAMENTS_PATH);
  const t = tournaments.find(t => t.id === tournamentId);
  if (!t) return false;
  const pairs = listPairs();
  if (!pairs.find(pr => pr.id === pairId)) return false;
  if (!t.registrations.includes(pairId)) {
    t.registrations.push(pairId);
    writeJSON(TOURNAMENTS_PATH, tournaments);
  }
  return true;
}

function listRegistrations(tournamentId) {
  const t = listTournaments().find(t => t.id === tournamentId);
  return t ? t.registrations : [];
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
  if (req.method === 'GET' && parsed.pathname === '/players') {
    return res.end(JSON.stringify(listPlayers()));
  }
  if (req.method === 'POST' && parsed.pathname === '/players') {
    return parseBody(req, body => {
      if (!body || !body.firstName || !body.lastName) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Missing fields' }));
      }
      const id = addPlayer(body);
      res.end(JSON.stringify({ id }));
    });
  }
  if (req.method === 'GET' && parsed.pathname === '/pairs') {
    return res.end(JSON.stringify(listPairs()));
  }
  if (req.method === 'POST' && parsed.pathname === '/pairs') {
    return parseBody(req, body => {
      if (!body || !body.p1 || !body.p2) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Missing fields' }));
      }
      const id = addPair(body.p1, body.p2, body.seed);
      if (!id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid players' }));
      }
      res.end(JSON.stringify({ id }));
    });
  }
  if (req.method === 'GET' && parsed.pathname === '/tournaments') {
    return res.end(JSON.stringify(listTournaments()));
  }
  if (req.method === 'POST' && parsed.pathname === '/tournaments') {
    return parseBody(req, body => {
      if (!body || !body.name || !body.startDate || !body.endDate || !body.category) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Missing fields' }));
      }
      const id = addTournament(body);
      res.end(JSON.stringify({ id }));
    });
  }
  const regMatch = parsed.pathname.match(/^\/tournaments\/(.+)\/register$/);
  if (req.method === 'POST' && regMatch) {
    return parseBody(req, body => {
      if (!body || !body.pairId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Missing fields' }));
      }
      const ok = registerPair(regMatch[1], body.pairId);
      if (!ok) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid tournament or pair' }));
      }
      res.end(JSON.stringify({ status: 'ok' }));
    });
  }
  const listRegMatch = parsed.pathname.match(/^\/tournaments\/(.+)\/registrations$/);
  if (req.method === 'GET' && listRegMatch) {
    return res.end(JSON.stringify(listRegistrations(listRegMatch[1])));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});
if (require.main === module) {
  server.listen(3000, () => console.log('Server running on port 3000'));
}

module.exports = {
  addPlayer,
  listPlayers,
  addPair,
  listPairs,
  addTournament,
  listTournaments,
  registerPair,
  listRegistrations,
  server
};
