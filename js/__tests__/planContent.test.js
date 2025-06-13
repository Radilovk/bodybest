import { jest } from '@jest/globals';
let planHasRecContent;
let consoleErrorMock;
beforeAll(async () => {
  global.window = { location: { hostname: 'localhost' } };
  global.document = { addEventListener: jest.fn() };
  consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
  ({ planHasRecContent } = await import('../app.js'));
});
afterAll(() => {
  consoleErrorMock.mockRestore();
});

describe('planHasRecContent', () => {
  test('returns true when only additionalGuidelines present', () => {
    const plan = { additionalGuidelines: ['Tip 1', 'Tip 2'] };
    expect(planHasRecContent(plan)).toBe(true);
  });
});
