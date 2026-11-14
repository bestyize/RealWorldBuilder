const STORAGE_KEY = 'rwb-aquarium-display';

export async function installDisplay(prepareDisplay, applyDisplay, initialDisplay) {
  const panel = document.querySelector('#display-section');
  const choices = Array.from(panel.querySelectorAll('input[name="fish-display"]'));
  const aquascape = panel.querySelector('#display-aquascape');
  const status = panel.querySelector('#display-status');
  let selection = { fish: 'mixed', aquascape: false };
  let request = 0;
  try {
    const saved = initialDisplay ?? JSON.parse(localStorage.getItem(STORAGE_KEY));
    const choice = choices.find(input => input.value === saved?.fish);
    selection = { fish: choice?.value ?? selection.fish, aquascape: saved?.aquascape === true };
  } catch {
    // Use the default selection when browser storage is unavailable.
  }

  function check({ fish, aquascape: showAquascape }) {
    choices.find(input => input.value === fish).checked = true;
    aquascape.checked = showAquascape;
  }

  function showStatus(message = '', error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  panel.addEventListener('change', async () => {
    const pending = { fish: choices.find(input => input.checked).value, aquascape: aquascape.checked };
    const requested = ++request;
    showStatus('正在加载展示…');
    try {
      const { residents } = await prepareDisplay(pending);
      if (requested !== request) return;
      applyDisplay(pending, residents);
    } catch {
      if (requested !== request) return;
      check(selection);
      showStatus('展示加载失败。请再次选择重试。', true);
      return;
    }
    selection = pending;
    showStatus();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // Changing the display still works without storage.
    }
  });

  const { residents, hasAquascape } = await prepareDisplay(selection, { optionalAquascape: true });
  if (selection.aquascape && !hasAquascape) {
    selection.aquascape = false;
    showStatus('砂石水草加载失败。可以再次开启重试。', true);
  }
  check(selection);
  applyDisplay(selection, residents);
}
