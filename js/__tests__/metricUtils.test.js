import { jest } from '@jest/globals';

jest.unstable_mockModule('../uiElements.js', () => ({
  trackerInfoTexts: {
    energy: { levels: { 1: 'Много ниска', 2: 'Ниска', 3: 'Средна', 4: 'Висока', 5: 'Много висока' } }
  }
}));

describe('getMetricDescription', () => {
  test('връща описание за даден показател', async () => {
    const { getMetricDescription } = await import('../metricUtils.js');
    expect(getMetricDescription('energy', 4)).toBe('Висока');
  });

  test('връща fallback при липсващо описание', async () => {
    const { getMetricDescription } = await import('../metricUtils.js');
    expect(getMetricDescription('energy', 99)).toBe('Оценка 99 от 5');
  });
});
