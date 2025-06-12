import { jest } from '@jest/globals';
let planHasRecContent;
beforeAll(async () => {
  global.window = { location: { hostname: 'localhost' } };
  global.document = { addEventListener: jest.fn() };
  ({ planHasRecContent } = await import('../app.js'));
});

describe('planHasRecContent', () => {
  test('returns true when only additionalGuidelines present', () => {
    const plan = { additionalGuidelines: ['Tip 1', 'Tip 2'] };
    expect(planHasRecContent(plan)).toBe(true);
  });
});
