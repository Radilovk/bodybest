import { jest } from '@jest/globals'
import { readFileSync } from 'fs'

let sendWelcomeEmail

beforeEach(async () => {
    jest.resetModules()
    process.env.MAIL_PHP_URL = 'https://mail'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' })
    ;({ sendWelcomeEmail } = await import('../../mailer.js'))
})

afterEach(() => {
    global.fetch.mockRestore()
    delete process.env.MAIL_PHP_URL
})

test('sends welcome email with correct options', async () => {
    const expected = readFileSync('data/welcomeEmailTemplate.html', 'utf8').replace(/{{\s*name\s*}}/g, 'Иван')
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(global.fetch).toHaveBeenCalledWith('https://mail', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: 'client@example.com',
            subject: 'Добре дошъл в MyBody!',
            message: expected
        })
    }))
})

test('logs error on failure', async () => {
    global.fetch.mockReset()
    global.fetch.mockRejectedValueOnce(new Error('fail'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
})
