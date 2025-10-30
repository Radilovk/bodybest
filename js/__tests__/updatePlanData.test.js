import { jest } from '@jest/globals';
import { handleUpdatePlanRequest, setCallModelImplementation } from '../../worker.js';

describe('handleUpdatePlanRequest', () => {
  afterEach(() => {
    setCallModelImplementation(null);
    jest.clearAllMocks();
  });

  test('stores plan data with flat macros', async () => {
    const env = {
      USER_METADATA_KV: {
        put: jest.fn().mockResolvedValue(),
        get: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue()
      }
    };
    const planData = {
      week: 1,
      caloriesMacros: {
        calories: 2000,
        protein_grams: 140,
        carbs_grams: 220,
        fat_grams: 60,
        fiber_percent: 10,
        fiber_grams: 30
      },
      generationMetadata: { errors: [] }
    };
    const request = { json: async () => ({ userId: 'u1', planData }) };
    const res = await handleUpdatePlanRequest(request, env);
    const planCall = env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === 'u1_final_plan');
    expect(planCall).toBeDefined();
    const storedPlan = JSON.parse(planCall[1]);
    expect(storedPlan.caloriesMacros).toEqual(planData.caloriesMacros);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'u1_analysis_macros',
      JSON.stringify({ status: 'final', data: planData.caloriesMacros })
    );
    expect(res.success).toBe(true);
  });

  test('does not overwrite plan when macros remain incomplete', async () => {
    const env = {
      USER_METADATA_KV: {
        put: jest.fn().mockResolvedValue(),
        get: jest.fn().mockResolvedValue('[]'),
        delete: jest.fn().mockResolvedValue()
      },
      RESOURCES_KV: {
        get: jest.fn().mockImplementation(async (key) =>
          key === 'model_plan_generation' ? 'gpt-test' : null
        )
      },
      OPENAI_API_KEY: 'test-key'
    };
    const incompletePlan = {
      caloriesMacros: { calories: 1800 },
      week1Menu: {
        day1: [
          { meal_name: 'Закуска', description: 'примерно меню без макроси' }
        ]
      },
      generationMetadata: { errors: [] }
    };
    const request = { json: async () => ({ userId: 'u2', planData: incompletePlan }) };
    const modelMock = jest.fn().mockResolvedValue(JSON.stringify({ caloriesMacros: {} }));
    setCallModelImplementation(modelMock);

    const res = await handleUpdatePlanRequest(request, env);

    const finalPlanCall = env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === 'u2_final_plan');
    expect(finalPlanCall).toBeUndefined();
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(422);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'u2_plan_update_incident',
      expect.any(String)
    );
    expect(modelMock).toHaveBeenCalled();
  });
});
