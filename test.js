const assert = require('assert');
const { licenseExists } = require('./utils/license');
const { createToken, verifyToken } = require('./utils/jwt');

assert(licenseExists('12345'), 'License 12345 should exist');
assert(!licenseExists('XYZ'), 'License XYZ should not exist');
const token = createToken({ email: 'test@example.com', role: 'Joueur' });
const payload = verifyToken(token);
assert(payload.email === 'test@example.com');
console.log('All tests passed');
