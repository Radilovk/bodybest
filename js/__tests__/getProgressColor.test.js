import { getProgressColor } from '../utils.js';

describe('getProgressColor', () => {
  test.each([
    [0, 'rgb(231, 76, 60)'],
    [50, 'rgb(243, 156, 18)'],
    [75, 'rgb(255, 203, 0)'],
    [100, 'rgb(46, 204, 113)'],
    [25, 'rgb(237, 116, 39)']
  ])('returns color for %i%%', (pct, expected) => {
    expect(getProgressColor(pct)).toBe(expected);
  });
});
