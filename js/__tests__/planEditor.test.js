/** @jest-environment jsdom */
import { initPlanEditor, gatherPlanFormData } from '../planEditor.js';

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

test('gathers form data into JSON', () => {
  document.body.innerHTML = `
    <table id="menuEditTable">
      <tr><td><textarea data-day="monday" class="form-control">Закуска\nОбяд</textarea></td></tr>
      <tr><td><textarea data-day="tuesday" class="form-control">Вечеря</textarea></td></tr>
    </table>
    <textarea id="allowedFoodsInput">ябълки\nпиле</textarea>
    <textarea id="forbiddenFoodsInput">захар</textarea>
    <textarea id="principlesInput">принцип1\nпринцип2</textarea>
  `;
  const json = gatherPlanFormData();
  expect(json).toEqual({
    week1Menu: {
      monday: [
        { meal_name: 'Закуска', items: [] },
        { meal_name: 'Обяд', items: [] }
      ],
      tuesday: [
        { meal_name: 'Вечеря', items: [] }
      ],
    },
    allowedForbiddenFoods: {
      main_allowed_foods: ['ябълки', 'пиле'],
      main_forbidden_foods: ['захар']
    },
    principlesWeek2_4: 'принцип1\nпринцип2'
  });
});
