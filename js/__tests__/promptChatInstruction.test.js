import fs from 'fs';

test('prompt_chat instructs clarification before marker', () => {
  const tpl = fs.readFileSync('kv/DIET_RESOURCES/prompt_chat.txt', 'utf8');
  expect(tpl).toMatch(/clarification process will begin/);
  expect(tpl).toMatch(/do not.*add the \[PLAN_MODIFICATION_REQUEST\]/i);
});
