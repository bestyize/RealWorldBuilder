const STORAGE_KEY = 'rwb-aquarium-display';

export function installDisplay(applyDisplay, initialDisplay) {
  const panel = document.querySelector('#display-section');
  const choices = Array.from(panel.querySelectorAll('input[name="fish-display"]'));
  const arowanaField = panel.querySelector('#display-arowana');
  const species = Array.from(arowanaField.querySelectorAll('input[name="arowana-species"]'));
  const aquascape = panel.querySelector('#display-aquascape');
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Use the default selection when browser storage is unavailable.
  }
  const restored = { ...saved, ...initialDisplay };
  const choice = choices.find(input => input.value === restored.fish);
  const dragon = species.find(input => input.value === restored.arowanaSpecies);
  if (choice) choice.checked = true;
  if (dragon) dragon.checked = true;
  aquascape.checked = restored.aquascape === true;

  function update() {
    const fish = choices.find(input => input.checked).value;
    arowanaField.hidden = fish !== 'mixed' && fish !== 'arowana';
    const selection = {
      fish,
      arowanaSpecies: species.find(input => input.checked).value,
      aquascape: aquascape.checked,
    };
    applyDisplay(selection);
    return selection;
  }

  panel.addEventListener('change', () => {
    const selection = update();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // Changing the display still works without storage.
    }
  });
  update();
}
