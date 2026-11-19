import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { arowana } from './fish/arowana/index.js';
import { blueGuppy } from './fish/blue-guppy/index.js';
import { cardinalTetra } from './fish/cardinal-tetra/index.js';
import { vermilionArowana } from './fish/vermilion-arowana/index.js';
import { webpDataUrl, webpModel } from './scripts/webp-assets.mjs';

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

const [aquariumScript, aquariumTemplate, previewTemplate, arowanaModel, guppyModel, tetraModel, vermilionModel, aquascape, backgrounds] = await Promise.all([
  bundleScript('./src/viewer.js'),
  readFile(file('./src/viewer-template.html'), 'utf8'),
  readFile(file('./src/fish-preview-template.html'), 'utf8'),
  webpModel(file(arowana.modelFile)),
  webpModel(file(blueGuppy.modelFile)),
  webpModel(file(cardinalTetra.modelFile)),
  webpModel(file(vermilionArowana.modelFile)),
  webpDataUrl(file('./assets/rocky-shallows.png')),
  Promise.all(presets.map(async ({ filename, ...preset }) => {
    if (!filename) return preset;
    const imageUrl = await webpDataUrl(file(`./assets/${filename}`), { quality: 94 });
    return { ...preset, imageUrl };
  })),
]);

const embeddedBackgrounds = JSON.stringify(backgrounds).replace(/</g, '\\u003c');
function embedPlayer(template, script, models) {
  const modelTags = Object.entries(models).map(([id, model]) =>
    `<script id="${id}" type="application/octet-stream">${model.toString('base64')}</script>`
  ).join('\n  ');
  return template
    .replace('__BACKGROUND_PRESETS__', () => embeddedBackgrounds)
    .replace('__MODEL_DATA__', () => modelTags)
    .replace('__BUNDLE_JS__', () => script);
}

async function writePreview(species, name, model, entry = 'preview') {
  const directory = `./fish/${species.id}`;
  const script = await bundleScript(`${directory}/${entry}.js`);
  const template = previewTemplate.replaceAll('__FISH_NAME__', name);
  await writeFile(file(`${directory}/${entry}.html`), embedPlayer(template, script, { 'model-data': model }));
}

async function writeRabbitPreview() {
  const directory = './objects/plush-rabbit';
  const [template, script, model] = await Promise.all([
    readFile(file(`${directory}/preview-template.html`), 'utf8'),
    bundleScript(`${directory}/preview.js`),
    webpModel(file(`${directory}/plush-rabbit.glb`)),
  ]);
  await writeFile(file(`${directory}/preview.html`), embedPlayer(template, script, { 'model-data': model }));
}

await Promise.all([
  writeFile(file('./aquarium.html'), embedPlayer(aquariumTemplate.replace('__AQUASCAPE_URL__', () => aquascape), aquariumScript, {
    [`model-data-${arowana.id}`]: arowanaModel,
    [`model-data-${vermilionArowana.id}`]: vermilionModel,
    [`model-data-${cardinalTetra.id}`]: tetraModel,
  })),
  writePreview(arowana, '龙鱼', arowanaModel),
  writePreview(blueGuppy, '蓝扇尾孔雀鱼', guppyModel),
  writePreview(blueGuppy, '孔雀鱼群', guppyModel, 'school-preview'),
  writePreview(vermilionArowana, '朱红龙鱼', vermilionModel),
  writeRabbitPreview(),
]);

