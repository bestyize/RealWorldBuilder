import { TextureLoader } from 'three';

const STORAGE_KEY = 'arowana-v3-backgrounds';
const FRAME_ASPECT = 16 / 9;
const MAX_WIDTH = 2560;
const loader = new TextureLoader();

function loadBackground(background) {
  return background.imageUrl ? loader.loadAsync(background.imageUrl) : null;
}

export async function installBackgrounds(presets, apply, initialId) {
  const choices = document.querySelector('#background-choices');
  const overlayLink = document.querySelector('#background-overlay');
  const customChoice = document.querySelector('#background-custom');
  const fileInput = document.querySelector('#background-file');
  const browse = document.querySelector('#background-browse');
  const status = document.querySelector('#background-status');
  const saved = readSavedBackground();
  let current;
  let custom;
  let request = 0;

  const buttons = new Map();
  for (const preset of presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'background-choice';
    let preview;
    if (preset.thumbnail) {
      preview = new Image();
      preview.src = preset.thumbnail;
      preview.alt = '';
      preview.decoding = 'async';
    } else {
      preview = document.createElement('span');
      preview.className = 'transparent-swatch';
      preview.setAttribute('aria-hidden', 'true');
    }
    const name = document.createElement('span');
    name.className = 'background-choice-name';
    name.textContent = preset.label;
    button.append(preview, name);
    button.addEventListener('click', () => select(preset));
    choices.append(button);
    buttons.set(preset.id, button);
  }
  buttons.set('custom', customChoice);

  function showCustom(background) {
    custom = background;
    customChoice.querySelector('img').src = custom.imageUrl;
    const filename = customChoice.querySelector('.background-filename');
    filename.textContent = custom.name;
    customChoice.title = custom.name;
    customChoice.hidden = false;
    browse.textContent = '更换图片';
  }

  function updateSelection() {
    for (const [id, button] of buttons) {
      button.setAttribute('aria-pressed', String(id === current.id));
    }
    overlayLink.hidden = current.id !== 'transparent';
  }

  function showStatus(message = '', error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  async function select(background, file) {
    // Only the latest selection can replace the visible texture.
    const selectedRequest = ++request;
    showStatus(file ? '正在读取图片…' : '');
    if (background === current) return;

    try {
      const next = file ? await prepareCustomBackground(file) : background;
      if (selectedRequest !== request) return;
      const texture = await loadBackground(next);
      if (selectedRequest !== request) {
        texture?.dispose();
        return;
      }
      apply(texture, next);
      current = next;
    } catch {
      if (selectedRequest === request) {
        showStatus(file ? '无法读取这张图片，请换一张 JPG、PNG 或 WebP。' : '这张背景暂时无法打开。', true);
      }
      return;
    }

    if (file) showCustom(current);
    updateSelection();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected: current.id, custom }));
      showStatus();
    } catch {
      showStatus('本次已切换，浏览器未能保存背景设置。', true);
    }
  }

  customChoice.addEventListener('click', () => select(custom));
  browse.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) select(undefined, file);
  });

  if (typeof saved.custom?.name === 'string' && /^data:image\/(jpeg|webp);base64,/.test(saved.custom.imageUrl)) {
    showCustom({ id: 'custom', name: saved.custom.name, imageUrl: saved.custom.imageUrl, waterEffect: 0 });
  }
  const restored = saved.selected === 'custom' ? custom : presets.find(preset => preset.id === saved.selected);
  current = (initialId ? presets.find(preset => preset.id === initialId) : restored) ?? presets[0];
  let texture;
  try {
    texture = await loadBackground(current);
  } catch (error) {
    if (current === presets[0]) throw error;
    current = presets[0];
    texture = await loadBackground(current);
    showStatus('所选背景加载失败，已切换到山水客厅。', true);
  }
  apply(texture, current);
  updateSelection();
}

function readSavedBackground() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

async function prepareCustomBackground(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = Math.min(image.naturalWidth, image.naturalHeight * FRAME_ASPECT);
    const height = Math.min(image.naturalHeight, image.naturalWidth / FRAME_ASPECT);
    const scale = Math.min(1, MAX_WIDTH / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#091526';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image, (image.naturalWidth - width) / 2, (image.naturalHeight - height) / 2, width, height,
      0, 0, canvas.width, canvas.height,
    );
    const webp = canvas.toDataURL('image/webp', 0.92);
    const imageUrl = webp.startsWith('data:image/webp;') ? webp : canvas.toDataURL('image/jpeg', 0.92);
    return { id: 'custom', name: file.name, imageUrl, waterEffect: 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
