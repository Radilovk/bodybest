import { jest } from '@jest/globals'

let sendWelcomeEmail, createTransportMock, sendMailMock

beforeEach(async () => {
    jest.resetModules()
    process.env.EMAIL_PASSWORD = 'pass'
    process.env.WORKER_URL = 'https://api'
    sendMailMock = jest.fn().mockResolvedValue(undefined)
    createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }))
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, config: { welcome_email_subject: 'Тест', welcome_email_body: '<p>Hello {{name}}</p>' } })
    })
    jest.unstable_mockModule('nodemailer', () => ({ default: { createTransport: createTransportMock } }))
    ;({ sendWelcomeEmail } = await import('../../mailer.js'))
})

afterEach(() => {
    global.fetch.mockRestore()
    delete process.env.WORKER_URL
})

test('sends welcome email with correct options', async () => {
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(createTransportMock).toHaveBeenCalledWith({
        host: 'mybody.best',
        port: 465,
        secure: true,
        auth: { user: 'info@mybody.best', pass: 'pass' }
    })
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        from: 'info@mybody.best',
        to: 'client@example.com',
        subject: 'Тест'
    }))
    expect(sendMailMock.mock.calls[0][0].html).toContain('Hello Иван')
})

test('logs error on failure', async () => {
    const error = new Error('fail')
    sendMailMock.mockRejectedValueOnce(error)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
})
