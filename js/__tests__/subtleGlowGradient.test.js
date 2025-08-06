/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { subtleGlowPlugin, GLOW_OFFSET } from '../chartLoader.js';

test('arc радиусът използва GLOW_OFFSET и вътрешният пръстен се коригира', () => {
  const arc = jest.fn();
  const ctx = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    arc,
    lineWidth: 0,
    shadowColor: '',
    shadowBlur: 0,
    fillStyle: ''
  };
  const element = {
    x: 10,
    y: 20,
    outerRadius: 50,
    innerRadius: 30,
    startAngle: 0,
    endAngle: Math.PI
  };
  const chart = {
    ctx,
    getSortedVisibleDatasetMetas: () => [{ index: 0, data: [element] }],
    data: { datasets: [{ backgroundColor: '#f00' }] }
  };

  subtleGlowPlugin.afterDatasetsDraw(chart);

  expect(ctx.lineWidth).toBe(GLOW_OFFSET);
  expect(arc).toHaveBeenNthCalledWith(
    1,
    element.x,
    element.y,
    element.outerRadius + GLOW_OFFSET,
    element.startAngle,
    element.endAngle
  );
  expect(arc).toHaveBeenNthCalledWith(
    2,
    element.x,
    element.y,
    element.innerRadius + 1,
    element.endAngle,
    element.startAngle,
    true
  );
});
