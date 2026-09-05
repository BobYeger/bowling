#!/usr/bin/env node
// Build each game as ONE self-contained HTML fragment, ready to publish as an artifact.
//
//   npm run build:artifacts            → artifacts/<id>.html for every game in games.json
//   npm run build:artifacts -- pendel  → just that game
//
// The output is a fragment (no <!doctype>/<html>/<head>/<body> — the artifact host wraps
// it) with the JS bundle and CSS inlined, cross-links pointing at the other games'
// published artifact URLs (ARTIFACT=1 in vite.config.js), and RTL restored by a tiny
// inline script. To republish, pass the artifact URL from games.json to the Artifact tool.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'games.json'), 'utf8'));
const only = process.argv[2];
const games = manifest.games.filter((g) => !only || g.id === only);
if (!games.length) {
  console.error(`unknown game id "${only}" — ids: ${manifest.games.map((g) => g.id).join(', ')}`);
  process.exit(1);
}
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

const inlineAssets = (html, outDir) => html
  .replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
    const js = readFileSync(resolve(outDir, src.replace(/^\//, '')), 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script type="module">\n${js}\n</script>`;
  })
  .replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
    const css = readFileSync(resolve(outDir, href.replace(/^\//, '')), 'utf8');
    return `<style>\n${css}\n</style>`;
  })
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

for (const g of games) {
  const outDir = resolve(root, `dist-${g.id}`);
  console.log(`\n▶ building ${g.id} (${g.title}) …`);
  execSync('npx vite build', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ONLY: g.id, ARTIFACT: '1', OUT_DIR: outDir },
  });
  const html = inlineAssets(readFileSync(resolve(outDir, g.page), 'utf8'), outDir);
  const head = (html.match(/<head>([\s\S]*?)<\/head>/i) || [null, ''])[1].replace(/<meta[^>]*>\s*/g, '');
  const body = (html.match(/<body>([\s\S]*?)<\/body>/i) || [null, html])[1];
  const fragment = `<script>document.documentElement.setAttribute('dir','rtl');document.documentElement.lang='he';</script>\n${head.trim()}\n${body.trim()}\n`;
  const out = resolve(root, 'artifacts', `${g.id}.html`);
  writeFileSync(out, fragment);
  console.log(`✓ ${out}  (${(fragment.length / 1024).toFixed(0)} KB)  → republish at ${g.artifact}`);
}
