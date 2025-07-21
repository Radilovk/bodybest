/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let setupProfileCardNav;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <button id="showStats"></button>
    <nav id="profileCardNav">
      <a data-target="s1">S1</a>
      <a data-target="s2">S2</a>
    </nav>
    <section id="s1"></section>
    <section id="s2"></section>`;
  const mod = await import('../admin.js');
  setupProfileCardNav = mod.setupProfileCardNav;
});

test('activates link on click', () => {
  const [link1, link2] = document.querySelectorAll('#profileCardNav a');
  HTMLElement.prototype.scrollIntoView = jest.fn();
  setupProfileCardNav();
  expect(link1.classList.contains('active')).toBe(true);
  link2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(link2.classList.contains('active')).toBe(true);
});
