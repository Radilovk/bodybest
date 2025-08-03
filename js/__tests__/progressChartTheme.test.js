import { jest } from '@jest/globals';
import * as ui from '../populateUI.js';

// Mock getComputedStyle to provide CSS variables
function mockStyles(primary, text, card = '#ffffff') {
  global.getComputedStyle = () => ({
    getPropertyValue: (prop) => {
      if (prop === '--primary-color') return primary;
      if (prop === '--text-color-primary') return text;
      if (prop === '--card-bg') return card;
      return '';
    }
  });
}

function setup(primary = '#123456', text = '#654321', card = '#ffffff') {
  mockStyles(primary, text, card);
  ui.__setProgressChartInstance({
    data: { datasets: [{ borderColor: '', backgroundColor: '' }] },
    options: {
      scales: { x: { ticks: {} }, y: { ticks: {}, title: {}, grid: {} } },
      plugins: { legend: { labels: {} } }
    },
    update: jest.fn()
  });
}

describe('updateProgressChartColors', () => {
  beforeEach(() => {
    setup();
  });

  test('applies colors based on CSS variables', () => {
    ui.updateProgressChartColors();
    expect(ui.progressChartInstance.data.datasets[0].borderColor).toBe('#123456');
    expect(ui.progressChartInstance.options.scales.y.ticks.color).toBe('#654321');
    expect(ui.progressChartInstance.data.datasets[0].backgroundColor).toContain(', 0.1)');
    expect(ui.progressChartInstance.options.scales.y.grid.color).toContain(', 0.1)');
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });

  test('uses stronger contrast on dark card background', () => {
    setup('#123456', '#eeeeee', '#000000');
    ui.updateProgressChartColors();
    expect(ui.progressChartInstance.data.datasets[0].backgroundColor).toContain(', 0.3)');
    expect(ui.progressChartInstance.options.scales.y.grid.color).toContain(', 0.2)');
  });

  test('event triggers color update', () => {
    document.dispatchEvent(new Event('progressChartThemeChange'));
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });
});
