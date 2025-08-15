/** @jest-environment node */
import { jest } from '@jest/globals';

describe('scheduleEndOfDaySave', () => {
  test('извиква autoSaveDailyLog при смяна на датата', async () => {
    global.document = { addEventListener: jest.fn() };
    global.window = { location: { hostname: 'localhost' } };
    const { scheduleEndOfDaySave, calcMsToMidnight } = await import('../app.js');

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-04-10T23:59:50'));
    const saveMock = jest.fn();
    const firstDelay = calcMsToMidnight();

    scheduleEndOfDaySave(saveMock);
    jest.advanceTimersByTime(firstDelay);
    await Promise.resolve();
    expect(saveMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    await Promise.resolve();
    expect(saveMock).toHaveBeenCalledTimes(2);
  });
});
