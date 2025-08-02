let ChartLib;
export async function ensureChart() {
  if (!ChartLib) {
    if (typeof window === 'undefined'
        || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
      ChartLib = () => ({ destroy() {} });
    } else {
      ChartLib = (await import('https://cdn.jsdelivr.net/npm/chart.js')).default;
      console.debug('Chart.js loaded');
    }
  }
  return ChartLib;
}
