const fs = require('node:fs');
const path = require('node:path');

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run set-server -- https://chat.example.com');
  process.exit(1);
}
let url;
try { url = new URL(raw); }
catch { console.error('Invalid URL. Example: https://chat.example.com'); process.exit(1); }
if (!['http:', 'https:'].includes(url.protocol)) {
  console.error('Only http:// and https:// are supported.');
  process.exit(1);
}
const normalized = url.origin;
const root = path.join(__dirname, '..');
const target = path.join(root, 'src', 'default-config.json');
fs.writeFileSync(target, JSON.stringify({ serverUrl: normalized }, null, 2) + '\n');

const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.build = pkg.build || {};
pkg.build.publish = [{ provider: 'generic', url: `${normalized}/updates` }];
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Default Rodnik server set to: ${normalized}`);
console.log(`Auto-update channel set to: ${normalized}/updates`);
