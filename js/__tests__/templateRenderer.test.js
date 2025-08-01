import { renderTemplate } from '../../utils/templateRenderer.js';

describe('renderTemplate', () => {
  test('замества всички плейсхолдери', () => {
    const tpl = 'Здравей, {{ name }}! Вашият линк: {{ link }}';
    const vars = { name: 'Иван', link: 'http://example.com' };
    expect(renderTemplate(tpl, vars)).toBe('Здравей, Иван! Вашият линк: http://example.com');
  });

  test('липсващи ключове дават празен низ', () => {
    expect(renderTemplate('Hello {{missing}}', {})).toBe('Hello ');
  });
});
