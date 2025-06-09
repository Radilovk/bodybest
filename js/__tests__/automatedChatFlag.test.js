import { shouldTriggerAutomatedFeedbackChat } from '../../worker.js';

describe('shouldTriggerAutomatedFeedbackChat', () => {
  const day = 24 * 60 * 60 * 1000;
  test('triggers when update older than threshold and no chat', () => {
    const now = Date.now();
    expect(shouldTriggerAutomatedFeedbackChat(now - 4 * day, 0, now)).toBe(true);
  });
  test('does not trigger if chat already after update', () => {
    const now = Date.now();
    expect(shouldTriggerAutomatedFeedbackChat(now - 4 * day, now - 1 * day, now)).toBe(false);
  });
  test('does not trigger if update is recent', () => {
    const now = Date.now();
    expect(shouldTriggerAutomatedFeedbackChat(now - 1 * day, 0, now)).toBe(false);
  });
});
