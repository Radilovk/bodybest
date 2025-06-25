/** @jest-environment jsdom */
import { jest } from '@jest/globals'

let sendTestEmail

beforeEach(async () => {
  jest.resetModules()
  document.body.innerHTML = `
    <button id="showStats"></button>
    <button id="sendQuery"></button>
    <input id="adminToken" />`
  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { sendTestEmail: '/api/sendTestEmail' }
  }))
  const mod = await import('../admin.js')
  sendTestEmail = mod.sendTestEmail
})

afterEach(() => {
  global.fetch && global.fetch.mockRestore()
  window.alert && window.alert.mockRestore && window.alert.mockRestore()
})

test('sends POST request with auth header and shows success alert', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  window.alert = jest.fn()
  document.getElementById('adminToken').value = 'tok'
  await sendTestEmail('a@b.com')
  expect(global.fetch).toHaveBeenCalledWith('/api/sendTestEmail', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ Authorization: 'Bearer tok' })
  }))
  const body = JSON.parse(global.fetch.mock.calls[0][1].body)
  expect(body).toEqual({ email: 'a@b.com' })
  expect(window.alert).toHaveBeenCalledWith('Тестовият имейл е изпратен.')
})

test('shows error alert on failure response', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, message: 'fail' }) })
  window.alert = jest.fn()
  await sendTestEmail('a@b.com')
  expect(window.alert).toHaveBeenCalledWith('fail')
})
