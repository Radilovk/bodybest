/** @jest-environment jsdom */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../uiElements.js', () => ({ selectors: {} }));
jest.unstable_mockModule('../uiHandlers.js', () => ({ openModal: jest.fn(), openInstructionsModal: jest.fn(), loadAndApplyColors: jest.fn() }));
jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));

let shareAchievement;

beforeEach(async () => {
  ({ shareAchievement } = await import('../achievements.js'));
});

describe('shareAchievement', () => {
  test('uses navigator.share when available', async () => {
    const shareMock = jest.fn().mockResolvedValue();
    Object.assign(navigator, { share: shareMock });
    document.body.innerHTML = `<div id="achievementModalTitle">t</div><div id="achievementModalBody">m</div>`;
    await shareAchievement();
    expect(shareMock).toHaveBeenCalled();
  });

  test('falls back to clipboard when share not available', async () => {
    delete navigator.share;
    const clipMock = { writeText: jest.fn().mockResolvedValue() };
    Object.assign(navigator, { clipboard: clipMock });
    document.body.innerHTML = `<div id="achievementModalTitle">t</div><div id="achievementModalBody">m</div>`;
    await shareAchievement();
    expect(clipMock.writeText).toHaveBeenCalled();
  });
});
