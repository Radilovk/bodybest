let ChartLib;
export async function ensureChart() {
  if (!ChartLib) {
    if (
      typeof window === 'undefined' ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
    ) {
      class DummyChart { destroy() {} }
      ChartLib = DummyChart;
    } else {
      const mod = await import('https://cdn.jsdelivr.net/npm/chart.js/auto');
      ChartLib = mod.default || mod.Chart;
      console.debug('Chart.js loaded');
    }
  }
  return ChartLib;
}
