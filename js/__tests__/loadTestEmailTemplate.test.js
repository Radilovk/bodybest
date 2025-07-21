/** @jest-environment jsdom */
import { jest } from '@jest/globals'

let loadTemplate

beforeEach(async () => {
  jest.resetModules()
  document.body.innerHTML = `
    <textarea id="testEmailBody"></textarea>
    <button id="showStats"></button>
    <button id="sendQuery"></button>`
  global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '<h1>Hi</h1>' })
  ;({ loadTestEmailTemplate: loadTemplate } = await import('../admin.js'))
})

afterEach(() => {
  global.fetch && global.fetch.mockRestore()
})

test('loads welcome template into textarea', async () => {
  await loadTemplate()
  expect(global.fetch).toHaveBeenCalledWith('data/welcomeEmailTemplate.html')
  expect(document.getElementById('testEmailBody').value).toBe('<h1>Hi</h1>')
})
