// Bundles Rickshaw Rush into dist/: one self-contained index.html that works
// offline, plus the files needed to install it on a phone.
// Usage: node rickshaw/build.js
const fs = require('fs');
const path = require('path');

const here = __dirname, dist = path.join(here, 'dist');
fs.mkdirSync(dist, { recursive: true });
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}</style>`);
html = html.replace(/<script src="([\w./-]+)"><\/script>/g, (_, f) => `<script>\n${read(f)}</script>`);
fs.writeFileSync(path.join(dist, 'index.html'), html);
for (const f of ['sw.js', 'manifest.json', 'icon.svg']) fs.copyFileSync(path.join(here, f), path.join(dist, f));
console.log(`rickshaw/dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
