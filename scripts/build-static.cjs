const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
// Link previews (WhatsApp, Instagram) need absolute URLs; Vercel provides the production domain.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
const origin = host ? `https://${host}` : '';
fs.mkdirSync(output, { recursive: true });
for (const file of fs.readdirSync(root)) {
  if (!/\.(html|css|js|ico)$/.test(file)) continue;
  const source = path.join(root, file), target = path.join(output, file);
  if (file.endsWith('.html') && origin) {
    const html = fs.readFileSync(source, 'utf8').replace(/(<meta property="og:(?:image|url)" content=")\//g, `$1${origin}/`);
    fs.writeFileSync(target, html);
  } else fs.copyFileSync(source, target);
}
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
console.log(`Static site ready in dist/${origin ? ` (link previews use ${origin})` : ''}`);
