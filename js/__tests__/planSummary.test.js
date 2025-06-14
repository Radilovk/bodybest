import { createPlanUpdateSummary } from '../../worker.js';

describe('createPlanUpdateSummary', () => {
  test('creates summary from new plan', () => {
    const newPlan = {
      caloriesMacros: { calories: 1800 },
      principlesWeek2_4: 'Принцип 1\nПринцип 2\nПринцип 3'
    };
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.title).toBeDefined();
    expect(summary.changes[0]).toContain('1800');
    expect(summary.changes.length).toBeGreaterThan(0);
  });
});
