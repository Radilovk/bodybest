import { getProgressColor } from '../utils.js';

describe('getProgressColor', () => {
  test.each([
    [0, 'rgba(255, 46, 46, 0.25)'],
    [50, 'rgba(247, 227, 0, 0.45)'],
    [75, 'rgba(197, 230, 17, 0.55)'],
    [100, 'rgba(46, 204, 113, 0.65)'],
    [25, 'rgba(255, 165, 0, 0.35)']
  ])('returns color for %i%%', (pct, expected) => {
    expect(getProgressColor(pct)).toBe(expected);
  });
});
