import { safeGet, safeParseFloat, capitalizeFirstLetter, escapeHtml, lightenColor, hexToRgb, calcLuminance, contrastRatio } from '../utils.js';

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

  test('lightenColor supports short hex', () => {
    expect(lightenColor('#abc', 0.1)).toBe('#b3c2d1');
  });

  test('lightenColor returns fallback for invalid', () => {
    expect(lightenColor('invalid', 0.1, '#fff')).toBe('#fff');
  });

  test('lightenColor returns original when no fallback', () => {
    expect(lightenColor('invalid')).toBe('invalid');
  });

  test('hexToRgb parses colors', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#123456')).toEqual({ r: 18, g: 52, b: 86 });
  });

  test('calcLuminance returns values between 0 and 1', () => {
    expect(calcLuminance('#000')).toBeCloseTo(0);
    expect(calcLuminance('#fff')).toBeCloseTo(1);
  });

  test('contrastRatio calculates ratio', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21);
  });
});
