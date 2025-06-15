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

  test('adds explanation when there are no changes', () => {
    const newPlan = {};
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.changes.length).toBeGreaterThan(0);
    expect(summary.changes[0]).toContain('Няма съществени промени');
  });
});
