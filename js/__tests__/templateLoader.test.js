/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let loadTemplateInto;
let sanitizeHTMLMock;

beforeEach(async () => {
  jest.unstable_mockModule('../htmlSanitizer.js', () => {
    sanitizeHTMLMock = jest.fn(() => '<div>Hi</div>');
    return { sanitizeHTML: sanitizeHTMLMock };
  });
  jest.resetModules();
  global.NodeFilter = window.NodeFilter;
  document.body.innerHTML = '<div id="cont"></div>';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '<div onclick="x()">Hi</div>' });
  ({ loadTemplateInto } = await import('../templateLoader.js'));
});

afterEach(() => {
  global.fetch.mockRestore && global.fetch.mockRestore();
});

test('loads and sanitizes template', async () => {
  await loadTemplateInto('/t.html', 'cont');
  expect(global.fetch).toHaveBeenCalledWith(new URL('/t.html', window.location.href));
  expect(sanitizeHTMLMock).toHaveBeenCalledWith('<div onclick="x()">Hi</div>');
  expect(document.getElementById('cont').innerHTML).toBe('<div>Hi</div>');
});

test('blocks cross-origin urls', async () => {
  global.fetch.mockClear();
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await loadTemplateInto('https://evil.com/x.html', 'cont');
  expect(global.fetch).not.toHaveBeenCalled();
  expect(document.getElementById('cont').innerHTML).toBe('');
  expect(errSpy).toHaveBeenCalledWith('Template load error:', expect.any(Error));
  errSpy.mockRestore();
});
