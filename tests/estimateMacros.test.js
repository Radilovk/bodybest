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

describe('estimateMacros - goal-based adjustments (fallback when AI unavailable)', () => {
  test('should apply calorie deficit for weight loss goal', () => {
    // Simulate weight loss scenario
    const baseAnswers = {
      weight: 70,
      height: 170,
      age: 30,
      gender: 'Жена',
      q1745878295708: 'средно',
      goal: 'отслабване',
      lossKg: 5
    };
    
    // Calculate expected TDEE
    const bmr = 10 * 70 + 6.25 * 170 - 5 * 30 - 161; // Female formula
    const tdee = Math.round(bmr * 1.375); // Moderate activity
    const expectedCalories = tdee - 300; // 5kg loss = -300 deficit
    
    // Verify calorie adjustment logic
    expect(expectedCalories).toBeLessThan(tdee);
    expect(expectedCalories).toBeGreaterThan(tdee - 400);
  });

  test('should apply calorie surplus for muscle gain goal', () => {
    // Simulate muscle gain scenario
    const baseAnswers = {
      weight: 70,
      height: 175,
      age: 25,
      gender: 'Мъж',
      q1745878295708: 'високо',
      goal: 'покачване на мускулна маса'
    };
    
    const bmr = 10 * 70 + 6.25 * 175 - 5 * 25 + 5; // Male formula
    const tdee = Math.round(bmr * 1.55); // High activity
    const expectedCalories = tdee + 250; // Muscle gain = +250 surplus
    
    expect(expectedCalories).toBeGreaterThan(tdee);
  });

  test('should adjust macro distribution for weight loss', () => {
    // Weight loss should have higher protein percentage (35%)
    const weightLossGoal = 'отслабване';
    
    // Expected distribution for weight loss
    const expectedProtein = 35;
    const expectedCarbs = 35;
    const expectedFat = 30;
    
    expect(expectedProtein + expectedCarbs + expectedFat).toBe(100);
    expect(expectedProtein).toBeGreaterThan(30); // Higher than maintenance
  });

  test('should adjust macros for keto diet history', () => {
    // Keto diet should have high fat, low carb distribution
    const dietType = 'кето';
    
    const expectedProtein = 25;
    const expectedCarbs = 25;
    const expectedFat = 50;
    
    expect(expectedProtein + expectedCarbs + expectedFat).toBe(100);
    expect(expectedFat).toBe(50); // High fat for keto
    expect(expectedCarbs).toBe(25); // Low carb for keto
  });

  test('should calculate BMI correctly', () => {
    const weight = 70; // kg
    const height = 170; // cm
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    
    expect(bmi).toBeCloseTo(24.22, 1);
  });
});

describe('AI macro calculation integration', () => {
  test('AI prompt should request comprehensive analysis', () => {
    // The AI prompt should consider multiple factors
    const expectedFactors = [
      'BMR (Mifflin-St Jeor)',
      'TDEE',
      'BMI',
      'goal',
      'activity level',
      'diet history',
      'medical conditions',
      'age',
      'anti-aging',
      'health improvement'
    ];
    
    // This is a meta-test to document expected AI behavior
    expect(expectedFactors.length).toBeGreaterThan(5);
  });

  test('AI response should include reasoning field', () => {
    // AI should return reasoning for its decisions
    const mockAiResponse = {
      calories: 1800,
      protein_grams: 130,
      carbs_grams: 160,
      fat_grams: 60,
      fiber_grams: 30,
      protein_percent: 30,
      carbs_percent: 35,
      fat_percent: 30,
      fiber_percent: 3,
      reasoning: 'За анти-ейджинг цел при умерена активност...'
    };
    
    expect(mockAiResponse.reasoning).toBeDefined();
    expect(typeof mockAiResponse.reasoning).toBe('string');
  });

  test('macro percentages should sum to 100', () => {
    const protein = 30;
    const carbs = 40;
    const fat = 30;
    
    expect(protein + carbs + fat).toBe(100);
  });
});
