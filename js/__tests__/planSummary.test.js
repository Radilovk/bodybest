import { createPlanUpdateSummary } from '../../worker.js';

describe('createPlanUpdateSummary', () => {
  test('creates summary from new plan without truncating short text', () => {
    const newPlan = {
      caloriesMacros: { calories: 1800 },
      principlesWeek2_4: 'Принцип 1\nПринцип 2\nПринцип 3'
    };
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.title).toBeDefined();
    expect(summary.changes[0]).toContain('1800');
    expect(summary.changes.length).toBe(4);
  });

  test('limits number of changes when text is long', () => {
    const longLine = 'Много дълъг принцип който увеличава дължината на текста';
    const newPlan = {
      caloriesMacros: { calories: 1800 },
      principlesWeek2_4: Array(6).fill(longLine).join('\n')
    };
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.changes.length).toBe(5);
  });

  test('shows all short changes when there are many', () => {
    const newPlan = {
      principlesWeek2_4: 'A\nB\nC\nD\nE\nF'
    };
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.changes.length).toBe(6);
  });

  test('adds explanation when there are no changes', () => {
    const newPlan = {};
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.changes.length).toBeGreaterThan(0);
    expect(summary.changes[0]).toContain('Няма съществени промени');
  });
});
