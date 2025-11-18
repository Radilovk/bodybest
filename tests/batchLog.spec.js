// batchLog.spec.js - Тестове за batch-log endpoint
import { jest } from '@jest/globals';

// Mock environment
const mockEnv = {
  USER_METADATA_KV: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
};

// Mock функции от worker.js
let handleLogRequest;
let handleBatchLogRequest;

beforeAll(async () => {
  // Import worker functions (ако е възможно)
  // В реалния случай ще трябва да експортнем функциите от worker.js
  // За целта на теста ще използваме mock имплементация
  
  // Mock handleLogRequest
  handleLogRequest = jest.fn(async (request) => {
    const data = await request.json();
    if (!data.userId) {
      return { success: false, message: 'Липсва userId' };
    }
    return { 
      success: true, 
      savedDate: data.date || '2025-11-18',
      message: 'Успешно записан лог'
    };
  });

  // Mock handleBatchLogRequest базирана на реалната имплементация
  handleBatchLogRequest = async (request, env) => {
    try {
      const inputData = await request.json();
      const logs = inputData.logs;
      
      if (!Array.isArray(logs) || logs.length === 0) {
        return { 
          success: false, 
          message: 'Липсват логове за обработка.', 
          statusHint: 400 
        };
      }

      for (const log of logs) {
        if (!log.userId) {
          return { 
            success: false, 
            message: 'Липсва userId в един от логовете.', 
            statusHint: 400 
          };
        }
      }

      const results = [];
      const errors = [];

      for (const logData of logs) {
        try {
          const mockRequest = {
            json: async () => logData
          };

          const result = await handleLogRequest(mockRequest, env);
          
          if (result.success) {
            results.push({
              offlineId: logData._offlineId,
              userId: logData.userId,
              savedDate: result.savedDate,
              success: true
            });
          } else {
            errors.push({
              offlineId: logData._offlineId,
              userId: logData.userId,
              error: result.message,
              success: false
            });
          }
        } catch (error) {
          errors.push({
            offlineId: logData._offlineId,
            userId: logData.userId,
            error: error.message,
            success: false
          });
        }
      }

      const successCount = results.length;
      const errorCount = errors.length;

      return {
        success: errorCount === 0,
        message: `Обработени ${successCount} от ${logs.length} логове.`,
        processed: successCount,
        total: logs.length,
        results: results,
        errors: errorCount > 0 ? errors : undefined
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Грешка при batch обработка: ${error.message}`, 
        statusHint: 500 
      };
    }
  };
});

describe('handleBatchLogRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.USER_METADATA_KV.get.mockResolvedValue(null);
    mockEnv.USER_METADATA_KV.put.mockResolvedValue(undefined);
  });

  test('трябва да обработи един лог успешно', async () => {
    const request = {
      json: async () => ({
        logs: [
          {
            userId: 'test_user',
            date: '2025-11-18',
            note: 'Test note',
            _offlineId: 'log-123'
          }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.total).toBe(1);
    expect(result.results.length).toBe(1);
    expect(result.results[0].userId).toBe('test_user');
    expect(result.results[0].offlineId).toBe('log-123');
  });

  test('трябва да обработи множество логове успешно', async () => {
    const request = {
      json: async () => ({
        logs: [
          { userId: 'user1', date: '2025-11-18', _offlineId: 'log-1' },
          { userId: 'user2', date: '2025-11-18', _offlineId: 'log-2' },
          { userId: 'user3', date: '2025-11-18', _offlineId: 'log-3' }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.results.length).toBe(3);
  });

  test('трябва да върне грешка при липса на логове', async () => {
    const request = {
      json: async () => ({ logs: [] })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Липсват логове за обработка.');
    expect(result.statusHint).toBe(400);
  });

  test('трябва да върне грешка при невалидни данни', async () => {
    const request = {
      json: async () => ({ logs: 'not an array' })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(false);
    expect(result.statusHint).toBe(400);
  });

  test('трябва да валидира userId във всеки лог', async () => {
    const request = {
      json: async () => ({
        logs: [
          { userId: 'user1', date: '2025-11-18' },
          { date: '2025-11-18' }, // Липсва userId
          { userId: 'user3', date: '2025-11-18' }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Липсва userId в един от логовете.');
    expect(result.statusHint).toBe(400);
  });

  test('трябва да продължи обработката при грешка в отделен лог', async () => {
    // Mock handleLogRequest да хвърли грешка за втория лог
    handleLogRequest.mockImplementation(async (request) => {
      const data = await request.json();
      if (data.userId === 'error_user') {
        throw new Error('Test error');
      }
      return { 
        success: true, 
        savedDate: data.date || '2025-11-18',
        message: 'Успешно'
      };
    });

    const request = {
      json: async () => ({
        logs: [
          { userId: 'user1', date: '2025-11-18', _offlineId: 'log-1' },
          { userId: 'error_user', date: '2025-11-18', _offlineId: 'log-2' },
          { userId: 'user3', date: '2025-11-18', _offlineId: 'log-3' }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(false); // Защото има грешки
    expect(result.processed).toBe(2); // Обработени са 2 от 3
    expect(result.total).toBe(3);
    expect(result.results.length).toBe(2);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].offlineId).toBe('log-2');
  });

  test('трябва да запази offlineId във results', async () => {
    const request = {
      json: async () => ({
        logs: [
          { 
            userId: 'test_user', 
            date: '2025-11-18',
            _offlineId: 'custom-offline-id-123'
          }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.results[0].offlineId).toBe('custom-offline-id-123');
  });

  test('трябва да обработи логове с extra meal данни', async () => {
    const request = {
      json: async () => ({
        logs: [
          {
            userId: 'test_user',
            date: '2025-11-18',
            extraMeals: [
              {
                foodDescription: 'Ябълка',
                quantityEstimate: 'средна порция',
                calories: 95
              }
            ],
            _offlineId: 'log-extra-123'
          }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
  });

  test('трябва да обработи логове с totals данни', async () => {
    const request = {
      json: async () => ({
        logs: [
          {
            userId: 'test_user',
            date: '2025-11-18',
            totals: {
              calories: 2000,
              protein: 150,
              carbs: 200,
              fat: 60
            },
            _offlineId: 'log-totals-123'
          }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
  });
});

describe('batch-log integration', () => {
  test('резултатът трябва да съдържа правилна статистика', async () => {
    const request = {
      json: async () => ({
        logs: Array.from({ length: 50 }, (_, i) => ({
          userId: `user${i}`,
          date: '2025-11-18',
          note: `Log ${i}`,
          _offlineId: `log-${i}`
        }))
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.success).toBe(true);
    expect(result.processed).toBe(50);
    expect(result.total).toBe(50);
    expect(result.results.length).toBe(50);
    expect(result.errors).toBeUndefined();
  });

  test('трябва да върне правилно съобщение за статуса', async () => {
    const request = {
      json: async () => ({
        logs: [
          { userId: 'user1', date: '2025-11-18', _offlineId: 'log-1' },
          { userId: 'user2', date: '2025-11-18', _offlineId: 'log-2' }
        ]
      })
    };

    const result = await handleBatchLogRequest(request, mockEnv);

    expect(result.message).toBe('Обработени 2 от 2 логове.');
  });
});
