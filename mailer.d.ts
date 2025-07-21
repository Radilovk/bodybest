/** Send an HTML email using available mailing endpoint */
export function sendEmail(to: string, subject: string, html: string): Promise<void>;
/** Prepare template and dispatch a welcome message */
export function sendWelcomeEmail(to: string, name: string): Promise<void>;
