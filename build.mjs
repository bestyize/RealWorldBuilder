import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { arowana } from './fish/arowana/index.js';
import { blueGuppy } from './fish/blue-guppy/index.js';

const file = (path) => new URL(path, import.meta.url);
const presets = [
  { id: 'living-room', label: '山水客厅', filename: 'aquarium.jpg', waterEffect: 1 },
  { id: 'blackwater', label: '雨林黑水', filename: 'blackwater.jpg', waterEffect: 0.4 },
  { id: 'aquascape', label: '清绿水草', filename: 'aquascape.jpg', waterEffect: 0.45 },
  { id: 'moon-window', label: '月下湖景', filename: 'moon-window.jpg', waterEffect: 0 },
  { id: 'black', label: '纯黑', filename: 'black.jpg', waterEffect: 0 },
  { id: 'transparent', label: '透明', waterEffect: 0 },
];
function bundleScript(entry) {
  return build({
    entryPoints: [fileURLToPath(file(entry))],
    bundle: true,
    format: 'iife',
    minify: true,
    legalComments: 'inline',
    write: false,
  }).then(bundle => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
}

const [aquariumScript, aquariumTemplate, previewTemplate, arowanaModel, guppyModel, backgrounds] = await Promise.all([
  bundleScript('./src/viewer.js'),
  readFile(file('./src/viewer-template.html'), 'utf8'),
  readFile(file('./src/fish-preview-template.html'), 'utf8'),
  readFile(file(arowana.modelFile)),
  readFile(file(blueGuppy.modelFile)),
  Promise.all(presets.map(async ({ filename, ...preset }) => {
    if (!filename) return preset;
    const asset = await readFile(file(`./assets/${filename}`));
    return { ...preset, imageUrl: 'data:image/jpeg;base64,' + asset.toString('base64') };
  })),
]);

const embeddedBackgrounds = JSON.stringify(backgrounds).replace(/</g, '\\u003c');
function embedPlayer(template, script, model) {
  return template
    .replace('__BACKGROUND_PRESETS__', () => embeddedBackgrounds)
    .replace('__MODEL_BASE64__', () => model.toString('base64'))
    .replace('__BUNDLE_JS__', () => script);
}

async function writePreview(species, name, model) {
  const directory = `./fish/${species.id}`;
  const script = await bundleScript(`${directory}/preview.js`);
  const html = embedPlayer(previewTemplate.replaceAll('__FISH_NAME__', name), script, model);
  await writeFile(file(`${directory}/preview.html`), html);
}

await Promise.all([
  writeFile(file('./aquarium.html'), embedPlayer(aquariumTemplate, aquariumScript, arowanaModel)),
  writePreview(arowana, '龙鱼', arowanaModel),
  writePreview(blueGuppy, '蓝扇尾孔雀鱼', guppyModel),
]);

