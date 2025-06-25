import { jest } from '@jest/globals'

let sendWelcomeEmail, originalFetch

beforeEach(async () => {
    jest.resetModules()
    originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    ;({ sendWelcomeEmail } = await import('../../mailer.js'))
})

afterEach(() => {
    global.fetch = originalFetch
})

test('sends welcome email with correct options', async () => {
    await sendWelcomeEmail('client@example.com', 'Иван', undefined, { SENDGRID_API_KEY: 'key' })
    expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
            method: 'POST',
            headers: {
                Authorization: 'Bearer key',
                'Content-Type': 'application/json'
            }
        })
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.from.email).toBe('info@mybody.best')
    expect(body.personalizations[0].to[0].email).toBe('client@example.com')
    expect(body.content[0].value).toContain('Иван')
})

test('logs error on failure', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad' })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await sendWelcomeEmail('client@example.com', 'Иван', undefined, { SENDGRID_API_KEY: 'key' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
})
