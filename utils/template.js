export function renderTemplate(tpl, vars = {}) {
  return tpl.replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ''
  );
}

export default { renderTemplate };
