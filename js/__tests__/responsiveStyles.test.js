import fs from 'fs';

// Simple unit test to verify responsive CSS rules for meal list on very small screens

describe('responsive styles', () => {
  test('meal list actions collapse on small screens', () => {
    const css = fs.readFileSync('css/responsive_styles.css', 'utf8');
    const pattern = /@media \(max-width: 480px\)[\s\S]*?\.meal-list li \{[\s\S]*?padding:\s*var\(--space-xs\);[\s\S]*?\}[\s\S]*?\.meal-list li .actions \{[\s\S]*?flex-direction:\s*row;[\s\S]*?margin-top:\s*var\(--space-xs\);/;
    expect(css).toMatch(pattern);
  });
});
