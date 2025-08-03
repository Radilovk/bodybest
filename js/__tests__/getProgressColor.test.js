import { getProgressColor } from '../utils.js';

describe('getProgressColor', () => {
  test.each([
    [0, 'var(--rating-1)'],
    [25, 'var(--rating-2)'],
    [50, 'var(--rating-3)'],
    [75, 'var(--rating-4)'],
    [100, 'var(--rating-5)']
  ])('returns color for %i%%', (pct, expected) => {
    expect(getProgressColor(pct)).toBe(expected);
  });
});
