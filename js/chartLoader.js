let ChartLib;

export async function ensureChart() {
  if (ChartLib) return ChartLib;

  if (
    typeof window === 'undefined' ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
  ) {
    throw new Error('Chart.js не е наличен в текущата среда');
  }

  try {
    ChartLib = (await import('https://cdn.jsdelivr.net/npm/chart.js')).default;
    console.debug('Chart.js loaded');
    return ChartLib;
  } catch (err) {
    console.error('Неуспешно зареждане на Chart.js', err);
    throw new Error('Неуспешно зареждане на Chart.js');
  }
}

