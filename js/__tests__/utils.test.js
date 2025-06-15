import { safeGet, safeParseFloat, capitalizeFirstLetter, escapeHtml } from '../utils.js';

describe('utils', () => {
  test('safeGet returns nested value', () => {
    const obj = { a: { b: { c: 5 } } };
    expect(safeGet(obj, 'a.b.c')).toBe(5);
  });

  test('safeGet returns default for missing path', () => {
    const obj = { a: 1 };
    expect(safeGet(obj, 'a.b.c', 'default')).toBe('default');
  });

  test('safeParseFloat parses numbers correctly', () => {
    expect(safeParseFloat('42.5')).toBe(42.5);
    expect(safeParseFloat('42,5')).toBe(42.5);
  });

  test('safeParseFloat returns default for invalid', () => {
    expect(safeParseFloat('abc', 0)).toBe(0);
  });

  test('capitalizeFirstLetter works', () => {
    expect(capitalizeFirstLetter('hello')).toBe('Hello');
    expect(capitalizeFirstLetter('')).toBe('');
  });

  test('escapeHtml replaces special characters', () => {
    const input = '<div class="test">O\'Reilly & "Co"</div>';
    const expected = '&lt;div class=&quot;test&quot;&gt;O&#39;Reilly &amp; &quot;Co&quot;&lt;/div&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  test('escapeHtml handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
