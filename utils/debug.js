/**
 * Записва макро payload за нуждите на дебъг.
 * Ако е налична Node среда, записва в data/macroPayloadDebug.json.
 * В противен случай изпраща POST заявка към '/macroPayloadDebug'.
 * @param {unknown} payload
 */
export async function logMacroPayload(payload) {
    try {
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            await fetch('/macroPayloadDebug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            const { writeFile } = await import('fs/promises');
            const { resolve } = await import('path');
            const filePath = resolve('data', 'macroPayloadDebug.json');
            await writeFile(filePath, JSON.stringify(payload, null, 2));
        }
    } catch (err) {
        console.error('Failed to log macro payload:', err);
    }
}

export default { logMacroPayload };
