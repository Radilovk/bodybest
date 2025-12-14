/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { handleSavePsychTestsRequest, handleGetPsychTestsRequest } from '../worker.js';

const makePostRequest = (body) => ({
  json: async () => body,
  url: 'https://example.com/api/savePsychTests'
});

describe('psych tests storage', () => {
  test('съхранява и извлича резултатите в KV', async () => {
    const store = {};
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => store[key] || null),
        put: jest.fn(async (key, value) => {
          store[key] = value;
        })
      }
    };

    const payload = {
      userId: 'u1',
      visualTest: { id: '01', name: 'Тест профил', short: 'Описание', timestamp: '2025-01-01T00:00:00Z' }
    };

    const saveRes = await handleSavePsychTestsRequest(makePostRequest(payload), env);
    expect(saveRes.success).toBe(true);
    
    // Проверка че данните са в initial_answers
    expect(store['u1_initial_answers']).toBeDefined();
    const answers = JSON.parse(store['u1_initial_answers']);
    expect(answers.psychTests).toBeDefined();
    expect(answers.psychTests.visualTest.name).toBe('Тест профил');

    const getRes = await handleGetPsychTestsRequest({ url: 'https://example.com/api/getPsychTests?userId=u1' }, env);
    expect(getRes.success).toBe(true);
    expect(getRes.data.visualTest.name).toBe('Тест профил');
    expect(getRes.data.lastUpdated).toBe('2025-01-01T00:00:00Z');
  });

  test('пада обратно към analysis данните когато липсва запис', async () => {
    const analysis = {
      visualTestProfile: {
        profileId: '11',
        profileName: 'Визуален',
        profileShort: 'Съкратено',
        timestamp: '2025-02-01T00:00:00Z'
      },
      personalityTestProfile: {
        typeCode: 'E-C-O',
        scores: { E: 60, C: 55 },
        riskFlags: ['risk'],
        timestamp: '2025-02-02T00:00:00Z'
      }
    };

    const store = {
      'u2_analysis': JSON.stringify(analysis)
    };

    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => store[key] || null),
        put: jest.fn()
      }
    };

    const res = await handleGetPsychTestsRequest({ url: 'https://example.com/api/getPsychTests?userId=u2' }, env);
    expect(res.success).toBe(true);
    expect(res.data.visualTest.id).toBe('11');
    expect(res.data.personalityTest.typeCode).toBe('E-C-O');
    expect(res.data.lastUpdated).toBe('2025-02-02T00:00:00Z');
  });

  test('автоматично добавя психо тест данни към final_plan', async () => {
    const existingPlan = {
      profileSummary: 'Съществуващ план',
      caloriesMacros: { calories: 2000 },
      week1Menu: {},
      generationMetadata: { timestamp: '2025-01-01T00:00:00Z' }
    };

    const store = {
      'u3_plan_status': 'ready',
      'u3_final_plan': JSON.stringify(existingPlan)
    };

    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => store[key] || null),
        put: jest.fn(async (key, value) => {
          store[key] = value;
        })
      }
    };

    const payload = {
      userId: 'u3',
      visualTest: { 
        id: 'v1', 
        name: 'Визуален профил', 
        short: 'Описание', 
        mainPsycho: ['Перфекционизъм', 'Контрол'],
        mainHabits: ['Строго броене', 'Избягване на социални събития'],
        mainRisks: ['Ортонексия', 'Социална изолация'],
        timestamp: '2025-01-15T10:00:00Z' 
      },
      personalityTest: { 
        typeCode: 'ENTJ', 
        scores: { E: 75, N: 80, T: 70, J: 65 }, 
        riskFlags: ['perfectionism'],
        strengths: ['Добра самодисциплина', 'Структурираност'],
        mainRisks: ['Рестриктивни тенденции', 'Прекалена фиксация'],
        topRecommendations: ['Практикувайте гъвкавост', 'Работете с нутриционист', '10-20% удоволствие'],
        timestamp: '2025-01-15T10:30:00Z' 
      }
    };

    const saveRes = await handleSavePsychTestsRequest(makePostRequest(payload), env);
    expect(saveRes.success).toBe(true);
    expect(saveRes.data.addedToFinalPlan).toBe(true);
    expect(saveRes.data.shouldRegeneratePlan).toBe(false);

    // Проверка, че final_plan е актуализиран
    const updatedPlan = JSON.parse(store['u3_final_plan']);
    expect(updatedPlan.psychoTestsProfile).toBeDefined();
    expect(updatedPlan.psychoTestsProfile.visualTest.profileId).toBe('v1');
    expect(updatedPlan.psychoTestsProfile.visualTest.profileName).toBe('Визуален профил');
    expect(updatedPlan.psychoTestsProfile.visualTest.mainPsycho).toEqual(['Перфекционизъм', 'Контрол']);
    expect(updatedPlan.psychoTestsProfile.visualTest.mainHabits).toEqual(['Строго броене', 'Избягване на социални събития']);
    expect(updatedPlan.psychoTestsProfile.visualTest.mainRisks).toEqual(['Ортонексия', 'Социална изолация']);
    expect(updatedPlan.psychoTestsProfile.personalityTest.typeCode).toBe('ENTJ');
    expect(updatedPlan.psychoTestsProfile.personalityTest.scores.E).toBe(75);
    expect(updatedPlan.psychoTestsProfile.personalityTest.riskFlags).toEqual(['perfectionism']);
    expect(updatedPlan.psychoTestsProfile.personalityTest.strengths).toEqual(['Добра самодисциплина', 'Структурираност']);
    expect(updatedPlan.psychoTestsProfile.personalityTest.mainRisks).toEqual(['Рестриктивни тенденции', 'Прекалена фиксация']);
    expect(updatedPlan.psychoTestsProfile.personalityTest.topRecommendations).toEqual(['Практикувайте гъвкавост', 'Работете с нутриционист', '10-20% удоволствие']);
    expect(updatedPlan.psychoTestsProfile.lastUpdated).toBeDefined();
  });

  test('препоръчва регенериране на план когато няма final_plan', async () => {
    const store = {
      'u4_plan_status': 'ready'
      // Няма u4_final_plan
    };

    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => store[key] || null),
        put: jest.fn(async (key, value) => {
          store[key] = value;
        })
      }
    };

    const payload = {
      userId: 'u4',
      personalityTest: { typeCode: 'ISFP', scores: { I: 60, S: 55, F: 70, P: 65 }, riskFlags: [] }
    };

    const saveRes = await handleSavePsychTestsRequest(makePostRequest(payload), env);
    expect(saveRes.success).toBe(true);
    expect(saveRes.data.addedToFinalPlan).toBe(false);
    expect(saveRes.data.shouldRegeneratePlan).toBe(true);
    
    // Проверка че данните са в initial_answers
    expect(store['u4_initial_answers']).toBeDefined();
    const answers = JSON.parse(store['u4_initial_answers']);
    expect(answers.psychTests).toBeDefined();
  });

  test('регенериране на план включва психо тест данни', async () => {
    // Тест за проверка че psycho tests се включват правилно при регенериране
    // Този тест проверява само логиката за добавяне на psycho profile към планa
    // без да изисква пълна AI генерация
    
    const initialAnswers = {
      age: 30,
      weight: 70,
      height: 175,
      activityLevel: 'moderate',
      goal: 'weight_loss',
      psychTests: {
        visualTest: {
          id: 'v1',
          name: 'Визуален тест',
          short: 'Кратко описание',
          mainPsycho: ['Контрол', 'Перфекционизъм'],
          mainHabits: ['Строго броене', 'Избягване'],
          mainRisks: ['Ортонексия', 'Изолация'],
          timestamp: '2025-01-15T10:00:00Z'
        },
        personalityTest: {
          typeCode: 'E-V-M-J',
          scores: { E: 75, C: 70, O: 80, A: 65, N: 60, I: 45, R: 40 },
          riskFlags: ['Висока реактивност'],
          strengths: ['Самодисциплина', 'Отвореност'],
          mainRisks: ['Рестрикция', 'Фиксация'],
          topRecommendations: ['Гъвкавост', 'Нутриционист', 'Удоволствие'],
          timestamp: '2025-01-15T10:30:00Z'
        },
        lastUpdated: '2025-01-15T10:30:00Z'
      }
    };

    const store = {
      'u5_initial_answers': JSON.stringify(initialAnswers)
    };

    // Симулираме запазване на психо тестове след което те трябва да се добавят при регенериране
    // Проверяваме че initial_answers съдържа правилните данни
    const answers = JSON.parse(store['u5_initial_answers']);
    expect(answers.psychTests).toBeDefined();
    expect(answers.psychTests.visualTest.mainPsycho).toEqual(['Контрол', 'Перфекционизъм']);
    expect(answers.psychTests.personalityTest.strengths).toEqual(['Самодисциплина', 'Отвореност']);
    
    // Проверяваме че createPsychoTestsProfileData работи правилно
    const { createPsychoTestsProfileData } = await import('../worker.js');
    const psychoProfile = createPsychoTestsProfileData(
      answers.psychTests.visualTest,
      answers.psychTests.personalityTest,
      {
        normalizedVisualTimestamp: answers.psychTests.visualTest.timestamp,
        normalizedPersonalityTimestamp: answers.psychTests.personalityTest.timestamp,
        timestamp: answers.psychTests.lastUpdated
      }
    );
    
    // Проверка че психо профилът съдържа всички нужни данни
    expect(psychoProfile.visualTest).toBeDefined();
    expect(psychoProfile.visualTest.mainPsycho).toEqual(['Контрол', 'Перфекционизъм']);
    expect(psychoProfile.visualTest.mainHabits).toEqual(['Строго броене', 'Избягване']);
    expect(psychoProfile.visualTest.mainRisks).toEqual(['Ортонексия', 'Изолация']);
    
    expect(psychoProfile.personalityTest).toBeDefined();
    expect(psychoProfile.personalityTest.strengths).toEqual(['Самодисциплина', 'Отвореност']);
    expect(psychoProfile.personalityTest.mainRisks).toEqual(['Рестрикция', 'Фиксация']);
    expect(psychoProfile.personalityTest.topRecommendations).toEqual(['Гъвкавост', 'Нутриционист', 'Удоволствие']);
  });
});

