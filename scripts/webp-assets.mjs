import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const WEBP_TEXTURE = 'EXT_texture_webp';
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const GLB_MAGIC = 0x46546c67;
const lossless = { lossless: true, exact: true, effort: 5 };
const photographic = quality => ({ quality, smartSubsample: true, effort: 5 });

export async function webpImage(path, { quality, width } = {}) {
  const bytes = await readFile(path);
  const options = quality === undefined ? lossless : photographic(quality);
  const image = sharp(bytes);
  if (width) image.resize({ width, withoutEnlargement: true });
  return image.webp(options).toBuffer();
}

export async function webpModel(path) {
  const bytes = await readFile(path);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== GLB_MAGIC || bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(16) !== JSON_CHUNK) {
    throw new Error(`${path}: expected a glTF 2.0 binary model`);
  }
  const jsonEnd = 20 + bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.toString('utf8', 20, jsonEnd));
  if (!model.images?.length) return bytes;
  const binStart = jsonEnd + 8;
  if (bytes.length < binStart || bytes.readUInt32LE(jsonEnd + 4) !== BIN_CHUNK) {
    throw new Error(`${path}: texture conversion requires a binary chunk`);
  }
  const bin = bytes.subarray(binStart, binStart + model.buffers[0].byteLength);
  const imageViews = new Set();
  const images = await Promise.all(model.images.map(async image => {
    const view = model.bufferViews[image.bufferView];
    if (!view || view.buffer !== 0 || imageViews.has(view)) {
      throw new Error(`${path}: images must have separate buffer views in the binary chunk`);
    }
    imageViews.add(view);
    const offset = view.byteOffset ?? 0;
    const original = bin.subarray(offset, offset + view.byteLength);
    const options = image.mimeType === 'image/jpeg' ? photographic(90) : lossless;
    const data = image.mimeType === 'image/webp'
      ? original
      : await sharp(original, { ignoreIcc: true }).webp(options).toBuffer();
    return { image, view, offset, data };
  }));
  images.sort((a, b) => a.offset - b.offset);

  // Copy the original binary ranges between images so mesh data and its compression stay intact.
  const parts = [];
  const replacements = [];
  let cursor = 0;
  let shift = 0;
  for (const { image, view, offset, data } of images) {
    const end = offset + view.byteLength;
    if (offset < cursor || end > bin.length) {
      throw new Error(`${path}: invalid image range in the binary chunk`);
    }
    // Preserve the original alignment of every range after the replacement.
    const padding = Buffer.alloc((view.byteLength % 4 - data.length % 4 + 4) % 4);
    parts.push(bin.subarray(cursor, offset), data, padding);
    cursor = end;
    view.byteOffset = offset + shift;
    shift += data.length + padding.length - view.byteLength;
    view.byteLength = data.length;
    image.mimeType = 'image/webp';
    replacements.push({ offset, end, shift });
  }
  parts.push(bin.subarray(cursor));

  function relocate(original) {
    let delta = 0;
    for (const { offset, end, shift } of replacements) {
      if (original < offset) break;
      if (original < end) throw new Error(`${path}: model data overlaps an image`);
      delta = shift;
    }
    return original + delta;
  }

  for (const view of model.bufferViews) {
    if (imageViews.has(view)) continue;
    if (view.buffer === 0) view.byteOffset = relocate(view.byteOffset ?? 0);
    const compressed = view.extensions?.EXT_meshopt_compression;
    if (compressed?.buffer === 0) compressed.byteOffset = relocate(compressed.byteOffset ?? 0);
  }

  for (const texture of model.textures) {
    if (texture.source === undefined) continue;
    texture.extensions ??= {};
    texture.extensions[WEBP_TEXTURE] ??= { source: texture.source };
    delete texture.source;
  }
  model.extensionsUsed = [...new Set([...(model.extensionsUsed ?? []), WEBP_TEXTURE])];
  model.extensionsRequired = [...new Set([...(model.extensionsRequired ?? []), WEBP_TEXTURE])];
  model.buffers[0].byteLength = bin.length + shift;
  return writeModel(model, parts, model.buffers[0].byteLength);
}

function writeModel(model, parts, binSize) {
  const json = Buffer.from(JSON.stringify(model));
  const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
  const jsonSize = json.length + jsonPadding.length;
  const binPadding = Buffer.alloc((4 - binSize % 4) % 4);
  const totalSize = 28 + jsonSize + binSize + binPadding.length;

  const header = Buffer.alloc(20);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalSize, 8);
  header.writeUInt32LE(jsonSize, 12);
  header.writeUInt32LE(JSON_CHUNK, 16);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binSize + binPadding.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);

  return Buffer.concat([header, json, jsonPadding, binHeader, ...parts, binPadding], totalSize);
}
