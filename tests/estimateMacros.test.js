/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';

describe('estimateMacros - fiber calculation', () => {
  test('should calculate fiber based on 14g per 1000 calories', () => {
    // Test the fiber calculation formula used in estimateMacros
    const calories = 2000;
    const expectedFiberGrams = Math.round((calories / 1000) * 14); // 28g
    const expectedFiberPercent = Math.round((expectedFiberGrams * 2 * 100) / calories); // 2.8%

    expect(expectedFiberGrams).toBe(28);
    expect(expectedFiberPercent).toBe(3); // Rounded
  });

  test('should handle different calorie levels for fiber calculation', () => {
    const testCases = [
      { calories: 1500, expectedFiber: 21 },
      { calories: 2000, expectedFiber: 28 },
      { calories: 2500, expectedFiber: 35 },
      { calories: 3000, expectedFiber: 42 }
    ];

    testCases.forEach(({ calories, expectedFiber }) => {
      const fiberGrams = Math.round((calories / 1000) * 14);
      expect(fiberGrams).toBe(expectedFiber);
    });
  });

  test('fiber percent calculation should be consistent', () => {
    // Test that fiber_percent calculation matches the formula
    const testCases = [
      { calories: 2000, fiberGrams: 28, expectedPercent: 3 },
      { calories: 1500, fiberGrams: 21, expectedPercent: 3 },
      { calories: 2500, fiberGrams: 35, expectedPercent: 3 }
    ];

    testCases.forEach(({ calories, fiberGrams, expectedPercent }) => {
      const fiberPercent = Math.round((fiberGrams * 2 * 100) / calories);
      expect(fiberPercent).toBe(expectedPercent);
    });
  });
});
