/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let populateUI;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <h1 id="headerTitle"></h1>
    <div id="goalCard"></div><div id="engagementCard"></div><div id="healthCard"></div>
    <div id="progressHistoryCard"></div>
    <div id="goalProgressFill"></div><div id="goalProgressBar"></div><span id="goalProgressText"></span>
    <div id="engagementProgressFill"></div><div id="engagementProgressBar"></div><span id="engagementProgressText"></span>
    <div id="healthProgressFill"></div><div id="healthProgressBar"></div><span id="healthProgressText"></span>
    <div id="streakGrid"></div>
    <div id="macroAnalyticsCard"><div id="macroMetricsGrid"></div><div id="macroCenterLabel"></div></div>
    <h3 id="dailyPlanTitle"></h3>
    <ul id="dailyMealList"></ul>
  `;

  const selectors = {
    headerTitle: document.getElementById('headerTitle'),
    goalCard: document.getElementById('goalCard'),
    engagementCard: document.getElementById('engagementCard'),
    healthCard: document.getElementById('healthCard'),
    progressHistoryCard: document.getElementById('progressHistoryCard'),
    goalProgressFill: document.getElementById('goalProgressFill'),
    goalProgressBar: document.getElementById('goalProgressBar'),
    goalProgressText: document.getElementById('goalProgressText'),
    engagementProgressFill: document.getElementById('engagementProgressFill'),
    engagementProgressBar: document.getElementById('engagementProgressBar'),
    engagementProgressText: document.getElementById('engagementProgressText'),
    healthProgressFill: document.getElementById('healthProgressFill'),
    healthProgressBar: document.getElementById('healthProgressBar'),
    healthProgressText: document.getElementById('healthProgressText'),
    streakGrid: document.getElementById('streakGrid'),
    macroAnalyticsCard: document.getElementById('macroAnalyticsCard'),
    macroMetricsGrid: document.getElementById('macroMetricsGrid'),
    macroCenterLabel: document.getElementById('macroCenterLabel'),
    dailyPlanTitle: document.getElementById('dailyPlanTitle'),
    dailyMealList: document.getElementById('dailyMealList')
  };
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    toggleMenu: jest.fn(),
    closeMenu: jest.fn(),
    handleOutsideMenuClick: jest.fn(),
    handleMenuKeydown: jest.fn(),
    toggleTheme: jest.fn(),
    activateTab: jest.fn(),
    handleTabKeydown: jest.fn(),
    closeModal: jest.fn(),
    openModal: jest.fn(),
    openInfoModalWithDetails: jest.fn(),
    toggleDailyNote: jest.fn(),
    openMainIndexInfo: jest.fn(),
    openInstructionsModal: jest.fn(),
    showLoading: jest.fn(),
    handleTrackerTooltipShow: jest.fn(),
    handleTrackerTooltipHide: jest.fn(),
    showToast: jest.fn(),
    loadAndApplyColors: jest.fn()
  }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {
      userName: 'Иван',
      analytics: {
        current: { goalProgress: 50, engagementScore: 80, overallHealthScore: 70 },
        streak: { dailyStatusArray: [{ date: '2024-01-01', logged: true }], currentCount: 5 }
      },
      planData: {},
      dailyLogs: [],
      currentStatus: {},
      initialData: {},
      initialAnswers: {}
    },
    todaysMealCompletionStatus: {},
    planHasRecContent: false
  }));
  ({ populateUI } = await import('../populateUI.js'));
});

test('populates dashboard sections', () => {
  populateUI();
  expect(document.getElementById('headerTitle').textContent).toBe('Табло: Иван');
  expect(document.getElementById('goalProgressText').textContent).toBe('50%');
  expect(document.getElementById('engagementProgressText').textContent).toBe('80%');
  expect(document.getElementById('healthProgressText').textContent).toBe('70%');
  expect(document.querySelectorAll('#streakGrid .streak-day.logged').length).toBe(1);
});

test('renders macro analytics card', async () => {
  jest.resetModules();
  const fullData = {
    userName: 'Иван',
    analytics: { current: {}, streak: {} },
    planData: {
      caloriesMacros: { calories: 1800, protein_grams: 120, protein_percent: 40, carbs_grams: 200, carbs_percent: 40, fat_grams: 50, fat_percent: 20 }
    },
    dailyLogs: [],
    currentStatus: {},
    initialData: {},
    initialAnswers: {}
  };
  jest.unstable_mockModule('../app.js', () => ({ fullDashboardData: fullData, todaysMealCompletionStatus: {}, planHasRecContent: false }));
  ({ populateUI } = await import('../populateUI.js'));
  populateUI();
  const metrics = document.querySelectorAll('#macroMetricsGrid .macro-metric');
  expect(metrics.length).toBe(4);
  expect(metrics[0].textContent).toContain('Калории');
  const canvas = document.querySelector('#macroAnalyticsCard canvas');
  expect(canvas).not.toBeNull();
});

test('macro metric click highlights element and updates center label', async () => {
  jest.resetModules();
  const fullData = {
    userName: 'Иван',
    analytics: { current: {}, streak: {} },
    planData: {
      caloriesMacros: { calories: 2000, protein_grams: 150, protein_percent: 30, carbs_grams: 250, carbs_percent: 50, fat_grams: 70, fat_percent: 20 }
    },
    dailyLogs: [],
    currentStatus: {},
    initialData: {},
    initialAnswers: {}
  };
  jest.unstable_mockModule('../app.js', () => ({ fullDashboardData: fullData, todaysMealCompletionStatus: {}, planHasRecContent: false }));
  ({ populateUI } = await import('../populateUI.js'));
  populateUI();
  const metric = document.querySelector('#macroMetricsGrid .macro-metric');
  metric.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(metric.classList.contains('active')).toBe(true);
  expect(document.getElementById('macroCenterLabel').textContent).toBe('Калории');
});

test('hides modules when values are zero', async () => {
  jest.resetModules();
  const zeroData = {
    fullDashboardData: {
      userName: 'Иван',
      analytics: { current: { goalProgress: 0, engagementScore: 0, overallHealthScore: 0 }, streak: {} },
      planData: {},
      dailyLogs: [],
      currentStatus: {},
      initialData: {},
      initialAnswers: {}
    },
    todaysMealCompletionStatus: {},
    planHasRecContent: false
  };
  jest.unstable_mockModule('../app.js', () => zeroData);
  ({ populateUI } = await import('../populateUI.js'));
  populateUI();
  expect(document.getElementById('goalCard').classList.contains('hidden')).toBe(true);
  expect(document.getElementById('engagementCard').classList.contains('hidden')).toBe(true);
  expect(document.getElementById('healthCard').classList.contains('hidden')).toBe(true);
  expect(document.getElementById('progressHistoryCard').classList.contains('hidden')).toBe(true);
});

test('populates daily plan with color bars and meal types', async () => {
  jest.resetModules();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const fullData = {
    userName: 'Иван',
    analytics: { current: {}, streak: {} },
    planData: {
      week1Menu: {
        [currentDayKey]: [
          { meal_name: 'Ранна закуска', items: [] },
          { meal_name: 'Вкусен обяд', items: [] },
          { meal_name: 'Лека вечеря', items: [] }
        ]
      }
    },
    dailyLogs: [],
    currentStatus: {},
    initialData: {},
    initialAnswers: {}
  };
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: fullData,
    todaysMealCompletionStatus: {},
    planHasRecContent: false
  }));
  ({ populateUI } = await import('../populateUI.js'));
  populateUI();
  const cards = document.querySelectorAll('#dailyMealList .meal-card');
  expect(cards.length).toBe(3);
  cards.forEach(card => {
    expect(card.querySelector('.meal-color-bar')).not.toBeNull();
    expect(card.dataset.day).toBeDefined();
    expect(card.dataset.index).toBeDefined();
    expect(card.querySelector('button.complete')).toBeNull();
  });
  expect(cards[0].dataset.mealType).toBe('breakfast');
  expect(cards[1].dataset.mealType).toBe('lunch');
  expect(cards[2].dataset.mealType).toBe('dinner');
});

test('handles meal type variations', async () => {
  jest.resetModules();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const fullData = {
    userName: 'Иван',
    analytics: { current: {}, streak: {} },
    planData: {
      week1Menu: {
        [currentDayKey]: [
          { meal_name: 'Ранна закуска', items: [] },
          { meal_name: 'Обедно хранене', items: [] },
          { meal_name: 'Вечерно хранене', items: [] }
        ]
      }
    },
    dailyLogs: [],
    currentStatus: {},
    initialData: {},
    initialAnswers: {}
  };
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: fullData,
    todaysMealCompletionStatus: {},
    planHasRecContent: false
  }));
  ({ populateUI } = await import('../populateUI.js'));
  populateUI();
  const cards = document.querySelectorAll('#dailyMealList .meal-card');
  expect(cards[0].dataset.mealType).toBe('breakfast');
  expect(cards[1].dataset.mealType).toBe('lunch');
  expect(cards[2].dataset.mealType).toBe('dinner');
});

test('applies success color to completed meal bar', async () => {
  jest.resetModules();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const mealStatusKey = `${currentDayKey}_0`;
  const fullData = {
    userName: 'Иван',
    analytics: { current: {}, streak: {} },
    planData: {
      week1Menu: {
        [currentDayKey]: [
          { meal_name: 'Вкусен обяд', items: [] }
        ]
      }
    },
    dailyLogs: [{ date: new Date().toISOString().split('T')[0], data: { completedMealsStatus: { [mealStatusKey]: true } } }],
    currentStatus: {},
    initialData: {},
    initialAnswers: {}
  };
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: fullData,
    todaysMealCompletionStatus: {},
    planHasRecContent: false
  }));
  ({ populateUI } = await import('../populateUI.js'));

  const style = document.createElement('style');
  style.textContent = `#dailyMealList li.completed .meal-color-bar { background-color: rgb(46, 204, 113); }`;
  document.head.appendChild(style);

  populateUI();
  const li = document.querySelector('#dailyMealList li.completed');
  expect(li).not.toBeNull();
  const color = getComputedStyle(li.querySelector('.meal-color-bar')).backgroundColor;
  expect(color).toBe('rgb(46, 204, 113)');
});

