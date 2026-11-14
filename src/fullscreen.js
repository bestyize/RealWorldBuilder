export function installFullscreen(button, { landscape = false, onChange } = {}) {
  const page = document.documentElement;
  const label = button.querySelector('[data-fullscreen-label]');
  const touchScreen = matchMedia('(pointer: coarse)');
  const screenOrientation = screen.orientation;
  let windowed = false;
  let requesting = false;
  let orientationLock;

  function update() {
    const native = document.fullscreenElement === page;
    const active = windowed || native;
    page.toggleAttribute('data-fullscreen', active);
    page.toggleAttribute('data-landscape-fullscreen', active && landscape && touchScreen.matches);
    const title = active ? '退出全屏' : '全屏';
    button.setAttribute('aria-label', title);
    button.title = title + '（F）';
    if (label) label.textContent = title;
    onChange?.(active);
  }

  function releaseOrientation() {
    if (!orientationLock) return;
    orientationLock.cancelled = true;
    if (orientationLock.locked) {
      screenOrientation.unlock?.();
      orientationLock = undefined;
    }
  }

  function lockLandscape() {
    if (!landscape || !touchScreen.matches || !screenOrientation?.lock || orientationLock) return;
    const attempt = { cancelled: false, locked: false };
    orientationLock = attempt;
    screenOrientation.lock('landscape').then(() => {
      attempt.locked = true;
      if (attempt.cancelled) releaseOrientation();
    }, () => {
      orientationLock = undefined;
    });
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
        if (document.fullscreenElement === page) lockLandscape();
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

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement !== page) releaseOrientation();
    update();
  });
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
