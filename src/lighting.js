import { Color, DirectionalLight, MathUtils, Spherical } from 'three';

const STORAGE_KEY = 'arowana-v3-lighting';
const MAIN_POWER = 1.87;
const FILL_POWER = 0.64;
const RIM_POWER = 1.18;
const ENVIRONMENT_POWER = 0.85;

const formatValue = {
  azimuth: value => value === 0 ? '正前' : `${value < 0 ? '左' : '右'} ${Math.abs(value)}°`,
  elevation: value => `${value}°`,
  warmth: value => value === 0 ? '原色' : `${value < 0 ? '冷' : '暖'} ${Math.abs(value)}`,
};

export function installLighting(scene, redraw) {
  const panel = document.querySelector('#lighting-section');
  const reset = document.querySelector('#lighting-reset');
  const fields = [...panel.querySelectorAll('.light-field')].map(field => ({
    input: field.querySelector('input'),
    output: field.querySelector('output'),
  }));

  const key = new DirectionalLight(0xf5f9ff, MAIN_POWER);
  key.position.set(-2.2, 4.8, 3.6);
  const originalAim = new Spherical().setFromVector3(key.position);
  const originalColor = key.color.clone();
  const coolColor = new Color(0x9dc5ff);
  const warmColor = new Color(0xffc18c);

  const rim = new DirectionalLight(0xd5e6ff, RIM_POWER);
  rim.position.set(2.1, 3.5, -4.3);
  const fill = new DirectionalLight(0xe9f6ff, FILL_POWER);
  fill.position.set(2.0, -0.85, 4.7);
  scene.add(key, rim, fill);

  const readValues = () => Object.fromEntries(fields.map(({ input }) => [input.name, input.valueAsNumber]));
  const defaults = readValues();

  function apply() {
    const values = readValues();
    key.intensity = MAIN_POWER * values.main / 100;
    fill.intensity = FILL_POWER * values.fill / 100;
    rim.intensity = RIM_POWER * values.rim / 100;
    scene.environmentIntensity = ENVIRONMENT_POWER * values.environment / 100;
    // Offsets from the rounded labels preserve V3's exact starting angle.
    key.position.setFromSphericalCoords(
      originalAim.radius,
      originalAim.phi - MathUtils.degToRad(values.elevation - defaults.elevation),
      originalAim.theta + MathUtils.degToRad(values.azimuth - defaults.azimuth),
    );
    const tint = values.warmth < 0 ? coolColor : warmColor;
    key.color.copy(originalColor).lerp(tint, Math.abs(values.warmth) / 100);

    for (const { input, output } of fields) {
      const value = values[input.name];
      const label = formatValue[input.name]?.(value) ?? `${value}%`;
      const filled = 100 * (value - Number(input.min)) / (Number(input.max) - Number(input.min));
      input.setAttribute('aria-valuetext', label);
      input.style.setProperty('--filled', `${filled}%`);
      output.value = label;
    }
    redraw();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readValues()));
    } catch {
      // Local files can run in viewers that disallow browser storage.
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    for (const { input } of fields) {
      if (Number.isFinite(saved?.[input.name])) input.valueAsNumber = saved[input.name];
    }
  } catch {
    // A fresh page can always use the default light.
  }

  panel.addEventListener('input', apply);
  panel.addEventListener('change', save);
  reset.addEventListener('click', () => {
    for (const { input } of fields) input.value = input.defaultValue;
    apply();
    save();
  });
  apply();
}
