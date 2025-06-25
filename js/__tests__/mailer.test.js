import { jest } from '@jest/globals'

let sendWelcomeEmail, createTransportMock, sendMailMock

beforeEach(async () => {
    jest.resetModules()
    process.env.EMAIL_PASSWORD = 'pass'
    sendMailMock = jest.fn().mockResolvedValue(undefined)
    createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }))
    jest.unstable_mockModule('nodemailer', () => ({ default: { createTransport: createTransportMock } }))
    ;({ sendWelcomeEmail } = await import('../../mailer.js'))
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
        subject: 'Добре дошъл в MyBody!'
    }))
    expect(sendMailMock.mock.calls[0][0].html).toContain('Иван')
})

test('logs error on failure', async () => {
    const error = new Error('fail')
    sendMailMock.mockRejectedValueOnce(error)
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await sendWelcomeEmail('client@example.com', 'Иван')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
})
