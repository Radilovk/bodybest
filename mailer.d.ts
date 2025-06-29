/** Send an HTML email via the MAIL_PHP_URL endpoint */
export function sendEmail(to: string, subject: string, html: string): Promise<void>;
/** Prepare template and dispatch a welcome message */
export function sendWelcomeEmail(to: string, name: string): Promise<void>;
