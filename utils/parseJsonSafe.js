/**
 * Parse JSON from a Response object with extra error handling.
 * Logs the raw response text when JSON parsing fails.
 * @param {Response} resp
 * @param {string} [label='response'] label used in the log message
 * @returns {Promise<any>}
 */
export async function parseJsonSafe(resp, label = 'response') {
    try {
        return await resp.json();
    } catch {
        const bodyText = await resp.clone().text().catch(() => '[unavailable]');
        console.error(`Failed to parse JSON from ${label}:`, bodyText);
        throw new Error('Invalid JSON response');
    }
}
