const STORAGE_KEY = 'rwb-aquarium-display';

export function installDisplay(applyDisplay, initialDisplay) {
  const panel = document.querySelector('#display-section');
  const choices = Array.from(panel.querySelectorAll('input[name="fish-display"]'));
  const aquascape = panel.querySelector('#display-aquascape');
  try {
    const saved = initialDisplay ?? JSON.parse(localStorage.getItem(STORAGE_KEY));
    const choice = choices.find(input => input.value === saved?.fish);
    if (choice) choice.checked = true;
    aquascape.checked = saved?.aquascape === true;
  } catch {
    // Use the default selection when browser storage is unavailable.
  }

  function read() {
    return { fish: choices.find(input => input.checked).value, aquascape: aquascape.checked };
  }

  panel.addEventListener('change', () => {
    const selection = read();
    applyDisplay(selection);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // Changing the display still works without storage.
    }
  });
  applyDisplay(read());
}
