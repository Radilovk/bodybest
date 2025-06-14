/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let openModal, closeModal;

beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
  ({ openModal, closeModal } = await import('../uiHandlers.js'));
  document.body.innerHTML = `
    <div id="firstModal" class="modal"></div>
    <div id="secondModal" class="modal"></div>
  `;
});

test('queued modals open sequentially', () => {
  openModal('firstModal');
  openModal('secondModal');
  const first = document.getElementById('firstModal');
  const second = document.getElementById('secondModal');
  expect(first.classList.contains('visible')).toBe(true);
  expect(second.classList.contains('visible')).toBe(false);
  closeModal('firstModal');
  expect(second.classList.contains('visible')).toBe(true);
});
