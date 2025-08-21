import { jest } from '@jest/globals';
import { summarizeAndTrimChatHistory, getMaxChatHistoryMessages } from '../../worker.js';

describe('chat history utilities', () => {
  test('getMaxChatHistoryMessages prefers ENV then KV', async () => {
    const envDirect = { MAX_CHAT_HISTORY_MESSAGES: '5' };
    await expect(getMaxChatHistoryMessages(envDirect)).resolves.toBe(5);

    const envKv = { RESOURCES_KV: { get: jest.fn().mockResolvedValue('7') } };
    await expect(getMaxChatHistoryMessages(envKv)).resolves.toBe(7);
  });

  test('summarizeAndTrimChatHistory keeps summary and recent messages', async () => {
    const env = {
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'model_chat_summary') return Promise.resolve('@cf/summarizer');
          if (key === 'prompt_chat_summary') return Promise.resolve('%%CHAT_HISTORY%%');
          return Promise.resolve(null);
        })
      },
      AI: { run: jest.fn().mockResolvedValue({ response: 'sum' }) }
    };

    const history = [
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'model', parts: [{ text: 'second' }] },
      { role: 'user', parts: [{ text: 'third' }] }
    ];

    const result = await summarizeAndTrimChatHistory(history, env, 2);
    expect(env.AI.run).toHaveBeenCalled();
    expect(result[0].summary).toBe(true);
    expect(result.length).toBe(2);
    expect(result[1].parts[0].text).toBe('third');
  });
});

