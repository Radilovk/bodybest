/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import vm from 'node:vm';

let toggleThemeMock;
let initializeThemeMock;
let snippet;

beforeAll(() => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../quest.html'), 'utf8');
  const match = html.match(/const themeToggleBtn[\s\S]*?themeToggleBtn.addEventListener\('click', toggleTheme\);/);
  snippet = match ? match[0] : '';
});

beforeEach(async () => {
  jest.resetModules();
  toggleThemeMock = jest.fn();
  initializeThemeMock = jest.fn();
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    toggleTheme: toggleThemeMock,
    initializeTheme: initializeThemeMock
  }));
  document.body.innerHTML = '<button id="theme-toggle"></button>';
  const { initializeTheme, toggleTheme } = await import('../uiHandlers.js');
  vm.runInNewContext(snippet, { document, initializeTheme, toggleTheme });
});

test('initializeTheme се извиква при зареждане', () => {
  expect(initializeThemeMock).toHaveBeenCalled();
});

test('#theme-toggle активира toggleTheme', () => {
  document.getElementById('theme-toggle').click();
  expect(toggleThemeMock).toHaveBeenCalled();
});
