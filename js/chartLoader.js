import { hexToRgb } from './utils.js';

let ChartLib;
let subtleGlowRegistered = false;
const GLOW_OFFSET = 10;

export const subtleGlowPlugin = {
  id: 'subtleGlow',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.getSortedVisibleDatasetMetas().forEach((meta) => {
      const dataset = chart.data.datasets[meta.index];
      ctx.save();
      meta.data.forEach((element, i) => {
        const bg = Array.isArray(dataset.backgroundColor)
          ? dataset.backgroundColor[i]
          : dataset.backgroundColor;
        ctx.shadowColor = bg;
        ctx.shadowBlur = 12;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(element.x, element.y, element.outerRadius, element.startAngle, element.endAngle);
        ctx.arc(
          element.x,
          element.y,
          element.innerRadius,
          element.endAngle,
          element.startAngle,
          true
        );
        ctx.closePath();
        ctx.fill();

        const gradient = ctx.createRadialGradient(
          element.x,
          element.y,
          0,
          element.x,
          element.y,
          element.outerRadius + GLOW_OFFSET
        );
        const innerStop = element.outerRadius / (element.outerRadius + GLOW_OFFSET);
        gradient.addColorStop(0, bg);
        gradient.addColorStop(innerStop, bg);
        const rgb = hexToRgb(bg);
        const outer = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)` : bg;
        gradient.addColorStop(1, outer);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = GLOW_OFFSET;
        ctx.beginPath();
        ctx.arc(element.x, element.y, element.outerRadius, element.startAngle, element.endAngle);
        ctx.stroke();
      });
      ctx.restore();
    });
  }
};

/**
 * Осигурява зареждане на Chart.js от UMD сборка, за да се избегне
 * липсващата зависимост `@kurkle/color` при ESM модулите.
 */
export async function ensureChart() {
  if (!ChartLib) {
    if (typeof window === 'undefined'
        || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
      ChartLib = () => ({ destroy() {} });
    } else {
      if (window.Chart) {
        ChartLib = window.Chart;
      } else {
        if (!window._chartPromise) {
          window._chartPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
            script.onload = () => resolve(window.Chart);
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        try {
          ChartLib = await window._chartPromise;
          if (!ChartLib) throw new Error('Chart.js failed to load');
          console.debug('Chart.js loaded');
        } catch (e) {
          console.warn('Failed to load Chart.js', e);
          if (typeof document !== 'undefined') {
            const warning = document.createElement('div');
            warning.className = 'alert alert-warning';
            warning.setAttribute('role', 'alert');
            warning.textContent = 'Chart.js не може да се зареди.';
            document.body.prepend(warning);
          }
          ChartLib = () => ({ destroy() {} });
        }
      }
    }
  }
  return ChartLib;
}

/**
 * Регистрира subtleGlow plug-in само веднъж.
 * @param {any} Chart - инстанция на Chart.js (UMD).
 * @returns {boolean} дали регистрацията е успешна.
 */
export function registerSubtleGlow(Chart) {
  if (subtleGlowRegistered) return true;
  if (!Chart || typeof Chart.register !== 'function') {
    console.warn('Chart.register липсва; пропускане на plug-in subtleGlow.');
    return false;
  }
  try {
    if (!Chart.registry?.getPlugin('subtleGlow')) {
      Chart.register(subtleGlowPlugin);
    }
    subtleGlowRegistered = true;
    return true;
  } catch (e) {
    console.warn('Регистрацията на plug-in subtleGlow се провали.', e);
    return false;
  }
}
