import { jest } from '@jest/globals';

const workerModule = await import('../../worker.js');

describe('handleDashboardDataRequest - pending_inputs статус', () => {
  test('връща успешен отговор за потребител без initial_answers в pending_inputs статус', async () => {
    const userId = 'test-pending-inputs-user';
    const kvData = new Map();
    
    // Симулираме регистриран потребител без попълнен въпросник
    kvData.set(`plan_status_${userId}`, 'pending_inputs');
    // initial_answers не е зададен
    
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => (kvData.has(key) ? kvData.get(key) : null)),
        put: jest.fn(async (key, value) => {
          kvData.set(key, value);
        })
      },
      RESOURCES_KV: {
        get: jest.fn(async () => '{}')
      }
    };
    
    const request = { url: `https://example.com/api/dashboardData?userId=${userId}` };
    const response = await workerModule.handleDashboardDataRequest(request, env);
    
    expect(response.success).toBe(true);
    expect(response.planStatus).toBe('pending_inputs');
    expect(response.userName).toBe('Клиент');
    expect(response.initialAnswers).toEqual({});
    expect(response.planData).toBeNull();
    expect(response.message).toBe('Моля, попълнете въпросника за да започнете.');
  });
  
  test('връща 404 грешка за потребител без initial_answers в ready статус', async () => {
    const userId = 'test-ready-no-answers-user';
    const kvData = new Map();
    
    // Симулираме невалидно състояние - ready статус без initial_answers
    kvData.set(`plan_status_${userId}`, 'ready');
    // initial_answers не е зададен
    
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => (kvData.has(key) ? kvData.get(key) : null)),
        put: jest.fn(async (key, value) => {
          kvData.set(key, value);
        })
      },
      RESOURCES_KV: {
        get: jest.fn(async () => '{}')
      }
    };
    
    const request = { url: `https://example.com/api/dashboardData?userId=${userId}` };
    const response = await workerModule.handleDashboardDataRequest(request, env);
    
    expect(response.success).toBe(false);
    expect(response.statusHint).toBe(404);
    expect(response.message).toBe('Основните данни на потребителя не са намерени.');
  });
  
  test('връща успешен отговор за потребител с initial_answers в pending статус', async () => {
    const userId = 'test-pending-with-answers-user';
    const kvData = new Map();
    
    // Симулираме потребител с попълнен въпросник, чакащ генериране на план
    kvData.set(`plan_status_${userId}`, 'pending');
    kvData.set(`${userId}_initial_answers`, JSON.stringify({ 
      name: 'Тест Потребител',
      weight: 70,
      height: 175,
      goal: 'Форма'
    }));
    
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => (kvData.has(key) ? kvData.get(key) : null)),
        put: jest.fn(async (key, value) => {
          kvData.set(key, value);
        }),
        list: jest.fn(async () => ({ keys: [] }))
      },
      RESOURCES_KV: {
        get: jest.fn(async () => '{}')
      }
    };
    
    const request = { url: `https://example.com/api/dashboardData?userId=${userId}` };
    const response = await workerModule.handleDashboardDataRequest(request, env);
    
    expect(response.success).toBe(true);
    expect(response.planStatus).toBe('pending');
    expect(response.userName).toBe('Тест Потребител');
    expect(response.initialAnswers).toEqual(expect.objectContaining({
      name: 'Тест Потребител',
      weight: 70,
      height: 175,
      goal: 'Форма'
    }));
    expect(response.planData).toBeNull();
  });
});
