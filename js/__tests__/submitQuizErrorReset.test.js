import { jest } from '@jest/globals';
let app;
let consoleErrorMock;

beforeEach(async () => {
  jest.resetModules();
  global.window = { location: { hostname: 'localhost' } };
  global.document = { addEventListener: jest.fn() };
  consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
  app = await import('../app.js');
});

afterEach(() => {
  consoleErrorMock.mockRestore();
});

test('resets state when quiz submission fails', async () => {
  app.setCurrentQuizData({ quizId: 'q1', questions: [] });
  app.setUserQuizAnswers({ q1: 'answer' });
  app.setCurrentQuestionIndex(3);

  await app._handleSubmitQuizAnswersClientSide();

  expect(app.currentQuizData).toBeNull();
  expect(app.userQuizAnswers).toEqual({});
  expect(app.currentQuestionIndex).toBe(0);
});
