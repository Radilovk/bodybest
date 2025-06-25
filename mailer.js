// Module for sending transactional emails via the SendGrid HTTP API.
// Requires `SENDGRID_API_KEY` binding when deploying the worker.

/**
 * Send a welcome email to a newly registered user.
 * @param {string} toEmail recipient address
 * @param {string} userName user name for greeting
 */
export async function sendWelcomeEmail(toEmail, userName, htmlTemplate, env) {
    const defaultHtml = `<h2>Здравей, ${userName} 👋</h2>
<p>Благодарим ти, че се регистрира в <strong>MyBody</strong> – твоето пространство за здраве, балансирано хранене и осъзнат живот.</p>
<p>Нашата мисия е да ти помогнем да постигнеш целите си с яснота, подкрепа и научно обоснован подход.</p>
<p>Очаквай още полезни ресурси и съвети съвсем скоро.</p>
<p>Бъди здрав и вдъхновен!</p>
<p>– Екипът на MyBody</p>`
    const html = htmlTemplate ? htmlTemplate.replace(/%%USER_NAME%%/g, userName) : defaultHtml
    const apiKey = env?.SENDGRID_API_KEY
    if (!apiKey) {
        console.error('Missing SENDGRID_API_KEY')
        return
    }

    try {
        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: toEmail }] }],
                from: { email: 'info@mybody.best' },
                subject: 'Добре дошъл в MyBody!',
                content: [{ type: 'text/html', value: html }]
            })
        })
        if (!resp.ok) {
            const text = await resp.text()
            console.error('Failed to send welcome email:', resp.status, text)
        }
    } catch (error) {
        console.error('Failed to send welcome email:', error)
    }
}
