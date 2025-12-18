// mealAlternatives.test.js - Tests for meal alternatives modal functionality

/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import { openMealAlternativesModal, setupMealAlternativesListeners } from '../mealAlternatives.js';

// Mock dependencies
jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: {
        generateMealAlternatives: '/api/generateMealAlternatives',
        updatePlanData: '/api/updatePlanData'
    }
}));

jest.unstable_mockModule('../uiHandlers.js', () => ({
    showToast: jest.fn()
}));

describe('Meal Alternatives Modal', () => {
    let modal, loadingDiv, alternativesList, modalTitle;

    beforeEach(() => {
        // Setup DOM structure
        document.body.innerHTML = `
            <div id="mealAlternativesModal" class="modal" aria-hidden="true">
                <div class="modal-content">
                    <button data-modal-close="mealAlternativesModal"></button>
                    <h3 id="mealAlternativesModalTitle">Алтернативи</h3>
                    <div id="mealAlternativesModalBody">
                        <div id="mealAlternativesLoading" style="display: none;">Loading...</div>
                        <div id="mealAlternativesList" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;

        modal = document.getElementById('mealAlternativesModal');
        loadingDiv = document.getElementById('mealAlternativesLoading');
        alternativesList = document.getElementById('mealAlternativesList');
        modalTitle = document.getElementById('mealAlternativesModalTitle');

        // Mock sessionStorage
        sessionStorage.setItem('userId', 'test-user-123');
        
        // Mock localStorage with plan data
        localStorage.setItem('planData', JSON.stringify({
            week1_menu: {
                monday: [
                    {
                        meal_name: 'Закуска',
                        items: [{ name: 'Овесени ядки', grams: 50 }]
                    }
                ]
            }
        }));

        // Mock fetch globally
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
        sessionStorage.clear();
        localStorage.clear();
    });

    test('should add "visible" class when modal is opened', async () => {
        // Mock successful API response
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                alternatives: [
                    {
                        meal_name: 'Алтернатива 1',
                        items: [{ name: 'Протеинов шейк', grams: 200 }],
                        macros: { calories: 300, protein_grams: 25, carbs_grams: 30, fat_grams: 5 }
                    }
                ]
            })
        });

        const mealData = {
            meal_name: 'Закуска',
            items: [{ name: 'Овесени ядки', grams: 50 }]
        };

        // Call openMealAlternativesModal
        await openMealAlternativesModal(mealData, 0, 'monday');

        // Verify modal has "visible" class (not "show")
        expect(modal.classList.contains('visible')).toBe(true);
        expect(modal.classList.contains('show')).toBe(false);
        expect(modal.getAttribute('aria-hidden')).toBe('false');
        expect(document.body.style.overflow).toBe('hidden');
    });

    test('should show modal title with meal name', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                alternatives: [
                    {
                        meal_name: 'Алтернатива 1',
                        items: [{ name: 'Яйца', grams: 100 }],
                        macros: { calories: 200, protein_grams: 18, carbs_grams: 2, fat_grams: 14 }
                    }
                ]
            })
        });

        const mealData = { meal_name: 'Обяд' };

        await openMealAlternativesModal(mealData, 1, 'tuesday');

        expect(modalTitle.textContent).toBe('Алтернативи за Обяд');
    });

    test('should handle API errors gracefully', async () => {
        // Mock API error
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
                success: false,
                message: 'Server error'
            })
        });

        const mealData = { meal_name: 'Вечеря' };

        await openMealAlternativesModal(mealData, 2, 'wednesday');

        // Modal should still be visible
        expect(modal.classList.contains('visible')).toBe(true);
        
        // Error message should be displayed
        expect(alternativesList.innerHTML).toContain('Грешка при генериране');
    });

    test('should handle missing modal elements', async () => {
        // Remove modal from DOM
        document.body.innerHTML = '';

        const mealData = { meal_name: 'Закуска' };

        // Should not throw error
        await expect(openMealAlternativesModal(mealData, 0, 'monday')).resolves.not.toThrow();
    });

    test('setupMealAlternativesListeners should attach close handlers', () => {
        // Add modal to DOM
        document.body.innerHTML = `
            <div id="mealAlternativesModal" class="modal visible">
                <div class="modal-content">
                    <button data-modal-close="mealAlternativesModal">Close</button>
                    <div id="mealAlternativesList"></div>
                </div>
            </div>
        `;

        modal = document.getElementById('mealAlternativesModal');

        // Setup listeners
        setupMealAlternativesListeners();

        // Simulate close button click
        const closeButton = document.querySelector('[data-modal-close="mealAlternativesModal"]');
        closeButton.click();

        // Modal should be hidden with correct class
        expect(modal.classList.contains('visible')).toBe(false);
        expect(modal.getAttribute('aria-hidden')).toBe('true');
        expect(document.body.style.overflow).toBe('');
    });

    test('should close modal when clicking outside', () => {
        document.body.innerHTML = `
            <div id="mealAlternativesModal" class="modal visible">
                <div class="modal-content">
                    <div id="mealAlternativesList"></div>
                </div>
            </div>
        `;

        modal = document.getElementById('mealAlternativesModal');
        setupMealAlternativesListeners();

        // Simulate click on modal backdrop (not on modal-content)
        const clickEvent = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(clickEvent, 'target', { value: modal, configurable: true });
        modal.dispatchEvent(clickEvent);

        // Modal should be closed
        expect(modal.classList.contains('visible')).toBe(false);
    });

    test('should not close modal when clicking inside modal content', () => {
        document.body.innerHTML = `
            <div id="mealAlternativesModal" class="modal visible">
                <div class="modal-content">
                    <div id="mealAlternativesList"></div>
                </div>
            </div>
        `;

        modal = document.getElementById('mealAlternativesModal');
        const modalContent = modal.querySelector('.modal-content');
        setupMealAlternativesListeners();

        // Simulate click on modal content
        const clickEvent = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(clickEvent, 'target', { value: modalContent, configurable: true });
        modal.dispatchEvent(clickEvent);

        // Modal should still be visible
        expect(modal.classList.contains('visible')).toBe(true);
    });
});
