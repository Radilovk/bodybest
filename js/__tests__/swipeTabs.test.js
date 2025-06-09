import { computeSwipeTargetIndex } from '../swipeUtils.js';

describe('computeSwipeTargetIndex', () => {
  test('swipe left moves to next tab', () => {
    const idx = computeSwipeTargetIndex(0, -60, 50, 3);
    expect(idx).toBe(1);
  });

  test('swipe right moves to previous tab', () => {
    const idx = computeSwipeTargetIndex(1, 70, 50, 3);
    expect(idx).toBe(0);
  });

  test('small move keeps same tab', () => {
    const idx = computeSwipeTargetIndex(2, 10, 50, 3);
    expect(idx).toBe(2);
  });
});
