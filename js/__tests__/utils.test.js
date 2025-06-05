import { safeGet, safeParseFloat, capitalizeFirstLetter } from '../utils.js';

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
});
