let ChartLib;
let subtleGlowRegistered = false;

export const GLOW_OFFSET = 6;

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
        ctx.shadowBlur = 4;
        ctx.lineWidth = GLOW_OFFSET;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(
          element.x,
          element.y,
          element.outerRadius + GLOW_OFFSET,
          element.startAngle,
          element.endAngle
        );
        ctx.arc(
          element.x,
          element.y,
          element.innerRadius + 1,
          element.endAngle,
          element.startAngle,
          true
        );
        ctx.closePath();
        ctx.fill();
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
