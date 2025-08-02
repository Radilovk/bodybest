/** @jest-environment node */
import { jest } from '@jest/globals';

test('ensureChart throws clear error in test environment', async () => {
  jest.resetModules();
  const { ensureChart } = await import('../chartLoader.js');
  await expect(ensureChart()).rejects.toThrow('Chart.js');
});
