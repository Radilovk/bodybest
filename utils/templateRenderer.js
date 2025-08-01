/**
 * Renders a template string by replacing {{key}} placeholders with values from data.
 * Missing keys are replaced with an empty string.
 * @param {string} str template text
 * @param {Record<string, unknown>} data values map
 * @returns {string} rendered string
 */
export function renderTemplate(str, data = {}) {
  return String(str).replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : ''
  );
}

export default { renderTemplate };
