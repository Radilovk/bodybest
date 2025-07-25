import { loadConfig, saveConfig } from './adminConfig.js';

const inputSelectors = {
  primary: '#primaryColorInput',
  secondary: '#secondaryColorInput',
  accent: '#accentColorInput',
  tertiary: '#tertiaryColorInput'
};

const inputs = {};

function setCssVar(key, val) {
  document.documentElement.style.setProperty(`--${key}-color`, val);
}

export async function initColorSettings() {
  for (const [key, sel] of Object.entries(inputSelectors)) {
    inputs[key] = document.querySelector(sel);
  }
  const saveBtn = document.getElementById('saveColorConfig');
  if (!saveBtn) return;
  try {
    const { colors = {} } = await loadConfig(['colors']);
    Object.entries(inputs).forEach(([k, el]) => {
      if (!el) return;
      if (colors[k]) {
        el.value = colors[k];
        setCssVar(k, colors[k]);
      }
      el.addEventListener('input', () => setCssVar(k, el.value));
    });
  } catch (err) {
    console.warn('Неуспешно зареждане на цветовете', err);
  }

  saveBtn.addEventListener('click', async () => {
    const colors = {};
    Object.entries(inputs).forEach(([k, el]) => {
      if (el) colors[k] = el.value;
    });
    try {
      await saveConfig({ colors });
      alert('Цветовете са записани.');
    } catch (err) {
      console.error('Грешка при запис на цветовете', err);
      alert('Грешка при запис на цветовете.');
    }
  });
}

document.addEventListener('DOMContentLoaded', initColorSettings);
