const fs = require('fs');
const path = require('path');

const licensePath = path.join(__dirname, '..', 'data', 'licenses.csv');
let licenses = new Set();

function loadLicenses() {
  try {
    const data = fs.readFileSync(licensePath, 'utf8');
    licenses = new Set(data.split(/\r?\n/).filter(Boolean));
  } catch (err) {
    console.error('Could not load licenses:', err);
    licenses = new Set();
  }
}

function licenseExists(id) {
  if (licenses.size === 0) {
    loadLicenses();
  }
  return licenses.has(String(id));
}

module.exports = { loadLicenses, licenseExists };
