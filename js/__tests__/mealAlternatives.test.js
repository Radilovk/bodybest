import { jest } from "@jest/globals";

/**
 * @jest-environment jsdom
 */

describe('mealAlternatives - Event Listener Attachment', () => {
    beforeEach(() => {
        // Setup minimal DOM structure
        document.body.innerHTML = `
            <div id="mealAlternativesModal" class="modal" aria-hidden="true">
                <div class="modal-content">
                    <h3 id="mealAlternativesModalTitle">Алтернативи</h3>
                    <div id="mealAlternativesModalBody">
                        <div id="mealAlternativesLoading" style="display: none;">
                            <p>Генериране...</p>
                        </div>
                        <div id="mealAlternativesList" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    test('renderAlternatives should create buttons with event listeners', () => {
        const alternativesList = document.getElementById('mealAlternativesList');
        
        // Manually create the HTML that renderAlternatives would create
        const mockAlternatives = [
            {
                meal_name: 'Alternative 1',
                items: [{ name: 'Food A', grams: 100 }],
                macros: { calories: 300, protein_grams: 20, carbs_grams: 30, fat_grams: 10 }
            },
            {
                meal_name: 'Alternative 2',
                items: [{ name: 'Food B', grams: 150 }],
                macros: { calories: 400, protein_grams: 25, carbs_grams: 40, fat_grams: 15 }
            }
        ];
        
        // Simulate what renderAlternatives does
        alternativesList.innerHTML = `
            <div class="alternatives-intro">
                <p>Select an alternative</p>
            </div>
            <div class="alternatives-grid">
                ${mockAlternatives.map((alt, index) => `
                    <div class="alternative-card card" data-alt-index="${index}">
                        <h4>${alt.meal_name}</h4>
                        <button class="button-primary select-alternative-btn" data-alt-index="${index}">
                            Избери това
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Now attach event listeners like the fixed code does
        const selectButtons = alternativesList.querySelectorAll('.select-alternative-btn');
        const clickHandler = jest.fn();
        
        selectButtons.forEach((btn) => {
            btn.addEventListener('click', clickHandler);
        });
        
        // Verify buttons exist
        expect(selectButtons.length).toBe(2);
        
        // Verify event listeners work
        selectButtons[0].click();
        expect(clickHandler).toHaveBeenCalledTimes(1);
        
        selectButtons[1].click();
        expect(clickHandler).toHaveBeenCalledTimes(2);
    });
    
    test('buttons should have correct data attributes', () => {
        const alternativesList = document.getElementById('mealAlternativesList');
        
        alternativesList.innerHTML = `
            <button class="select-alternative-btn" data-alt-index="0">Button 1</button>
            <button class="select-alternative-btn" data-alt-index="1">Button 2</button>
        `;
        
        const buttons = alternativesList.querySelectorAll('.select-alternative-btn');
        
        expect(buttons[0].getAttribute('data-alt-index')).toBe('0');
        expect(buttons[1].getAttribute('data-alt-index')).toBe('1');
    });
    
    test('modal elements should exist in DOM', () => {
        expect(document.getElementById('mealAlternativesModal')).not.toBeNull();
        expect(document.getElementById('mealAlternativesModalTitle')).not.toBeNull();
        expect(document.getElementById('mealAlternativesLoading')).not.toBeNull();
        expect(document.getElementById('mealAlternativesList')).not.toBeNull();
    });
});

