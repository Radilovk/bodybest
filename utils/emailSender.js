/**
 * Унифицирано изпращане на имейл.
 * При зададен MAILER_ENDPOINT_URL заявката се изпраща към него,
 * в противен случай се използва помощния worker.
 *
 * @param {string} to     Получател
 * @param {string} subject Тема
 * @param {string} body    HTML съдържание
 * @param {Record<string,string>} [env] допълнителни променливи
 * Тялото се изпраща като `message` и `body` в JSON заявката,
 * за да е съвместимо с различни API услуги.
*/
export async function sendEmailUniversal(to, subject, body, env = {}) {
  const endpoint = env.MAILER_ENDPOINT_URL ||
    globalThis['process']?.env?.MAILER_ENDPOINT_URL;
  if (endpoint) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, message: body, body })
    });
    if (!resp.ok) {
      throw new Error(`Mailer responded with ${resp.status}`);
    }
    return;
  }

  const { sendEmail } = await import('../sendEmailWorker.js');
  const phpEnv = { MAIL_PHP_URL: env.MAIL_PHP_URL || globalThis['process']?.env?.MAIL_PHP_URL };
  await sendEmail(to, subject, body, phpEnv);
}

export default { sendEmailUniversal };
