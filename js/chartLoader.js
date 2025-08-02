let ChartLib;
export async function ensureChart() {
  if (!ChartLib) {
    if (typeof window === 'undefined'
        || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
      ChartLib = () => ({ destroy() {} });
    } else {
      const module = await import('https://cdn.jsdelivr.net/npm/chart.js/auto');
      ChartLib = module.default || module.Chart;
      if (!ChartLib) throw new Error('Chart.js failed to load');
      console.debug('Chart.js loaded');
    }
  }
  return ChartLib;
}
