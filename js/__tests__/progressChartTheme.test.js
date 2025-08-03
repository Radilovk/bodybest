import { jest } from '@jest/globals';
import * as ui from '../populateUI.js';

// Mock getComputedStyle to provide CSS variables
function mockStyles(header, card = '#ffffff') {
  global.getComputedStyle = () => ({
    getPropertyValue: (prop) => {
      if (prop === '--secondary-color') return header;
      if (prop === '--card-bg') return card;
      return '';
    }
  });
}

function setup(header = '#123456', card = '#ffffff') {
  mockStyles(header, card);
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
    expect(ui.progressChartInstance.options.scales.y.ticks.color).toBe('#123456');
    expect(ui.progressChartInstance.data.datasets[0].backgroundColor).toContain(', 0.1)');
    expect(ui.progressChartInstance.options.scales.y.grid.color).toContain(', 0.1)');
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });

  test('uses stronger contrast on dark card background', () => {
    setup('#123456', '#000000');
    ui.updateProgressChartColors();
    expect(ui.progressChartInstance.data.datasets[0].backgroundColor).toContain(', 0.3)');
    expect(ui.progressChartInstance.options.scales.y.grid.color).toContain(', 0.2)');
  });

  test('event triggers color update', () => {
    document.dispatchEvent(new Event('progressChartThemeChange'));
    expect(ui.progressChartInstance.update).toHaveBeenCalled();
  });
});
