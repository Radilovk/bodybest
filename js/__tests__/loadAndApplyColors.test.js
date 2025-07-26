/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let loadAndApplyColors;
let mockLoad;

beforeEach(async () => {
  jest.resetModules();
  mockLoad = jest.fn().mockResolvedValue({ colors: { 'primary-color': '#111111', 'accent-color': '#222222' } });
  jest.unstable_mockModule('../adminConfig.js', () => ({ loadConfig: mockLoad }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    activeTooltip: null,
    setActiveTooltip: jest.fn()
  }));
  ({ loadAndApplyColors } = await import('../uiHandlers.js'));
});

afterEach(() => {
  mockLoad.mockReset();
  document.documentElement.style.cssText = '';
  document.body.style.cssText = '';
});

test('зарежда и прилага цветовете', async () => {
  await loadAndApplyColors();
  expect(mockLoad).toHaveBeenCalledWith(['colors']);
  expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#111111');
  expect(document.body.style.getPropertyValue('--accent-color')).toBe('#222222');
});


test('не променя цветовете при грешка', async () => {
  document.documentElement.style.setProperty('--primary-color', '#000000');
  document.body.style.setProperty('--primary-color', '#000000');
  mockLoad.mockRejectedValue(new Error('fail'));
  await loadAndApplyColors();
  expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#000000');
});
