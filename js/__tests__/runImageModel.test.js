import { jest } from '@jest/globals';
import { handleRunImageModelRequest } from '../../worker.js';

describe('handleRunImageModelRequest', () => {
  test('returns 400 on invalid JSON', async () => {
    const req = { json: async () => { throw new Error('bad'); } };
    const res = await handleRunImageModelRequest(req, {});
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('validates required fields', async () => {
    const req = { json: async () => ({}) };
    const res = await handleRunImageModelRequest(req, {});
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('calls env.AI.run and returns result', async () => {
    const aiRun = jest.fn().mockResolvedValue('ok');
    const env = { AI: { run: aiRun } };
    const req = { json: async () => ({ model: '@cf/test', prompt: 'hi', image: [1,2] }) };
    const res = await handleRunImageModelRequest(req, env);
    expect(res.success).toBe(true);
    expect(res.result).toBe('ok');
    expect(aiRun).toHaveBeenCalledWith('@cf/test', { prompt: 'hi', image: new Uint8Array([1,2]) });
  });
});
