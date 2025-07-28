// personalization.js - Настройки на основни цветове за потребителя
import { colorGroups } from './themeConfig.js';
import { loadAndApplyColors } from './uiHandlers.js';

const inputs = {};
const hueSliders = {};
const lightSliders = {};

function getMainColors() {
  const group = colorGroups.find(g => g.name === 'Основни цветове');
  return group ? group.items.map(it => it.var) : ['primary-color','secondary-color','accent-color','tertiary-color'];
}

function getCurrentColor(key) {
  const bodyVal = getComputedStyle(document.body).getPropertyValue(`--${key}`).trim();
  if (bodyVal) return bodyVal;
  return getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
}

function hexToHsl(hex) {
  let h,r,g,b;
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  r = parseInt(hex.slice(0,2),16)/255;
  g = parseInt(hex.slice(2,4),16)/255;
  b = parseInt(hex.slice(4,6),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let l = (max+min)/2; let s = 0; h = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h = (g-b)/d + (g < b ? 6 : 0); break;
      case g: h = (b-r)/d + 2; break;
      default: h = (r-g)/d + 4;
    }
    h *= 60;
  }
  return { h, s: s*100, l: l*100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const C = (1 - Math.abs(2*l-1))*s;
  const X = C * (1 - Math.abs((h/60)%2 -1));
  const m = l - C/2;
  let r=0,g=0,b=0;
  if (0<=h && h<60){ r=C; g=X; }
  else if (60<=h && h<120){ r=X; g=C; }
  else if (120<=h && h<180){ g=C; b=X; }
  else if (180<=h && h<240){ g=X; b=C; }
  else if (240<=h && h<300){ r=X; b=C; }
  else if (300<=h && h<360){ r=C; b=X; }
  r = Math.round((r+m)*255);
  g = Math.round((g+m)*255);
  b = Math.round((b+m)*255);
  const toHex = n => n.toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applyAndStore() {
  const theme = {};
  getMainColors().forEach(key => {
    const base = inputs[key].value;
    const hue = parseInt(hueSliders[key].value, 10);
    const light = parseInt(lightSliders[key].value, 10);
    const { h,s,l } = hexToHsl(base);
    const newH = (h + hue + 360) % 360;
    const newL = Math.min(100, Math.max(0, l + light));
    const hex = hslToHex(newH, s, newL);
    document.documentElement.style.setProperty(`--${key}`, hex);
    document.body.style.setProperty(`--${key}`, hex);
    theme[key] = hex;
  });
  const all = JSON.parse(localStorage.getItem('colorThemes') || '{}');
  all.Custom = theme;
  localStorage.setItem('colorThemes', JSON.stringify(all));
}

function populate() {
  const themes = JSON.parse(localStorage.getItem('colorThemes') || '{}');
  const custom = themes.Custom || {};
  getMainColors().forEach(key => {
    const color = custom[key] || getCurrentColor(key);
    inputs[key].value = color;
    hueSliders[key].value = 0;
    lightSliders[key].value = 0;
  });
  applyAndStore();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAndApplyColors();
  const container = document.getElementById('colorControls');
  if (!container) return;
  getMainColors().forEach(key => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = key;
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    const hue = document.createElement('input');
    hue.type = 'range';
    hue.min = -180; hue.max = 180; hue.value = 0;
    const light = document.createElement('input');
    light.type = 'range';
    light.min = -50; light.max = 50; light.value = 0;
    wrapper.appendChild(label);
    wrapper.appendChild(colorInput);
    wrapper.appendChild(hue);
    wrapper.appendChild(light);
    container.appendChild(wrapper);
    inputs[key] = colorInput;
    hueSliders[key] = hue;
    lightSliders[key] = light;
    colorInput.addEventListener('input', applyAndStore);
    hue.addEventListener('input', applyAndStore);
    light.addEventListener('input', applyAndStore);
  });
  populate();
});
