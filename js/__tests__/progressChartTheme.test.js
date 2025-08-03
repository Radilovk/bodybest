import { jest } from '@jest/globals';
import * as ui from '../populateUI.js';

// Mock getComputedStyle to provide CSS variables
function mockStyles(secondary, text, border) {
  global.getComputedStyle = () => ({
    getPropertyValue: (prop) => {
      if (prop === '--secondary-color') return secondary;
      if (prop === '--text-color-primary') return text;
      if (prop === '--border-color') return border;
      return '';
    }
  });
}

describe('updateProgressChartColors', () => {
  beforeEach(() => {
    mockStyles('#123456', '#654321', '#abcdef');
    ui.__setProgressChartInstance({
      data: { datasets: [{ borderColor: '', backgroundColor: '' }] },
      options: {
        scales: { x: { ticks: {} }, y: { ticks: {}, title: {}, grid: {} } },
        plugins: { legend: { labels: {} } }
      },
      update: jest.fn()
    });
  });

  function addAlpha(color, alpha) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  test('applies colors based on CSS variables', () => {
    ui.updateProgressChartColors();
    expect(ui.progressChartInstance.data.datasets[0].borderColor).toBe('#123456');
    expect(ui.progressChartInstance.options.scales.y.ticks.color).toBe('#654321');
    expect(ui.progressChartInstance.options.scales.y.grid.color).toBe(addAlpha('#abcdef', 0.3));
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });

  test('event triggers color update', () => {
    document.dispatchEvent(new Event('progressChartThemeChange'));
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });
});
