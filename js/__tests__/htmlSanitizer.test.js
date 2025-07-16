/** @jest-environment jsdom */
import { sanitizeHTML } from '../htmlSanitizer.js';

describe('sanitizeHTML', () => {
  test('removes disallowed tags and event attributes', () => {
    const html = '<div onclick="bad()">hi<script>alert(1)</script><a href="#" onmouseover="evil()">link</a></div>';
    const result = sanitizeHTML(html, ['div','a']);
    expect(result).toBe('<div>hi<a href="#">link</a></div>');
  });

  test('keeps allowed tags and attributes', () => {
    const html = '<p class="x">T</p><span style="color:red">X</span>';
    const result = sanitizeHTML(html, ['p','span']);
    expect(result).toBe('<p class="x">T</p><span style="color:red">X</span>');
  });
});
