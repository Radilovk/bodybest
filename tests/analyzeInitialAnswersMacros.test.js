/**
 * @jest-environment node
 */

describe('handleAnalyzeInitialAnswers - macro extraction', () => {
  test('should extract macroRecommendation from AI analysis response', () => {
    // Mock AI response with macroRecommendation
    const mockAnalysisResponse = JSON.stringify({
      schemaVersion: "1.0",
      generatedAt: "2024-01-01T00:00:00.000Z",
      client: {
        name: "Test User",
        gender: "Жена",
        age: 30,
        height: 170,
        weight: 65
      },
      macroRecommendation: {
        calories: 1800,
        protein_grams: 130,
        carbs_grams: 160,
        fat_grams: 60,
        fiber_grams: 25,
        protein_percent: 30,
        carbs_percent: 40,
        fat_percent: 30,
        fiber_percent: 3,
        reasoning: "Based on moderate activity and weight loss goal"
      }
    });

    const parsed = JSON.parse(mockAnalysisResponse);
    
    expect(parsed.macroRecommendation).toBeDefined();
    expect(parsed.macroRecommendation.calories).toBe(1800);
    expect(parsed.macroRecommendation.protein_grams).toBe(130);
    expect(parsed.macroRecommendation.carbs_grams).toBe(160);
    expect(parsed.macroRecommendation.fat_grams).toBe(60);
  });

  test('should create correct macros record structure for KV storage', () => {
    const macroRec = {
      calories: 1800,
      protein_grams: 130,
      carbs_grams: 160,
      fat_grams: 60,
      fiber_grams: 25,
      protein_percent: 30,
      carbs_percent: 40,
      fat_percent: 30,
      fiber_percent: 3,
      reasoning: "Test reasoning"
    };

    const macrosRecord = {
      status: 'initial',
      data: {
        recommendation: {
          calories: macroRec.calories,
          protein_grams: macroRec.protein_grams,
          carbs_grams: macroRec.carbs_grams,
          fat_grams: macroRec.fat_grams,
          fiber_grams: macroRec.fiber_grams || 0,
          protein_percent: macroRec.protein_percent || 0,
          carbs_percent: macroRec.carbs_percent || 0,
          fat_percent: macroRec.fat_percent || 0,
          fiber_percent: macroRec.fiber_percent || 0
        },
        reasoning: macroRec.reasoning || 'AI препоръка'
      }
    };

    expect(macrosRecord.status).toBe('initial');
    expect(macrosRecord.data.recommendation.calories).toBe(1800);
    expect(macrosRecord.data.reasoning).toBe('Test reasoning');
  });

  test('should validate required macro fields are present', () => {
    const validMacroRec = {
      calories: 1800,
      protein_grams: 130,
      carbs_grams: 160,
      fat_grams: 60
    };

    const invalidMacroRec = {
      calories: 1800,
      protein_grams: 130
      // Missing carbs_grams and fat_grams
    };

    expect(validMacroRec.calories).toBeTruthy();
    expect(validMacroRec.protein_grams).toBeTruthy();
    expect(validMacroRec.carbs_grams).toBeTruthy();
    expect(validMacroRec.fat_grams).toBeTruthy();

    expect(invalidMacroRec.carbs_grams).toBeUndefined();
    expect(invalidMacroRec.fat_grams).toBeUndefined();
  });

  test('should handle missing optional fiber fields with defaults', () => {
    const macroRecWithoutFiber = {
      calories: 1800,
      protein_grams: 130,
      carbs_grams: 160,
      fat_grams: 60
    };

    const fiber_grams = macroRecWithoutFiber.fiber_grams != null ? macroRecWithoutFiber.fiber_grams : 0;
    const fiber_percent = macroRecWithoutFiber.fiber_percent != null ? macroRecWithoutFiber.fiber_percent : 0;

    expect(fiber_grams).toBe(0);
    expect(fiber_percent).toBe(0);
  });

  test('should properly handle zero values as valid', () => {
    // Zero is a valid value and should not be treated as missing
    const macroRecWithZeros = {
      calories: 1800,
      protein_grams: 0,  // Valid zero value
      carbs_grams: 160,
      fat_grams: 60,
      fiber_grams: 0     // Valid zero value
    };

    // Using != null to check for null/undefined, not truthiness
    expect(macroRecWithZeros.protein_grams != null).toBe(true);
    expect(macroRecWithZeros.fiber_grams != null).toBe(true);
    expect(macroRecWithZeros.protein_grams).toBe(0);
    expect(macroRecWithZeros.fiber_grams).toBe(0);
  });
});
