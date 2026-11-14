import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { arowana } from './fish/arowana/index.js';
import { blueGuppy } from './fish/blue-guppy/index.js';
import { webpImage, webpModel } from './scripts/webp-assets.mjs';

const file = name => new URL(name, import.meta.url);
const assetDirectory = 'assets/player';
const presets = [
  { id: 'living-room', label: '山水客厅', filename: 'aquarium.jpg', waterEffect: 1 },
  { id: 'blackwater', label: '雨林黑水', filename: 'blackwater.jpg', waterEffect: 0.4 },
  { id: 'aquascape', label: '清绿水草', filename: 'aquascape.jpg', waterEffect: 0.45 },
  { id: 'moon-window', label: '月下湖景', filename: 'moon-window.jpg', waterEffect: 0 },
  { id: 'black', label: '纯黑', filename: 'black.jpg', waterEffect: 0 },
  { id: 'transparent', label: '透明', waterEffect: 0 },
];

await mkdir(file(assetDirectory), { recursive: true });

async function publishAsset(name, extension, bytes) {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const destination = `${assetDirectory}/${name}.${digest}.${extension}`;
  await writeFile(file(destination), bytes);
  return destination;
}

function relativeAsset(page, destination) {
  return path.posix.relative(path.posix.dirname(page), destination);
}

async function bundleScript(entry) {
  const bundle = await build({
    entryPoints: [fileURLToPath(file(entry))],
    bundle: true,
    format: 'iife',
    minify: true,
    legalComments: 'inline',
    write: false,
  });
  return bundle.outputFiles[0].text;
}

const [aquariumTemplate, previewTemplate, backgrounds, aquascape, fishModels] = await Promise.all([
  readFile(file('src/viewer-template.html'), 'utf8'),
  readFile(file('src/fish-preview-template.html'), 'utf8'),
  Promise.all(presets.map(async ({ filename, ...preset }) => {
    if (!filename) return preset;
    const source = file(`assets/${filename}`);
    const [image, thumbnail] = await Promise.all([
      webpImage(source, { quality: 94 }),
      webpImage(source, { width: 240, quality: 82 }),
    ]);
    const asset = await publishAsset(preset.id, 'webp', image);
    return { ...preset, image, asset, thumbnail: webpUrl(thumbnail) };
  })),
  webpImage(file('assets/rocky-shallows.png')),
  Promise.all([arowana, blueGuppy].map(async ({ id, modelFile }) => {
    const bytes = await webpModel(file(modelFile));
    const url = await publishAsset(id, 'glb', bytes);
    return [`model-data-${id}`, { url, bytes }];
  })).then(Object.fromEntries),
]);

function webpUrl(bytes) {
  return 'data:image/webp;base64,' + bytes.toString('base64');
}

function renderPlayer({ page, template, script, models, data, offline = false }) {
  const modelTags = Object.entries(models).map(([id, model]) => {
    if (offline) {
      return `<script id="${id}" type="application/octet-stream">${model.bytes.toString('base64')}</script>`;
    }
    return `<script id="${id}" type="application/octet-stream" data-url="${relativeAsset(page, model.url)}"></script>`;
  }).join('\n  ');
  return template
    .replace('__BODY_ATTRIBUTES__', offline ? ' data-offline' : '')
    .replace('__AQUARIUM_ASSETS__', () => JSON.stringify(data).replace(/</g, '\\u003c'))
    .replace('__MODEL_DATA__', () => modelTags)
    .replace('__PLAYER_SCRIPT__', () => script);
}

async function writeAquarium() {
  const page = 'aquarium.html';
  const [script, foreground] = await Promise.all([
    bundleScript('src/viewer.js'),
    publishAsset('rocky-shallows', 'webp', aquascape),
  ]);
  const scriptUrl = await publishAsset('aquarium', 'js', script);
  function data(offline) {
    const presets = backgrounds.map(({ image, asset, ...preset }) => ({
      ...preset,
      imageUrl: asset && (offline ? webpUrl(image) : relativeAsset(page, asset)),
    }));
    return {
      backgrounds: presets,
      aquascapeUrl: offline ? webpUrl(aquascape) : relativeAsset(page, foreground),
    };
  }
  await Promise.all([
    writeFile(file(page), renderPlayer({
      page, template: aquariumTemplate, models: fishModels, data: data(false),
      script: `<script defer src="${relativeAsset(page, scriptUrl)}"></script>`,
    })),
    writeFile(file('aquarium-offline.html'), renderPlayer({
      page, template: aquariumTemplate, models: fishModels, data: data(true), offline: true,
      script: `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`,
    })),
  ]);
}

async function writePreview(page, template, entry, model) {
  const script = await bundleScript(entry + '.js');
  const asset = await publishAsset(entry.replaceAll('/', '-'), 'js', script);
  const html = renderPlayer({
    page, template, models: { 'model-data': model },
    script: `<script defer src="${relativeAsset(page, asset)}"></script>`,
  });
  await writeFile(file(page), html);
}

async function writeFishPreview(species, title, name = 'preview') {
  const entry = `fish/${species.id}/${name}`;
  const template = previewTemplate.replaceAll('__FISH_NAME__', title);
  await writePreview(entry + '.html', template, entry, fishModels[`model-data-${species.id}`]);
}

async function writeRabbitPreview() {
  const directory = 'objects/plush-rabbit';
  const [template, bytes] = await Promise.all([
    readFile(file(`${directory}/preview-template.html`), 'utf8'),
    webpModel(file(`${directory}/plush-rabbit.glb`)),
  ]);
  const url = await publishAsset('plush-rabbit', 'glb', bytes);
  await writePreview(`${directory}/preview.html`, template, `${directory}/preview`, { url, bytes });
}

await Promise.all([
  writeAquarium(),
  writeFishPreview(arowana, '龙鱼'),
  writeFishPreview(blueGuppy, '蓝扇尾孔雀鱼'),
  writeFishPreview(blueGuppy, '孔雀鱼群', 'school-preview'),
  writeRabbitPreview(),
]);
