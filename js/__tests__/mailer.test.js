import { jest } from '@jest/globals'

let sendWelcomeEmail

beforeEach(async () => {
    jest.resetModules()
    process.env.WORKER_URL = 'https://api'
    process.env.MAIL_PHP_URL = 'https://php/send'
    global.fetch = jest.fn()
    global.fetch
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, config: { welcome_email_subject: 'Тест', welcome_email_body: '<p>Hello {{name}}</p>' } })
        })
        .mockResolvedValueOnce({ ok: true })
    ;({ sendWelcomeEmail } = await import('../../mailer.js'))
})

afterEach(() => {
    global.fetch.mockRestore()
    delete process.env.WORKER_URL
    delete process.env.MAIL_PHP_URL
})

test('sends welcome email with correct options', async () => {
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://api/api/getAiConfig')
    const [, options] = global.fetch.mock.calls[1]
    expect(global.fetch.mock.calls[1][0]).toBe('https://php/send')
    const body = JSON.parse(options.body)
    expect(body.to).toBe('client@example.com')
    expect(body.subject).toBe('Тест')
    expect(body.message).toContain('Hello Иван')
})

test('logs error on failure', async () => {
    const error = new Error('fail')
    global.fetch.mockReset()
    global.fetch
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, config: { welcome_email_subject: 'Тест', welcome_email_body: '<p>Hello {{name}}</p>' } })
        })
        .mockRejectedValueOnce(error)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
})
