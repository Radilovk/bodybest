import fs from 'fs';

// Проверяваме дали правилото за .meal-list li.completed съдържа коректен цвят
// за бордера

describe('dashboard_panel_styles.css', () => {
  test('completed meal border-left color', () => {
    const css = fs.readFileSync('css/dashboard_panel_styles.css', 'utf8');
    const ruleMatch = css.match(/\.meal-list li\.completed\s*{([^}]*)}/);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch[1];
    const borderMatch = rule.match(/border-left:\s*([^;]+);/);
    expect(borderMatch).not.toBeNull();
    const border = borderMatch[1].trim();
    expect(border).toBe(
      '2px solid color-mix(in srgb, var(--meal-color) 60%, white)'
    );
  });
});
