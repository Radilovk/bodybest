/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('maintenanceMode helpers', () => {
  let loadMaintenanceFlag, setMaintenanceFlag;
  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule('../config.js', () => ({
      apiEndpoints: { getMaintenanceMode: '/getM', setMaintenanceMode: '/setM' }
    }));
    ({ loadMaintenanceFlag, setMaintenanceFlag } = await import('../maintenanceMode.js'));
  });
  afterEach(() => {
    global.fetch && global.fetch.mockRestore();
    sessionStorage.clear();
    localStorage.clear();
  });

  test('loadMaintenanceFlag fetches flag', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, enabled: 1 }) });
    const res = await loadMaintenanceFlag();
    expect(global.fetch).toHaveBeenCalledWith('/getM');
    expect(res).toBe(true);
  });

  test('setMaintenanceFlag posts with token', async () => {
    sessionStorage.setItem('adminToken', 't');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await setMaintenanceFlag(true);
    expect(global.fetch).toHaveBeenCalledWith('/setM', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify({ enabled: 1 })
    }));
  });
});
