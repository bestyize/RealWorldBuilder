export function installFullscreen(button, onChange) {
  const page = document.documentElement;
  const label = button.querySelector('[data-fullscreen-label]');
  let windowed = false;
  let requesting = false;

  function update() {
    const active = windowed || document.fullscreenElement === page;
    page.toggleAttribute('data-fullscreen', active);
    const title = active ? '退出全屏' : '全屏';
    button.setAttribute('aria-label', title);
    button.title = title + '（F）';
    if (label) label.textContent = title;
    onChange?.(active);
  }

  async function toggle() {
    if (requesting) return;
    if (windowed) {
      windowed = false;
      update();
      return;
    }
    if (document.fullscreenElement === page) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (document.fullscreenEnabled && page.requestFullscreen) {
      requesting = true;
      try {
        await page.requestFullscreen({ navigationUI: 'hide' });
        return;
      } catch {
        // The browser can deny fullscreen even if the API is available.
      } finally {
        requesting = false;
      }
    }
    windowed = true;
    update();
  }

  document.addEventListener('fullscreenchange', update);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && windowed) {
      windowed = false;
      update();
    } else if (event.code === 'KeyF' && document.body.dataset.presentation !== 'true' &&
      !event.target.closest?.('input, textarea, select, [contenteditable]')) {
      event.preventDefault();
      toggle();
    }
  });
  button.addEventListener('click', toggle);
  button.hidden = false;
}
