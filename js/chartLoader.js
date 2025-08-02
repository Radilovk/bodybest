let ChartLib;
export async function ensureChart() {
  if (!ChartLib) {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
      ChartLib = () => ({ destroy() {} });
    } else {
      ChartLib = (await import('https://cdn.jsdelivr.net/npm/chart.js')).default;
    }
  }
  return ChartLib;
}
