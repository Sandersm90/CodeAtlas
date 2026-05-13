const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const binding = path.join(dir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

if (!fs.existsSync(binding)) {
  try {
    execSync('npm rebuild better-sqlite3 sqlite-vec', { cwd: dir, stdio: 'inherit' });
  } catch {
    process.stderr.write('Warning: native module rebuild failed. Run: npm rebuild better-sqlite3 sqlite-vec\n');
  }
}
