#!/usr/bin/env node
/**
 * release.js
 *
 * Bumps version in package.json + .claude-plugin/plugin.json atomically,
 * builds, commits, tags, and publishes to npm.
 *
 * Usage:
 *   node scripts/release.js [patch|minor|major]   (default: patch)
 *   node scripts/release.js --dry-run             (skip git/npm steps)
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pluginRoot = path.join(root, ".claude-plugin");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bumpType = args.find((a) => ["patch", "minor", "major"].includes(a)) ?? "patch";

function run(cmd, cmdArgs, opts = {}) {
  console.log(`  $ ${cmd} ${cmdArgs.join(" ")}`);
  if (!dryRun || opts.always) {
    execFileSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", ...opts });
  }
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// Read current versions
const pkgPath = path.join(root, "package.json");
const pluginPath = path.join(pluginRoot, "plugin.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));

const oldVersion = pkg.version;
const newVersion = bumpVersion(oldVersion, bumpType);

if (pkg.version !== plugin.version) {
  console.error(
    `\nVersion mismatch before release:\n  package.json: ${pkg.version}\n  plugin.json:  ${plugin.version}\n\nFix the mismatch first.\n`
  );
  process.exit(1);
}

console.log(`\nCodeAtlas release: ${oldVersion} → ${newVersion} (${bumpType})${dryRun ? " [dry-run]" : ""}\n`);

// Bump both files atomically
pkg.version = newVersion;
plugin.version = newVersion;

if (!dryRun) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  fs.writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");
  console.log(`  bumped package.json + plugin.json → ${newVersion}`);
} else {
  console.log(`  [dry-run] would bump package.json + plugin.json → ${newVersion}`);
}

// Build
console.log("\nBuilding...");
run("npm", ["run", "build"]);

// Git commit + tag
console.log("\nCommitting...");
run("git", ["add", pkgPath, pluginPath, path.join(root, "dist")]);
run("git", ["commit", "-m", `chore(release): v${newVersion}`]);
run("git", ["tag", `v${newVersion}`]);

// Publish
console.log("\nPublishing to npm...");
run("npm", ["publish", "--access", "public"]);

console.log(`\nDone. v${newVersion} published and tagged.\n`);
