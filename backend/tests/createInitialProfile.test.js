import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

describe('createInitialProfileFromQuestionnaire', () => {
  test('създава профил от пълни данни на въпросника', async () => {
    const kvStore = new Map();
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); })
    };
    
    const userId = 'test-user-123';
    kvStore.set('email_to_uuid_test@example.com', userId);
    
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          prompt_questionnaire_analysis: 'tpl',
          model_questionnaire_analysis: '@cf/mock'
        };
        return Promise.resolve(data[key]);
      })
    };
    
    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      send_analysis_email: '0',
      AI: { run: jest.fn(async () => ({ response: '{}' })) }
    };
    
    const ctx = { waitUntil: jest.fn() };

    const questionnaireData = {
      email: 'test@example.com',
      name: 'Иван Петров',
      age: 35,
      height: 180,
      weight: 85,
      phone: '+359888123456',
      gender: 'мъж',
      goal: 'загуба на тегло',
      medicalConditions: ['нямам']
    };

    const request = {
      json: async () => questionnaireData
    };

    await worker.handleSubmitQuestionnaire(request, env, ctx);

    // Проверка че профилът е създаден
    const profileKey = `${userId}_profile`;
    expect(USER_METADATA_KV.put).toHaveBeenCalledWith(
      profileKey,
      expect.any(String)
    );
    
    // Проверка на съдържанието на профила
    const profileCall = USER_METADATA_KV.put.mock.calls.find(call => call[0] === profileKey);
    expect(profileCall).toBeDefined();
    
    const savedProfile = JSON.parse(profileCall[1]);
    expect(savedProfile.name).toBe('Иван Петров');
    expect(savedProfile.email).toBe('test@example.com');
    expect(savedProfile.age).toBe(35);
    expect(savedProfile.height).toBe(180);
    expect(savedProfile.phone).toBe('+359888123456');
  });

  test('не презаписва съществуващ профил', async () => {
    const kvStore = new Map();
    const userId = 'test-user-456';
    kvStore.set('email_to_uuid_existing@example.com', userId);
    
    // Вече съществуващ профил
    const existingProfile = {
      name: 'Стара Информация',
      email: 'existing@example.com',
      age: 40,
      height: 170,
      phone: '+359888999888'
    };
    kvStore.set(`${userId}_profile`, JSON.stringify(existingProfile));
    
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); })
    };
    
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          prompt_questionnaire_analysis: 'tpl',
          model_questionnaire_analysis: '@cf/mock'
        };
        return Promise.resolve(data[key]);
      })
    };
    
    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      send_analysis_email: '0',
      AI: { run: jest.fn(async () => ({ response: '{}' })) }
    };
    
    const ctx = { waitUntil: jest.fn() };

    const questionnaireData = {
      email: 'existing@example.com',
      name: 'Нова Информация',
      age: 35,
      height: 180,
      weight: 85,
      gender: 'мъж',
      goal: 'загуба на тегло',
      medicalConditions: ['нямам']
    };

    const request = {
      json: async () => questionnaireData
    };

    await worker.handleSubmitQuestionnaire(request, env, ctx);

    // Проверка че профилът НЕ е презаписан
    const profileKey = `${userId}_profile`;
    const profilePutCalls = USER_METADATA_KV.put.mock.calls.filter(call => call[0] === profileKey);
    
    // Не трябва да има нови записи за профила
    expect(profilePutCalls.length).toBe(0);
  });

  test('създава профил с минимални данни', async () => {
    const kvStore = new Map();
    const userId = 'test-user-789';
    kvStore.set('email_to_uuid_minimal@example.com', userId);
    
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); })
    };
    
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          prompt_questionnaire_analysis: 'tpl',
          model_questionnaire_analysis: '@cf/mock'
        };
        return Promise.resolve(data[key]);
      })
    };
    
    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      send_analysis_email: '0',
      AI: { run: jest.fn(async () => ({ response: '{}' })) }
    };
    
    const ctx = { waitUntil: jest.fn() };

    // Минимални задължителни данни
    const questionnaireData = {
      email: 'minimal@example.com',
      age: 30,
      height: 175,
      weight: 70,
      gender: 'жена',
      goal: 'поддържане',
      medicalConditions: ['нямам']
      // Няма name или phone
    };

    const request = {
      json: async () => questionnaireData
    };

    await worker.handleSubmitQuestionnaire(request, env, ctx);

    // Проверка че профилът е създаден
    const profileKey = `${userId}_profile`;
    expect(USER_METADATA_KV.put).toHaveBeenCalledWith(
      profileKey,
      expect.any(String)
    );
    
    const profileCall = USER_METADATA_KV.put.mock.calls.find(call => call[0] === profileKey);
    const savedProfile = JSON.parse(profileCall[1]);
    
    expect(savedProfile.email).toBe('minimal@example.com');
    expect(savedProfile.age).toBe(30);
    expect(savedProfile.height).toBe(175);
    expect(savedProfile.name).toBeUndefined(); // Няма име
    expect(savedProfile.phone).toBeUndefined(); // Няма телефон
  });

  test('валидира реалистични граници за възраст и ръст', async () => {
    const kvStore = new Map();
    const userId = 'test-user-validation';
    kvStore.set('email_to_uuid_validation@example.com', userId);
    
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); })
    };
    
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          prompt_questionnaire_analysis: 'tpl',
          model_questionnaire_analysis: '@cf/mock'
        };
        return Promise.resolve(data[key]);
      })
    };
    
    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      send_analysis_email: '0',
      AI: { run: jest.fn(async () => ({ response: '{}' })) }
    };
    
    const ctx = { waitUntil: jest.fn() };

    // Нереалистични стойности
    const questionnaireData = {
      email: 'validation@example.com',
      age: 200, // Твърде висока възраст
      height: 300, // Твърде висок ръст
      weight: 70,
      gender: 'мъж',
      goal: 'загуба на тегло',
      medicalConditions: ['нямам']
    };

    const request = {
      json: async () => questionnaireData
    };

    await worker.handleSubmitQuestionnaire(request, env, ctx);

    const profileKey = `${userId}_profile`;
    const profileCall = USER_METADATA_KV.put.mock.calls.find(call => call[0] === profileKey);
    const savedProfile = JSON.parse(profileCall[1]);
    
    // Нереалистичните стойности не трябва да бъдат записани
    expect(savedProfile.age).toBeUndefined(); // 200 > 150
    expect(savedProfile.height).toBeUndefined(); // 300 > 250
  });

  test('приема валидни гранични стойности за възраст и ръст', async () => {
    const kvStore = new Map();
    const userId = 'test-user-boundary';
    kvStore.set('email_to_uuid_boundary@example.com', userId);
    
    const USER_METADATA_KV = {
      get: jest.fn(key => Promise.resolve(kvStore.get(key))),
      put: jest.fn((key, val) => { kvStore.set(key, val); return Promise.resolve(); })
    };
    
    const RESOURCES_KV = {
      get: jest.fn(key => {
        const data = {
          prompt_questionnaire_analysis: 'tpl',
          model_questionnaire_analysis: '@cf/mock'
        };
        return Promise.resolve(data[key]);
      })
    };
    
    const env = {
      USER_METADATA_KV,
      RESOURCES_KV,
      send_analysis_email: '0',
      AI: { run: jest.fn(async () => ({ response: '{}' })) }
    };
    
    const ctx = { waitUntil: jest.fn() };

    // Гранични валидни стойности
    const questionnaireData = {
      email: 'boundary@example.com',
      age: 150, // Максимална валидна възраст
      height: 50, // Минимален валиден ръст
      weight: 70,
      gender: 'мъж',
      goal: 'загуба на тегло',
      medicalConditions: ['нямам']
    };

    const request = {
      json: async () => questionnaireData
    };

    await worker.handleSubmitQuestionnaire(request, env, ctx);

    const profileKey = `${userId}_profile`;
    const profileCall = USER_METADATA_KV.put.mock.calls.find(call => call[0] === profileKey);
    const savedProfile = JSON.parse(profileCall[1]);
    
    // Граничните валидни стойности трябва да бъдат приети
    expect(savedProfile.age).toBe(150);
    expect(savedProfile.height).toBe(50);
  });
});
