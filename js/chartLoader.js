let ChartLib;
export async function ensureChart() {
  if (!ChartLib) {
    if (typeof window === 'undefined'
        || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
      ChartLib = () => ({ destroy() {} });
    } else {
      try {
        const module = await import('https://cdn.jsdelivr.net/npm/chart.js/auto/auto.js');
        ChartLib = module.default || module.Chart;
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
  return ChartLib;
}
