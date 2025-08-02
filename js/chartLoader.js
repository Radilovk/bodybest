let ChartLib;
export async function ensureChart() {
  if (!ChartLib) {
    if (typeof window === 'undefined'
        || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
      ChartLib = () => ({ destroy() {} });
    } else {
      const mod = await import('https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.js');
      ChartLib = mod.Chart || mod.default;
      if (typeof ChartLib !== 'function') throw new Error('Chart.js not loaded');
      console.debug('Chart.js loaded');
    }
  }
  return ChartLib;
}
