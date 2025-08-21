const assert = require('assert');
const { licenseExists } = require('./utils/license');
const { createToken, verifyToken } = require('./utils/jwt');
const fs = require('fs');
const {
  addPlayer,
  listPlayers,
  addPair,
  listPairs,
  addTournament,
  listTournaments,
  registerPair,
  listRegistrations
} = require('./server');

assert(licenseExists('12345'), 'License 12345 should exist');
assert(!licenseExists('XYZ'), 'License XYZ should not exist');
const token = createToken({ email: 'test@example.com', role: 'Joueur' });
const payload = verifyToken(token);
assert(payload.email === 'test@example.com');

// reset data files
fs.writeFileSync('./data/players.json', '[]');
fs.writeFileSync('./data/pairs.json', '[]');
fs.writeFileSync('./data/tournaments.json', '[]');

// players and pairs
const p1 = addPlayer({ firstName: 'A', lastName: 'B' });
const p2 = addPlayer({ firstName: 'C', lastName: 'D' });
assert(listPlayers().length === 2);
const pairId = addPair(p1, p2, 1);
assert(listPairs().some(p => p.id === pairId));

// tournaments and registrations
const tId = addTournament({ name: 'Open', startDate: '2023-01-01', endDate: '2023-01-02', category: 'P100', superTB: true });
assert(listTournaments().some(t => t.id === tId && t.rules.superTB));
registerPair(tId, pairId);
assert(listRegistrations(tId).includes(pairId));
console.log('All tests passed');
