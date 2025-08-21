const crypto = require('crypto');
const SECRET = 'padel-secret';

function base64url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64url(header);
  const encPayload = base64url(payload);
  const signature = sign(`${encHeader}.${encPayload}`, SECRET);
  return `${encHeader}.${encPayload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, signature] = parts;
  const expected = sign(`${encHeader}.${encPayload}`, SECRET);
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encPayload, 'base64').toString());
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { createToken, verifyToken };
