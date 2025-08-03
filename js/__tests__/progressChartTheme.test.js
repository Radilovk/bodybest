import { jest } from '@jest/globals';
import * as ui from '../populateUI.js';

// Mock getComputedStyle to provide CSS variables
function mockStyles(primary, text) {
  global.getComputedStyle = () => ({
    getPropertyValue: (prop) => {
      if (prop === '--primary-color') return primary;
      if (prop === '--text-color-primary') return text;
      return '';
    }
  });
}

describe('updateProgressChartColors', () => {
  beforeEach(() => {
    mockStyles('#123456', '#654321');
    ui.__setProgressChartInstance({
      data: { datasets: [{ borderColor: '', backgroundColor: '' }] },
      options: {
        scales: { x: { ticks: {} }, y: { ticks: {}, title: {}, grid: {} } },
        plugins: { legend: { labels: {} } }
      },
      update: jest.fn()
    });
  });

  test('applies colors based on CSS variables', () => {
    ui.updateProgressChartColors();
    expect(ui.progressChartInstance.data.datasets[0].borderColor).toBe('#123456');
    expect(ui.progressChartInstance.options.scales.y.ticks.color).toBe('#654321');
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });

  test('event triggers color update', () => {
    document.dispatchEvent(new Event('progressChartThemeChange'));
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });
});
