import { jest } from '@jest/globals';

let stripPlanModSignature;

beforeAll(async () => {
  global.window = { location: { hostname: 'localhost' } };
  global.document = { addEventListener: jest.fn() };
  ({ stripPlanModSignature } = await import('../app.js'));
});

test('handles multiple plan mod markers', () => {
  const reply = 'a [PLAN_MODIFICATION_REQUEST] b [PLAN_MODIFICATION_REQUEST] c';
  expect(stripPlanModSignature(reply)).toBe('a [PLAN_MODIFICATION_REQUEST] b');
});
