/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let populateUI;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <h1 id="headerTitle"></h1>
    <div id="goalProgressMask"></div><div id="goalProgressBar"></div><span id="goalProgressText"></span>
    <div id="engagementProgressMask"></div><div id="engagementProgressBar"></div><span id="engagementProgressText"></span>
    <div id="healthProgressMask"></div><div id="healthProgressBar"></div><span id="healthProgressText"></span>
    <div id="streakGrid"></div><span id="streakCount"></span>
  `;

  const selectors = {
    headerTitle: document.getElementById('headerTitle'),
    goalProgressMask: document.getElementById('goalProgressMask'),
    goalProgressBar: document.getElementById('goalProgressBar'),
    goalProgressText: document.getElementById('goalProgressText'),
    engagementProgressMask: document.getElementById('engagementProgressMask'),
    engagementProgressBar: document.getElementById('engagementProgressBar'),
    engagementProgressText: document.getElementById('engagementProgressText'),
    healthProgressMask: document.getElementById('healthProgressMask'),
    healthProgressBar: document.getElementById('healthProgressBar'),
    healthProgressText: document.getElementById('healthProgressText'),
    streakGrid: document.getElementById('streakGrid'),
    streakCount: document.getElementById('streakCount')
  };
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
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
  expect(document.getElementById('streakCount').textContent).toBe('5');
  expect(document.querySelectorAll('#streakGrid .streak-day.logged').length).toBe(1);
});
