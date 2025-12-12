// psychTestsIntegration.js - Интеграция на психологическите тестове с backend

import { apiEndpoints } from './config.js';

/**
 * Запазва резултатите от психологическите тестове в backend
 * @param {Object} params
 * @param {string} params.userId - ID на потребителя
 * @param {Object} [params.visualTest] - Резултати от визуалния тест
 * @param {Object} [params.personalityTest] - Резултати от личностния тест
 * @returns {Promise<Object>} Резултат от операцията
 */
export async function savePsychTestsToBackend({ userId, visualTest, personalityTest }) {
  try {
    if (!userId) {
      throw new Error('userId е задължително');
    }

    if (!visualTest && !personalityTest) {
      throw new Error('Трябва да има поне един тест резултат');
    }

    const response = await fetch(`${apiEndpoints.base}/api/savePsychTests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        visualTest,
        personalityTest
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Грешка при запазване на резултатите');
    }

    return data;
  } catch (error) {
    console.error('Error saving psych tests to backend:', error);
    throw error;
  }
}

/**
 * Зарежда резултатите от психотестовете от localStorage
 * @returns {Object|null} Резултати от тестовете или null
 */
export function loadPsychTestsFromLocalStorage() {
  try {
    const data = localStorage.getItem('psychTests');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading psych tests from localStorage:', error);
    return null;
  }
}

/**
 * Синхронизира психотестовете от localStorage към backend
 * @param {string} userId - ID на потребителя
 * @returns {Promise<Object>} Резултат от синхронизацията
 */
export async function syncPsychTestsToBackend(userId) {
  try {
    const psychTests = loadPsychTestsFromLocalStorage();
    
    if (!psychTests) {
      return { success: false, message: 'Няма данни за синхронизация' };
    }

    const result = await savePsychTestsToBackend({
      userId,
      visualTest: psychTests.visualTest,
      personalityTest: psychTests.personalityTest
    });

    // Ако синхронизацията е успешна и се препоръчва регенериране
    if (result.success && result.data?.shouldRegeneratePlan) {
      return {
        ...result,
        shouldRegeneratePlan: true,
        message: 'Резултатите са синхронизирани. Препоръчваме регенериране на плана.'
      };
    }

    return result;
  } catch (error) {
    console.error('Error syncing psych tests to backend:', error);
    throw error;
  }
}
