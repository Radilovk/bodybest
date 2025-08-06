import { jest } from '@jest/globals';
import { subtleGlowPlugin } from '../chartLoader.js';

test('subtleGlowPlugin създава радиален градиент с правилни параметри', () => {
  const gradientMock = { addColorStop: jest.fn() };
  const ctx = {
    createRadialGradient: jest.fn(() => gradientMock),
    beginPath: jest.fn(),
    arc: jest.fn(),
    stroke: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    lineWidth: 0,
    strokeStyle: ''
  };

  const chart = {
    ctx,
    data: { datasets: [{ backgroundColor: '#ff0000' }] },
    getSortedVisibleDatasetMetas: () => ([{
      index: 0,
      data: [{
        x: 10,
        y: 20,
        outerRadius: 30,
        innerRadius: 15,
        startAngle: 0,
        endAngle: Math.PI / 2
      }]
    }])
  };

  subtleGlowPlugin.afterDatasetsDraw(chart);

  expect(ctx.createRadialGradient).toHaveBeenCalledWith(10, 20, 0, 10, 20, 40);
  const innerStop = 30 / 40;
  expect(gradientMock.addColorStop).toHaveBeenNthCalledWith(1, 0, '#ff0000');
  expect(gradientMock.addColorStop).toHaveBeenNthCalledWith(2, innerStop, '#ff0000');
  expect(gradientMock.addColorStop).toHaveBeenNthCalledWith(3, 1, 'transparent');
});
