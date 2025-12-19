import { jest } from '@jest/globals';

jest.unstable_mockModule('../uiElements.js', () => ({
  trackerInfoTexts: {
    health_tone: { levels: { 1: 'Много лошо', 2: 'По-слабо', 3: 'Средно', 4: 'Добро', 5: 'Отлично' } },
    activity: { levels: { 1: 'Изобщо не', 2: 'Минимална', 3: 'Средна', 4: 'Активен', 5: 'Много активен' } },
    stress: { levels: { 1: 'Без стрес', 2: 'Леко напрежение', 3: 'Умерен', 4: 'Висок', 5: 'Много висок' } }
  }
}));

describe('getMetricDescription', () => {
  test('връща описание за даден показател', async () => {
    const { getMetricDescription } = await import('../metricUtils.js');
    expect(getMetricDescription('health_tone', 4)).toBe('Добро');
  });

  test('връща fallback при липсващо описание', async () => {
    const { getMetricDescription } = await import('../metricUtils.js');
    expect(getMetricDescription('health_tone', 99)).toBe('Оценка 99 от 5');
  });
  
  test('връща описание за активност', async () => {
    const { getMetricDescription } = await import('../metricUtils.js');
    expect(getMetricDescription('activity', 3)).toBe('Средна');
  });
  
  test('връща описание за стрес', async () => {
    const { getMetricDescription } = await import('../metricUtils.js');
    expect(getMetricDescription('stress', 5)).toBe('Много висок');
  });
});
