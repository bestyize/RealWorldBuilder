import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const file = (path) => new URL(path, import.meta.url);
const presets = [
  { id: 'living-room', label: '山水客厅', filename: 'aquarium.jpg', waterEffect: 1 },
  { id: 'blackwater', label: '雨林黑水', filename: 'blackwater.jpg', waterEffect: 0.4 },
  { id: 'aquascape', label: '清绿水草', filename: 'aquascape.jpg', waterEffect: 0.45 },
  { id: 'moon-window', label: '月下湖景', filename: 'moon-window.jpg', waterEffect: 0 },
  { id: 'black', label: '纯黑', filename: 'black.jpg', waterEffect: 0 },
  { id: 'transparent', label: '透明', waterEffect: 0 },
];
const [bundle, template, model, backgrounds] = await Promise.all([
  build({
    entryPoints: [fileURLToPath(file('./src/viewer.js'))],
    bundle: true,
    format: 'iife',
    minify: true,
    legalComments: 'inline',
    write: false,
  }),
  readFile(file('./src/viewer-template.html'), 'utf8'),
  readFile(file('./assets/arowana.glb')),
  Promise.all(presets.map(async ({ filename, ...preset }) => {
    if (!filename) return preset;
    const asset = await readFile(file(`./assets/${filename}`));
    return { ...preset, imageUrl: 'data:image/jpeg;base64,' + asset.toString('base64') };
  })),
]);

const html = template
  .replace('__MODEL_BASE64__', () => model.toString('base64'))
  .replace('__BACKGROUND_PRESETS__', () => JSON.stringify(backgrounds).replace(/</g, '\\u003c'))
  .replace('__BUNDLE_JS__', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await writeFile(file('./aquarium.html'), html);

