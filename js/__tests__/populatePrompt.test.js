import { populatePrompt } from '../../worker.js';

test('replaces plan approach summary placeholder', () => {
  const tpl = 'Intro %%PLAN_APPROACH_SUMMARY%% end';
  const result = populatePrompt(tpl, { '%%PLAN_APPROACH_SUMMARY%%': 'summary' });
  expect(result).toBe('Intro summary end');
});
