/** @jest-environment jsdom */
import { initPlanEditor } from '../planEditor.js';

beforeEach(() => {
  document.body.innerHTML = `
    <table id="menuEditTable"></table>
    <textarea id="allowedFoodsInput"></textarea>
    <textarea id="forbiddenFoodsInput"></textarea>
    <textarea id="principlesInput"></textarea>
  `;
});

test('initializes fields from plan data', () => {
  const data = {
    week1Menu: {
      monday: [{ meal_name: 'Закуска' }, { meal_name: 'Обяд' }],
      tuesday: [{ meal_name: 'Вечеря' }]
    },
    allowedForbiddenFoods: {
      main_allowed_foods: ['ябълки', 'пиле'],
      main_forbidden_foods: ['захар']
    },
    principlesWeek2_4: ['принцип1', 'принцип2']
  };
  initPlanEditor(data);
  const monday = document.querySelector('textarea[data-day="monday"]');
  const tuesday = document.querySelector('textarea[data-day="tuesday"]');
  expect(monday.value).toBe('Закуска\nОбяд');
  expect(tuesday.value).toBe('Вечеря');
  expect(document.getElementById('allowedFoodsInput').value).toBe('ябълки\nпиле');
  expect(document.getElementById('forbiddenFoodsInput').value).toBe('захар');
  expect(document.getElementById('principlesInput').value).toBe('принцип1\nпринцип2');
});
