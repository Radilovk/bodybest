import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()


/**
 * Send a welcome email to a newly registered user.
 * @param {string} toEmail recipient address
 * @param {string} userName user name for greeting
 */
export async function sendWelcomeEmail(toEmail, userName, template, env = process.env) {
    const defaultHtml = `<h2>Здравей, ${userName} 👋</h2>
<p>Благодарим ти, че се регистрира в <strong>MyBody</strong> – твоето пространство за здраве, балансирано хранене и осъзнат живот.</p>
<p>Нашата мисия е да ти помогнем да постигнеш целите си с яснота, подкрепа и научно обоснован подход.</p>
<p>Очаквай още полезни ресурси и съвети съвсем скоро.</p>
<p>Бъди здрав и вдъхновен!</p>
<p>– Екипът на MyBody</p>`
    const html = template || defaultHtml
    const transporter = nodemailer.createTransport({
        host: 'mybody.best',
        port: 465,
        secure: true,
        auth: {
            user: 'info@mybody.best',
            pass: env.EMAIL_PASSWORD
        }
    })

    try {
        await transporter.sendMail({
            from: 'info@mybody.best',
            to: toEmail,
            subject: 'Добре дошъл в MyBody!',
            html
        })
    } catch (error) {
        console.error('Failed to send welcome email:', error)
    }
}

