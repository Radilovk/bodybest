import { jest } from '@jest/globals';
import { registerSubtleGlow } from '../chartLoader.js';

/**
 * Проверява успешната регистрация и избягване на повторно регистриране на subtleGlow plug-in.
 */
test('registerSubtleGlow регистрира plug-in само веднъж', () => {
  const registry = { plugins: new Map() };
  const Chart = {
    registry,
    register: jest.fn((plugin) => registry.plugins.set(plugin.id, plugin))
  };
  expect(registerSubtleGlow(Chart)).toBe(true);
  expect(Chart.register).toHaveBeenCalledTimes(1);
  expect(registry.plugins.has('subtleGlow')).toBe(true);
  // Повторното извикване не трябва да регистрира отново
  expect(registerSubtleGlow(Chart)).toBe(true);
  expect(Chart.register).toHaveBeenCalledTimes(1);
});
