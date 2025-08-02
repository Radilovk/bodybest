let ChartLib;

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
