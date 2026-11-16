// Deliberately separate target: never regenerates aquarium or another species.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { webpModel } from '../../scripts/webp-assets.mjs';
const file = path => new URL(path, import.meta.url);
const [template, bundle, model] = await Promise.all([
  readFile(file('../../src/fish-preview-template.html'), 'utf8'),
  build({ entryPoints: [fileURLToPath(file('preview.js'))], bundle: true, format: 'iife', minify: true, legalComments: 'inline', write: false }),
  webpModel(file('sterbai-cory.glb')),
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = template.replaceAll('__FISH_NAME__', '斯氏鼠鱼')
  .replace('__MODEL_DATA__', () => `<script id="model-data" type="application/octet-stream">${model.toString('base64')}</script>`)
  .replace('__BUNDLE_JS__', () => script)
  .replace(/<a[^>]*href="[^\"]*aquarium\.html"[^>]*>.*?<\/a>/g, '');
await writeFile(file('preview.html'), html);
console.log(`Sterbai cory standalone preview built (${model.length} embedded GLB bytes).`);
