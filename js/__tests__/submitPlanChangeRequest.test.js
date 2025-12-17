import { jest } from '@jest/globals';

const basePlan = {
  caloriesMacros: {
    calories: 1800,
    protein_grams: 120,
    carbs_grams: 180,
    fat_grams: 60,
    fiber_grams: 30,
    plan: {
      calories: 1800,
      protein_grams: 120,
      carbs_grams: 180,
      fat_grams: 60,
      fiber_grams: 30
    }
  },
  profileSummary: 'summary',
  allowedForbiddenFoods: { main_allowed_foods: [], main_forbidden_foods: [] },
  hydrationCookingSupplements: { hydration_recommendations: {}, cooking_methods: {}, supplement_suggestions: [] },
  principlesWeek2_4: { generalGuidelines: '' },
  psychologicalGuidance: {},
  detailedTargets: {},
  additionalGuidelines: {},
  mealMacrosIndex: {},
  week1Menu: {}
};

describe('handleSubmitPlanChangeRequest', () => {
  let worker;
  let env;
  let callCount = 0;

  beforeEach(async () => {
    jest.resetModules();
    callCount = 0;
    worker = await import('../../worker.js');
    
    // Mock AI calls: first for decision, second for changes
    worker.setCallModelImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Decision phase - return PARTIAL_MODIFICATION
        return '{"decision":"PARTIAL_MODIFICATION","reasoning":"Simple change","affectedSections":["caloriesMacros"]}';
      } else {
        // Change generation phase
        return '{"caloriesMacros":{"plan":{"calories":2200}}}';
      }
    });

    env = {
      USER_METADATA_KV: {
        get: jest.fn((key) => {
          if (key.endsWith('_final_plan')) return Promise.resolve(JSON.stringify(basePlan));
          if (key.endsWith('_initial_answers')) return Promise.resolve(JSON.stringify({ height: 170, weight: 80 }));
          if (key.endsWith('_current_status')) return Promise.resolve('{}');
          return Promise.resolve(null);
        }),
        put: jest.fn().mockResolvedValue(undefined)
      },
      RESOURCES_KV: {
        get: jest.fn().mockResolvedValue('model-plan')
      }
    };
  });

  afterEach(() => {
    worker.setCallModelImplementation(null);
  });

  test('applies plan change when request is valid', async () => {
    const res = await worker.handleSubmitPlanChangeRequest(
      { json: async () => ({ userId: 'u1', requestText: 'повече протеин' }) },
      env
    );

    expect(res.success).toBe(true);
    expect(res.modificationType).toBe('PARTIAL_MODIFICATION');
    const finalPlanPut = env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === 'u1_final_plan');
    expect(finalPlanPut).toBeTruthy();
    const savedPlan = JSON.parse(finalPlanPut[1]);
    expect(savedPlan.caloriesMacros.plan.calories).toBe(2200);
  });

  test('rejects unsafe caloric increase for high BMI', async () => {
    callCount = 0;
    env.USER_METADATA_KV.get.mockImplementation((key) => {
      if (key.endsWith('_final_plan')) return Promise.resolve(JSON.stringify(basePlan));
      if (key.endsWith('_initial_answers')) return Promise.resolve(JSON.stringify({ height: 160, weight: 120 }));
      if (key.endsWith('_current_status')) return Promise.resolve('{}');
      return Promise.resolve(null);
    });

    const res = await worker.handleSubmitPlanChangeRequest(
      { json: async () => ({ userId: 'u1', requestText: 'повече калории' }) },
      env
    );

    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(409);
    const savedPlanCall = env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === 'u1_final_plan');
    expect(savedPlanCall).toBeUndefined();
  });
  
  test('returns error when AI recommends full regeneration', async () => {
    callCount = 0;
    worker.setCallModelImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Decision phase - return FULL_REGENERATION
        return '{"decision":"FULL_REGENERATION","reasoning":"Fundamental change needed"}';
      }
      return '{}';
    });

    const res = await worker.handleSubmitPlanChangeRequest(
      { json: async () => ({ userId: 'u1', requestText: 'искам напълно различен план' }) },
      env
    );

    expect(res.success).toBe(false);
    expect(res.requiresFullRegeneration).toBe(true);
    expect(res.reasoning).toBe('Fundamental change needed');
    const savedPlanCall = env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === 'u1_final_plan');
    expect(savedPlanCall).toBeUndefined();
  });
});
