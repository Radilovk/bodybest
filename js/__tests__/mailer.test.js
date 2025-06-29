import { jest } from '@jest/globals'

let sendWelcomeEmail

beforeEach(async () => {
    jest.resetModules()
    process.env.MAIL_PHP_URL = 'https://mail'
    process.env.WORKER_URL = 'https://api'
    global.fetch = jest.fn()
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                config: {
                    welcome_email_subject: 'Тест',
                    welcome_email_body: '<p>Hello {{name}}</p>'
                }
            })
        })
        .mockResolvedValueOnce({ ok: true, text: async () => '' })
    ;({ sendWelcomeEmail } = await import('../../mailer.js'))
})

afterEach(() => {
    global.fetch.mockRestore()
    delete process.env.WORKER_URL
    delete process.env.MAIL_PHP_URL
})

test('sends welcome email with correct options', async () => {
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://mail', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: 'client@example.com',
            subject: 'Тест',
            message: '<p>Hello Иван</p>'
        })
    }))
})

test('logs error on failure', async () => {
    global.fetch.mockReset()
    global.fetch
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                config: {
                    welcome_email_subject: 'Тест',
                    welcome_email_body: '<p>Hello {{name}}</p>'
                }
            })
        })
        .mockRejectedValueOnce(new Error('fail'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
})
