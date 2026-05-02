const fs = require('fs');
const path = require('path');

const entry = path.join(__dirname, '..', 'dist', 'index.js');
const content = fs.readFileSync(entry, 'utf8');
if (!content.startsWith('#!')) {
  fs.writeFileSync(entry, '#!/usr/bin/env node\n' + content);
}
fs.chmodSync(entry, '755');
