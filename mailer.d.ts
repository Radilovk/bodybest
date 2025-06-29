/** Send an email through the PHP backend configured by `MAIL_PHP_URL`. */
export function sendEmail(to: string, subject: string, html: string): Promise<void>;
export function sendWelcomeEmail(to: string, name: string): Promise<void>;