test('clicking a meal card toggles completion status', async () => {
  jest.resetModules();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const fullData = {
    userName: 'Иван',
    analytics: { current: {}, streak: {} },
    planData: {
      week1Menu: {
        [currentDayKey]: [
          { meal_name: 'Тестово хранене', items: [] }
        ]
      }
    },
    dailyLogs: [],
    currentStatus: {},
    initialData: {},
    initialAnswers: {}
  };

  jest.unstable_mockModule('../app.js', async () => {
    const realApp = await import('../app.js');
    return {
      ...realApp,
      fullDashboardData: fullData,
      todaysMealCompletionStatus: {},
      planHasRecContent: false
    };
  });

  const appState = await import('../app.js');

  ({ populateUI } = await import('../populateUI.js'));
  const { setupDynamicEventListeners } = await import('../eventListeners.js');

  populateUI();
  setupDynamicEventListeners();

  const card = document.querySelector('#dailyMealList .meal-card');
  card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(card.classList.contains('completed')).toBe(true);
  expect(appState.todaysMealCompletionStatus[`${currentDayKey}_0`]).toBe(true);
  const handlers = await import('../uiHandlers.js');
  expect(handlers.showToast).toHaveBeenCalled();
});

describe('progress bar width handling', () => {
  const setup = async (value) => {
    jest.resetModules();
    jest.unstable_mockModule('../app.js', () => ({
      fullDashboardData: {
        userName: 'Иван',
        analytics: {
          current: { goalProgress: value, engagementScore: value, overallHealthScore: value },
          streak: {}
        },
        planData: {},
        dailyLogs: [],
        currentStatus: {},
        initialData: {},
        initialAnswers: {}
      },
      todaysMealCompletionStatus: {},
      planHasRecContent: false
    }));
    ({ populateUI } = await import('../populateUI.js'));
    populateUI();
  };

  test.each([
    [50, '50%', false],
    [120, '100%', false],
    [-10, '', true],
    [0, '', true]
  ])('value %i sets width %s', async (val, expectedWidth, hidden) => {
    await setup(val);
    expect(document.getElementById('goalProgressFill').style.width).toBe(expectedWidth);
    expect(document.getElementById('engagementProgressFill').style.width).toBe(expectedWidth);
    expect(document.getElementById('healthProgressFill').style.width).toBe(expectedWidth);
    expect(document.getElementById('goalCard').classList.contains('hidden')).toBe(hidden);
    expect(document.getElementById('engagementCard').classList.contains('hidden')).toBe(hidden);
    expect(document.getElementById('healthCard').classList.contains('hidden')).toBe(hidden);
  });
});
