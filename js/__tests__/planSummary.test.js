import { createPlanUpdateSummary } from '../../worker.js';

describe('createPlanUpdateSummary', () => {
  test('creates summary from new plan without truncating short text', () => {
    const newPlan = {
      caloriesMacros: { calories: 1800, fiber_percent: 10, fiber_grams: 30 },
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
      caloriesMacros: { calories: 1800, fiber_percent: 10, fiber_grams: 30 },
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

  test('handles principle objects correctly', () => {
    const newPlan = {
      principlesWeek2_4: [
        { title: 'Заглавие', content: 'Съдържание' },
        { title: 'Другo', content: 'Текст' }
      ]
    };
    const summary = createPlanUpdateSummary(newPlan, {});
    expect(summary.changes.length).toBe(2);
    const total = summary.changes.join(' ');
    expect(total).not.toContain('[object Object]');
  });

  test('detects new dishes in week1Menu', () => {
    const newPlan = {
      week1Menu: {
        monday: [
          { meal_name: 'Закуска', items: [{ name: 'Овесена каша' }] },
          { meal_name: 'Обяд', items: [{ name: 'Пиле' }] }
        ]
      }
    };
    const oldPlan = {
      week1Menu: {
        monday: [
          { meal_name: 'Закуска', items: [{ name: 'Омлет' }] },
          { meal_name: 'Обяд', items: [{ name: 'Пиле' }] }
        ]
      }
    };
    const summary = createPlanUpdateSummary(newPlan, oldPlan);
    const joined = summary.changes.join(' ');
    expect(joined).toContain('Понеделник');
    expect(joined).toContain('Закуска');
  });
});
