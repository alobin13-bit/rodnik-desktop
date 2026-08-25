const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function concatParts(dir, target) {
  const sourceDir = path.join(root, dir);
  const parts = fs.readdirSync(sourceDir).filter(name => name.endsWith('.part')).sort();
  if (!parts.length) throw new Error(`No source parts found in ${dir}`);
  const content = parts.map(name => fs.readFileSync(path.join(sourceDir, name), 'utf8')).join('');
  fs.writeFileSync(path.join(root, target), content);
}

function decodeBase64(source, target) {
  const data = fs.readFileSync(path.join(root, source), 'utf8').trim();
  fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
  fs.writeFileSync(path.join(root, target), Buffer.from(data, 'base64'));
}

concatParts('src/renderer.parts', 'src/renderer.js');
concatParts('src/styles.parts', 'src/styles.css');
decodeBase64('assets/source/icon.png.b64', 'assets/icon.png');
decodeBase64('assets/source/icon.ico.b64', 'assets/icon.ico');
console.log('Rodnik generated source/assets prepared.');
