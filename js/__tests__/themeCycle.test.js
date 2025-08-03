/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('theme cycling', () => {
  let toggleTheme, applyTheme, updateThemeButtonText, initializeTheme;
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = '<button id="theme-toggle-menu"><span class="menu-icon"></span><span class="theme-text"></span></button>';
    global.matchMedia = global.matchMedia || function() {
      return { matches: false, addEventListener: jest.fn() };
    };
    jest.unstable_mockModule('../uiElements.js', () => ({
      selectors: { themeToggleMenu: document.getElementById('theme-toggle-menu') },
      trackerInfoTexts: {},
      detailedMetricInfoTexts: {},
      mainIndexInfoTexts: {},
      initializeSelectors: jest.fn(),
      loadInfoTexts: jest.fn()
    }));
    jest.unstable_mockModule('../adminConfig.js', () => ({ loadConfig: jest.fn() }));
    jest.unstable_mockModule('../app.js', () => ({
      fullDashboardData: {},
      activeTooltip: null,
      setActiveTooltip: jest.fn(),
      todaysMealCompletionStatus: {},
      todaysExtraMeals: [],
      currentIntakeMacros: {},
      planHasRecContent: false,
      loadCurrentIntake: jest.fn()
    }));
    ({ toggleTheme, applyTheme, updateThemeButtonText, initializeTheme } = await import('../uiHandlers.js'));
  });

  test('initializeTheme applies saved vivid theme', () => {
    localStorage.setItem('theme', 'vivid');
    initializeTheme();
    expect(document.body.classList.contains('vivid-theme')).toBe(true);
  });

  test('toggleTheme cycles light -> dark -> vivid -> light', () => {
    applyTheme('light');
    updateThemeButtonText();
    expect(document.querySelector('.theme-text').textContent).toBe('Тъмна Тема');

    toggleTheme();
    updateThemeButtonText();
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    expect(document.querySelector('.theme-text').textContent).toBe('Ярка Тема');

    toggleTheme();
    updateThemeButtonText();
    expect(document.body.classList.contains('vivid-theme')).toBe(true);
    expect(document.querySelector('.theme-text').textContent).toBe('Цветна Тема');
  });
});
