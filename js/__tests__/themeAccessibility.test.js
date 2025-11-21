/**
 * themeAccessibility.test.js
 * Tests за accessibility и contrast на themes
 */

import axe from 'axe-core';

describe('Theme Accessibility Tests', () => {
  let container;

  beforeEach(() => {
    // Create a test container
    container = document.createElement('div');
    container.innerHTML = `
      <div id="test-app">
        <header style="background: var(--primary-color); color: var(--text-color-on-primary); padding: 1rem;">
          <h1>Test Header</h1>
        </header>
        <main style="background: var(--bg-color); color: var(--text-color-primary); padding: 2rem;">
          <div style="background: var(--card-bg); padding: 1rem; margin-bottom: 1rem;">
            <h2>Card Title</h2>
            <p style="color: var(--text-color-secondary);">Secondary text content</p>
            <p style="color: var(--text-color-muted);">Muted text content</p>
          </div>
          <button style="background: var(--primary-color); color: var(--text-color-on-primary); padding: 0.5rem 1rem; border: none;">
            Primary Button
          </button>
          <button style="background: var(--secondary-color); color: var(--text-color-on-secondary); padding: 0.5rem 1rem; border: none; margin-left: 0.5rem;">
            Secondary Button
          </button>
        </main>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Reset theme
    document.body.className = '';
  });

  /**
   * Helper: Runs axe accessibility check
   */
  async function runAxeCheck(context = container) {
    const results = await axe.run(context, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: false } // WCAG AAA не е задължително
      }
    });
    return results;
  }

  /**
   * Helper: Checks if contrast ratio meets WCAG AA standards
   */
  function checkContrastRatio(foreground, background, largeText = false) {
    // WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text
    const requiredRatio = largeText ? 3 : 4.5;
    
    const fgRgb = parseColor(foreground);
    const bgRgb = parseColor(background);
    
    if (!fgRgb || !bgRgb) {
      throw new Error(`Invalid colors: ${foreground}, ${background}`);
    }
    
    const ratio = calculateContrastRatio(fgRgb, bgRgb);
    return {
      ratio,
      passes: ratio >= requiredRatio,
      required: requiredRatio
    };
  }

  /**
   * Parse color string to RGB
   */
  function parseColor(color) {
    // Simple RGB parser - в реални tests може да се използва библиотека
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    const computed = window.getComputedStyle(div).color;
    document.body.removeChild(div);
    
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    return null;
  }

  /**
   * Calculate contrast ratio between two RGB colors
   */
  function calculateContrastRatio(rgb1, rgb2) {
    const l1 = getRelativeLuminance(rgb1);
    const l2 = getRelativeLuminance(rgb2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Get relative luminance of an RGB color
   */
  function getRelativeLuminance(rgb) {
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;
    
    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Get computed CSS variable value
   */
  function getCSSVariable(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  describe('Light Theme Accessibility', () => {
    beforeEach(() => {
      document.body.classList.add('light-theme');
    });

    test('should have sufficient contrast for primary text on background', () => {
      const textColor = getCSSVariable('--text-color-primary');
      const bgColor = getCSSVariable('--bg-color');
      
      const result = checkContrastRatio(textColor, bgColor);
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('should have sufficient contrast for text on primary color', () => {
      const textColor = getCSSVariable('--text-color-on-primary');
      const primaryColor = getCSSVariable('--primary-color');
      
      const result = checkContrastRatio(textColor, primaryColor);
      expect(result.passes).toBe(true);
    });

    test('should have sufficient contrast for card text', () => {
      const textColor = getCSSVariable('--text-color-primary');
      const cardBg = getCSSVariable('--card-bg');
      
      const result = checkContrastRatio(textColor, cardBg);
      expect(result.passes).toBe(true);
    });

    test('should pass axe color-contrast checks', async () => {
      const results = await runAxeCheck();
      
      // Filter only color-contrast violations
      const contrastViolations = results.violations.filter(
        v => v.id === 'color-contrast'
      );
      
      expect(contrastViolations.length).toBe(0);
    });
  });

  describe('Dark Theme Accessibility', () => {
    beforeEach(() => {
      document.body.classList.add('dark-theme');
    });

    test('should have sufficient contrast for primary text on background', () => {
      const textColor = getCSSVariable('--text-color-primary');
      const bgColor = getCSSVariable('--bg-color');
      
      const result = checkContrastRatio(textColor, bgColor);
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('should have sufficient contrast for text on primary color', () => {
      const textColor = getCSSVariable('--text-color-on-primary');
      const primaryColor = getCSSVariable('--primary-color');
      
      const result = checkContrastRatio(textColor, primaryColor);
      expect(result.passes).toBe(true);
    });

    test('should have sufficient contrast for secondary text', () => {
      const textColor = getCSSVariable('--text-color-secondary');
      const bgColor = getCSSVariable('--bg-color');
      
      const result = checkContrastRatio(textColor, bgColor);
      expect(result.passes).toBe(true);
    });

    test('should pass axe color-contrast checks', async () => {
      const results = await runAxeCheck();
      
      const contrastViolations = results.violations.filter(
        v => v.id === 'color-contrast'
      );
      
      expect(contrastViolations.length).toBe(0);
    });
  });

  describe('Vivid Theme Accessibility', () => {
    beforeEach(() => {
      document.body.classList.add('vivid-theme');
    });

    test('should have sufficient contrast for primary text on background', () => {
      const textColor = getCSSVariable('--text-color-primary');
      const bgColor = getCSSVariable('--bg-color');
      
      const result = checkContrastRatio(textColor, bgColor);
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('should have sufficient contrast for text on primary color', () => {
      const textColor = getCSSVariable('--text-color-on-primary');
      const primaryColor = getCSSVariable('--primary-color');
      
      const result = checkContrastRatio(textColor, primaryColor);
      expect(result.passes).toBe(true);
    });

    test('should have sufficient contrast for text on secondary color', () => {
      const textColor = getCSSVariable('--text-color-on-secondary');
      const secondaryColor = getCSSVariable('--secondary-color');
      
      const result = checkContrastRatio(textColor, secondaryColor);
      expect(result.passes).toBe(true);
    });

    test('should pass axe color-contrast checks', async () => {
      const results = await runAxeCheck();
      
      const contrastViolations = results.violations.filter(
        v => v.id === 'color-contrast'
      );
      
      // Vivid theme може да има по-малко violations поради по-високия contrast
      expect(contrastViolations.length).toBe(0);
    });

    test('should have high contrast for accent colors', () => {
      // Vivid theme трябва да има по-висок contrast
      const accentColor = getCSSVariable('--accent-color');
      const bgColor = getCSSVariable('--bg-color');
      
      const result = checkContrastRatio(accentColor, bgColor, true);
      // За vivid очакваме поне 3:1 за large text
      expect(result.ratio).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Cross-theme Consistency', () => {
    test('all themes should define required CSS variables', () => {
      const requiredVars = [
        '--text-color-primary',
        '--text-color-secondary',
        '--text-color-muted',
        '--bg-color',
        '--card-bg',
        '--primary-color',
        '--secondary-color',
        '--text-color-on-primary',
        '--text-color-on-secondary'
      ];

      const themes = ['light-theme', 'dark-theme', 'vivid-theme'];

      themes.forEach(theme => {
        document.body.className = theme;
        
        requiredVars.forEach(varName => {
          const value = getCSSVariable(varName);
          expect(value).toBeTruthy();
          expect(value).not.toBe('');
        });
      });
    });

    test('all themes should maintain minimum contrast ratios', () => {
      const themes = ['light-theme', 'dark-theme', 'vivid-theme'];
      
      themes.forEach(theme => {
        document.body.className = theme;
        
        const textColor = getCSSVariable('--text-color-primary');
        const bgColor = getCSSVariable('--bg-color');
        
        const result = checkContrastRatio(textColor, bgColor);
        
        expect(result.passes).toBe(true);
      });
    });
  });
});
