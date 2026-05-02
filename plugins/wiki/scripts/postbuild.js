const fs = require('fs');
const path = require('path');

for (const name of ['cli', 'index']) {
  const entry = path.join(__dirname, '..', 'dist', `${name}.js`);
  if (!fs.existsSync(entry)) continue;
  const content = fs.readFileSync(entry, 'utf8');
  if (!content.startsWith('#!')) {
    fs.writeFileSync(entry, '#!/usr/bin/env node\n' + content);
  }
  fs.chmodSync(entry, '755');
}
