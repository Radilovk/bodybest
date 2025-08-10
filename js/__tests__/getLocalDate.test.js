import timezoneMock from 'timezone-mock';
import { getLocalDate } from '../utils.js';

afterEach(() => {
  timezoneMock.unregister();
});

test('getLocalDate връща коректна дата в локална полунощ', () => {
  timezoneMock.register('Europe/Sofia');
  const fakeNow = new Date('2023-12-31T22:30:00Z'); // 2024-01-01 00:30 локално
  expect(fakeNow.toISOString().split('T')[0]).toBe('2023-12-31');
  expect(getLocalDate(fakeNow)).toBe('2024-01-01');
});
