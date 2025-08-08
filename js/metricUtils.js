import { trackerInfoTexts } from './uiElements.js';

/**
 * Връща текстовото описание за даден показател и стойност.
 * @param {string} key - Ключът на показателя (напр. 'energy').
 * @param {number} value - Стойност 1-5.
 * @returns {string} Описание на нивото или fallback текст.
 */
export function getMetricDescription(key, value) {
    const desc = trackerInfoTexts[key]?.levels?.[value];
    return desc || `Оценка ${value} от 5`;
}
