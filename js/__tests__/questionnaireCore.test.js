/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let saveAnswer, validateAnswer, getResponses;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = '<input id="name" type="text">';
  ({ saveAnswer, validateAnswer, getResponses } = await import('../questionnaireCore.js'));
});

test('saveAnswer записва стойността', () => {
  const q = { id: 'name', type: 'text' };
  document.getElementById('name').value = 'Ivan';
  saveAnswer(q);
  expect(getResponses().name).toBe('Ivan');
});

test('validateAnswer връща false за празно задължително поле', () => {
  const q = { id: 'name', type: 'text' };
  document.getElementById('name').value = '';
  expect(validateAnswer(q)).toBe(false);
});
