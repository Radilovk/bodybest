export async function sendEmailUniversal(to, subject, body, env = {}) {
  const endpoint = env.MAILER_ENDPOINT_URL || (typeof process !== 'undefined' ? process.env.MAILER_ENDPOINT_URL : undefined);
  if (endpoint) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, message: body })
    });
    if (!resp.ok) {
      throw new Error(`Mailer responded with ${resp.status}`);
    }
    return;
  }

  const { sendEmail } = await import('../sendEmailWorker.js');
  const phpEnv = { MAIL_PHP_URL: env.MAIL_PHP_URL || (typeof process !== 'undefined' ? process.env.MAIL_PHP_URL : undefined) };
  await sendEmail(to, subject, body, phpEnv);
}

export default { sendEmailUniversal };
