import dotenv from 'dotenv'
import fs from 'fs/promises'
import { sendEmailUniversal } from './utils/emailSender.js'

dotenv.config()

const DEFAULT_SUBJECT = 'Добре дошъл в MyBody!'
const DEFAULT_BODY = `<h2>Здравей, {{name}} 👋</h2>
<p>Благодарим ти, че се регистрира в <strong>MyBody</strong> – твоето пространство за здраве, балансирано хранене и осъзнат живот.</p>
<p>Очаквай още полезни ресурси и съвети съвсем скоро.</p>
<p>Бъди здрав и вдъхновен!</p>
<p>– Екипът на MyBody</p>`



/**
 * Send a welcome email to a newly registered user.
 * @param {string} toEmail recipient address
 * @param {string} userName user name for greeting
 */
async function getEmailTemplate() {
    const envSubject = process.env.WELCOME_EMAIL_SUBJECT
    const envBody = process.env.WELCOME_EMAIL_BODY
    if (envSubject || envBody) {
        return {
            subject: envSubject || DEFAULT_SUBJECT,
            body: envBody || DEFAULT_BODY
        }
    }
    const workerUrl = process.env.WORKER_URL
    if (workerUrl) {
        try {
            const resp = await fetch(`${workerUrl}/api/getAiConfig`)
            const data = await resp.json()
            if (resp.ok && data.success) {
                const cfg = data.config || {}
                if (cfg.welcome_email_subject || cfg.welcome_email_body) {
                    return {
                        subject: cfg.welcome_email_subject || DEFAULT_SUBJECT,
                        body: cfg.welcome_email_body || DEFAULT_BODY
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch email template:', err)
        }
    }
    try {
        const body = await fs.readFile('./data/welcomeEmailTemplate.html', 'utf8')
        return { subject: DEFAULT_SUBJECT, body }
    } catch {
        return { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY }
    }
}

/**
 * Send an email via the configured PHP endpoint.
 * @param {string} toEmail recipient address
 * @param {string} subject email subject line
 * @param {string} html email HTML content
 * @returns {Promise<void>} resolves when the message is sent
 */
export async function sendEmail(toEmail, subject, html) {
    await sendEmailUniversal(toEmail, subject, html, process.env)
}

export async function sendWelcomeEmail(toEmail, userName) {
    const tpl = await getEmailTemplate()
    const html = tpl.body.replace(/{{\s*name\s*}}/g, userName)
    try {
        await sendEmail(toEmail, tpl.subject, html)
    } catch (error) {
        console.error('Failed to send welcome email:', error)
    }
}

