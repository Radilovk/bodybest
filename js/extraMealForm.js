// extraMealForm.js - Логика за Формата за Извънредно Хранене (оптимизирана)
import { selectors } from './uiElements.js';
import { showToast, openModal as genericOpenModal } from './uiHandlers.js';
import { apiEndpoints } from './config.js';
import { currentUserId } from './app.js';
import nutrientOverrides from '../kv/DIET_RESOURCES/nutrient_overrides.json' with { type: 'json' };
import * as macroUtils from './macroUtils.js';
const { registerNutrientOverrides, getNutrientOverride, loadProductMacros } = macroUtils;
const scaleMacros = macroUtils.scaleMacros || ((m) => m);
import {
    addExtraMealWithOverride,
    appendExtraMealCard
} from './populateUI.js';
import { getLocalDate } from './utils.js';
import { debounce } from './debounce.js';

const MACRO_FIELDS = ['calories','protein','carbs','fat','fiber'];
const SUCCESS_MESSAGE_TIMEOUT_MS = 3000;

const dynamicNutrientOverrides = { ...nutrientOverrides };
registerNutrientOverrides(dynamicNutrientOverrides);
const nutrientLookupCache = {};

function applyAutofillMacros(form, macros, autoFillMsg, formatToFixed = false) {
    if (!form || !macros || typeof macros !== 'object') return false;
    let applied = false;
    MACRO_FIELDS.forEach((fieldName) => {
        const field = form.querySelector(`input[name="${fieldName}"]`);
        if (!field) return;
        const value = macros[fieldName] ?? macros[`${fieldName}_grams`] ?? macros[`${fieldName}Grams`];
        if (value !== undefined && value !== null && value !== '') {
            const numeric = Number(value);
            if (formatToFixed && Number.isFinite(numeric)) {
                field.value = numeric.toFixed(2);
            } else {
                field.value = String(value);
            }
            field.dataset.autofilled = 'true';
            applied = true;
        }
    });
    if (applied) {
        autoFillMsg?.classList.remove('hidden');
    }
    return applied;
}

function tryAutofillFromOverride(form, desc, quantityValue, autoFillMsg) {
    const description = (desc || '').trim();
    if (!description) return false;
    const override = getNutrientOverride(buildCacheKey(description, quantityValue));
    if (!override) return false;
    return applyAutofillMacros(form, override, autoFillMsg);
}

// --- Синоними за продуктите (разширявай при нужда)
const PRODUCT_SYNONYMS = {
    'ябълка': ['ябълки', 'apple', 'зелена ябълка', 'червена ябълка'],
    // Може да добавиш още синоними за други продукти
};

function buildCacheKey(name, quantity = '') {
    const n = (name || '').toLowerCase().trim();
    const q = String(quantity || '').toLowerCase().trim();
    return `${n}|${q}`;
}

let nutrientLookup = async function (name, quantity = '') {
    const cacheKey = buildCacheKey(name, quantity);
    const cached = nutrientLookupCache[cacheKey] || getNutrientOverride(cacheKey);
    if (cached) return cached;
    const resp = await fetch('/nutrient-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food: (name || '').toLowerCase().trim(), quantity })
    });
    if (!resp.ok) throw new Error('Nutrient lookup failed');
    const data = await resp.json();
    nutrientLookupCache[cacheKey] = data;
    dynamicNutrientOverrides[cacheKey] = data;
    registerNutrientOverrides(dynamicNutrientOverrides);
    return data;
};

export function __setNutrientLookupFn(fn) {
    nutrientLookup = fn;
}

export async function fetchMacrosFromAi(name, quantity) {
    // Allow any quantity value - the backend AI can handle:
    // - Numeric values (e.g., 150)
    // - Descriptive quantities (e.g., "2 парчета", "1 чаша")
    // - Empty/undefined (AI will estimate per 100g)
    try {
        return await nutrientLookup(name, quantity);
    } catch (err) {
        console.error('Nutrient lookup failed:', err);
        throw err;
    }
}

export async function handleExtraMealFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    if (!form) return;

    const formData = new FormData(form);
    const quantityVal = parseFloat(formData.get('quantity'));
    const quantityText = (formData.get('quantityCustom') || '').trim();
    const quantityRadio = form.querySelector('input[name="quantityEstimateVisual"]:checked');
    if ((quantityVal || quantityVal === 0) && quantityVal <= 0) {
        showToast('Моля, въведете валидно количество.', true);
        return;
    }
    if (!quantityRadio && !quantityText && !(quantityVal > 0)) {
        showToast('Моля, въведете количество.', true);
        return;
    }
    const quantity = quantityVal > 0 ? quantityVal : undefined;

    const foodDesc = formData.get('foodDescription')?.trim();
    let macros = {};
    let macrosMissing = false;
    MACRO_FIELDS.forEach(f => {
        const val = parseFloat(formData.get(f));
        if (isNaN(val)) macrosMissing = true; else macros[f] = val;
    });

    // Ако липсват макроси, опитваме се да ги извлечем от AI, но не блокираме изпращането
    if (macrosMissing && foodDesc) {
        try {
            const fetched = await fetchMacrosFromAi(foodDesc, quantity);
            macros = fetched;
            MACRO_FIELDS.forEach(f => {
                const field = form.querySelector(`input[name="${f}"]`);
                if (field && fetched[f] !== undefined) {
                    field.value = fetched[f];
                    field.dataset.autofilled = 'true';
                }
            });
        } catch (err) {
            // Не спираме изпращането, просто логваме грешката
            console.warn('AI macro lookup failed during submission, continuing without macros', err);
            // Използваме празни макроси ако не успеем да ги извлечем
            macros = {};
        }
    }

    populateSummary(form);

    const quantityDisplay = getQuantityDisplay(
        form.querySelector('input[name="quantityEstimateVisual"]:checked'),
        formData.get('quantityCustom')
    );

    try {
        const payload = {
            userId: currentUserId,
            date: getLocalDate(),
            foodDescription: foodDesc,
            quantity,
            quantityEstimate: quantityDisplay,
            ...macros
        };
        const resp = await fetch(apiEndpoints.logExtraMeal, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || result.success === false) {
            throw new Error(result.message || `HTTP ${resp.status}`);
        }
        addExtraMealWithOverride(foodDesc, macros);
        appendExtraMealCard(foodDesc, quantityDisplay);
        document.body.dispatchEvent(new Event('closeExtraMealModalEvent'));
        form.reset();
    } catch (err) {
        showToast(`Грешка при изпращане: ${err.message}`, true);
    }
}

let productMacrosLoaded = false;
let productList = [];
async function ensureProductMacrosLoaded() {
    if (productMacrosLoaded) return;
    try {
        const { overrides, products } = await loadProductMacros();
        Object.assign(dynamicNutrientOverrides, overrides);
        productList = Array.isArray(products) ? products : [];
        registerNutrientOverrides(dynamicNutrientOverrides);
    } catch (e) {
        console.error('Неуспешно зареждане на продуктови макроси', e);
    }
    productMacrosLoaded = true;
}

let productMeasures = {};
let productMeasuresLoaded = false;
let productMeasureNames = [];
async function ensureProductMeasuresLoaded() {
    if (productMeasuresLoaded) return;
    try {
        const { default: data } = await import('../kv/DIET_RESOURCES/product_measure.json', { with: { type: 'json' } });
        productMeasures = Object.fromEntries(
            (Array.isArray(data) ? data : []).map(p => [p.name.toLowerCase(), p.measures])
        );
        productMeasureNames = Object.keys(productMeasures);
        // Добавяме синоними
        Object.entries(PRODUCT_SYNONYMS).forEach(([main, synonyms]) => {
            synonyms.forEach(syn => {
                if (!productMeasures[syn.toLowerCase()] && productMeasures[main]) {
                    productMeasures[syn.toLowerCase()] = productMeasures[main];
                    productMeasureNames.push(syn.toLowerCase());
                }
            });
        });
    } catch (e) {
        console.error('Неуспешно зареждане на мерни единици', e);
    }
    productMeasuresLoaded = true;
}

let extraMealFormLoaded = false;

export async function openExtraMealModal() {
    genericOpenModal('extraMealEntryModal');
    if (extraMealFormLoaded || !selectors.extraMealFormContainer) return;
    try {
        const resp = await fetch('extra-meal-entry-form.html');
        if (!resp.ok) throw new Error('Failed to load extra meal form');
        selectors.extraMealFormContainer.innerHTML = await resp.text();
        await initializeExtraMealFormLogic(selectors.extraMealFormContainer);
        extraMealFormLoaded = true;
    } catch (err) {
        console.error('Неуспешно зареждане на формата за извънредно хранене', err);
        showToast('Грешка при зареждане на формата.', true);
    }
}

export function getQuantityDisplay(selectedRadio, quantityCustom) {
    const customVal = (quantityCustom || '').trim();
    if (selectedRadio) {
        const radioValue = selectedRadio.value;
        if (radioValue === 'other_quantity_describe') {
            return customVal || 'Друго (неуточнено)';
        }
        if (radioValue === 'не_посочено_в_стъпка_2') {
            return '(описано в стъпка 1)';
        }
        const labelEl = selectedRadio.closest('.quantity-card-option')?.querySelector('.card-label');
        return labelEl ? labelEl.textContent.trim() : radioValue;
    }
    return customVal || 'Не е посочено';
}

// --- Подобрено търсене на продукт и fuzzy match
function normalizeProductName(str = '') {
    // Вземи само първата дума, премахни пунктуация, малки букви
    return (str.split(/[ ,.;\-]/)[0] || '').toLowerCase().trim();
}

function levenshtein(a = '', b = '') {
    const m = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) m[0][i] = i;
    for (let j = 0; j <= b.length; j++) m[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            m[j][i] = Math.min(
                m[j - 1][i] + 1,
                m[j][i - 1] + 1,
                m[j - 1][i - 1] + cost
            );
        }
    }
    return m[b.length][a.length];
}

function fuzzyFindProductKey(desc = '') {
    let query = normalizeProductName(desc);
    if (productMeasures[query]) return query;
    // Синоними
    for (const [main, synonyms] of Object.entries(PRODUCT_SYNONYMS)) {
        if (main === query || synonyms.includes(query)) return main;
    }
    // Fuzzy по разстояние Левенщайн
    let best = null, bestDist = Infinity;
    for (const key of productMeasureNames) {
        const dist = levenshtein(key, query);
        if (dist < bestDist) {
            best = key;
            bestDist = dist;
        }
    }
    if (bestDist <= Math.max(1, Math.floor(query.length * 0.3))) return best;
    return null;
}

export function getMeasureLabels(desc = '') {
    const key = fuzzyFindProductKey(desc);
    return key && productMeasures[key]
        ? productMeasures[key].map(m => m.label)
        : [];
}

function findClosestProduct(desc = '') {
    const query = desc.toLowerCase();
    if (!query) return null;
    const direct = productList.filter(p => p.name.toLowerCase().includes(query));
    if (direct.length) return direct[0];
    let best = null;
    let bestDist = Infinity;
    for (const p of productList) {
        const name = p.name.toLowerCase();
        const dist = levenshtein(name, query);
        if (dist < bestDist) {
            bestDist = dist;
            best = p;
        }
    }
    const threshold = Math.max(1, Math.floor(query.length * 0.3));
    return bestDist <= threshold ? best : null;
}

// --- toggle за quantityVisual
function toggleQuantityVisual(show, form) {
    const quantityVisualRadios = form.querySelectorAll('input[name="quantityEstimateVisual"]');
    quantityVisualRadios.forEach(radio => {
        const label = radio.closest('.quantity-card-option');
        if (label) label.style.display = show ? '' : 'none';
    });
}

function populateSummary(form) {
    if (!form) return;
    const autoFillEl = form.querySelector('#autoFillMsg');
    let autoFilled = autoFillEl ? !autoFillEl.classList.contains('hidden') : false;
    if (!autoFilled) {
        autoFilled = MACRO_FIELDS.some(f => form.querySelector(`input[name="${f}"]`)?.dataset.autofilled === 'true');
    }
    const format = (v) => {
        const num = parseFloat(v);
        if (isNaN(num)) return v || '';
        return autoFilled ? num.toFixed(2) : v;
    };
    const summaryData = {
        foodDescription: form.querySelector('#foodDescription')?.value.trim() || '',
        quantityEstimate: getQuantityDisplay(
            form.querySelector('input[name="quantityEstimateVisual"]:checked'),
            form.querySelector('#quantityCustom')?.value
        ),
        calories: format(form.querySelector('input[name="calories"]')?.value),
        protein: format(form.querySelector('input[name="protein"]')?.value),
        carbs: format(form.querySelector('input[name="carbs"]')?.value),
        fat: format(form.querySelector('input[name="fat"]')?.value),
        fiber: format(form.querySelector('input[name="fiber"]')?.value),
        reasonPrimary: form.querySelector('input[name="reasonPrimary"]:checked')?.value || '',
        feelingAfter: form.querySelector('input[name="feelingAfter"]:checked')?.value || '',
        replacedPlanned: form.querySelector('input[name="replacedPlanned"]:checked')?.value || ''
    };
    Object.entries(summaryData).forEach(([key, value]) => {
        const el = form.querySelector(`[data-summary="${key}"]`);
        if (el) el.textContent = value;
    });
}

async function populateSummaryWithAiMacros(form) {
    if (!form) return;
    
    // Първо попълваме обобщението с наличните данни
    populateSummary(form);
    
    // Проверяваме дали имаме липсващи макроси
    const formData = new FormData(form);
    const foodDesc = formData.get('foodDescription')?.trim();
    const quantityVal = parseFloat(formData.get('quantity'));
    const quantityText = (formData.get('quantityCustom') || '').trim();
    const quantityCountVal = parseFloat(formData.get('quantityCountInput'));
    const measureText = formData.get('measureInput')?.trim();
    
    let macrosMissing = false;
    MACRO_FIELDS.forEach(f => {
        const val = parseFloat(formData.get(f));
        if (isNaN(val)) macrosMissing = true;
    });
    
    // Ако липсват макроси и имаме описание на храната, зареждаме ги автоматично на заден план
    if (macrosMissing && foodDesc) {
        // Показваме индикатор за зареждане в обобщителния екран
        const summaryBox = form.querySelector('#extraMealSummary');
        if (summaryBox) {
            // Добавяме съобщение за зареждане
            let loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'ai-loading-indicator';
                loadingIndicator.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:var(--space-sm);background-color:var(--info-color-light, #e3f2fd);border-radius:var(--radius-sm);margin-top:var(--space-sm);color:var(--info-color, #1976d2);font-size:0.9rem;';
                loadingIndicator.innerHTML = '<svg class="icon spinner" style="width:1.2rem;height:1.2rem;"><use href="#icon-spinner"></use></svg><span>Автоматично изчисляване на макроси...</span>';
                summaryBox.appendChild(loadingIndicator);
            }
            loadingIndicator.classList.remove('hidden');
        }
        
        try {
            // Определяме количеството за заявката - опитваме се от различни източници
            // Приоритет: числово количество > текстово количество > count + measure комбинация
            let quantity = '';
            
            if (quantityVal > 0) {
                // Предпочитаме числовото количество ако е налично
                quantity = quantityVal;
            } else if (quantityText) {
                // Използваме текстовото количество ако е въведено
                quantity = quantityText;
            } else if (quantityCountVal > 0 && measureText) {
                // Използваме комбинацията count + measure ако са въведени
                quantity = `${quantityCountVal} ${measureText}`;
            } else if (quantityCountVal > 0) {
                // Имаме само брой без мярка
                quantity = quantityCountVal;
            } else if (measureText) {
                // Имаме само мярка без брой (напр. "чаша", "парче")
                quantity = `1 ${measureText}`;
            }
            
            // AI може да работи и без количество (ще изчисли на 100г база)
            // Затова не хвърляме грешка, а просто подаваме каквото имаме
            
            // Извличаме макросите от AI
            const fetched = await nutrientLookup(foodDesc, quantity);
            
            // Попълваме полетата с получените данни
            MACRO_FIELDS.forEach(f => {
                const field = form.querySelector(`input[name="${f}"]`);
                if (field && fetched[f] !== undefined) {
                    const value = Number(fetched[f]);
                    field.value = Number.isFinite(value) ? value.toFixed(2) : fetched[f];
                    field.dataset.autofilled = 'true';
                }
            });
            
            // Обновяваме обобщителния екран с новите данни
            populateSummary(form);
            
            // Премахваме индикатора за зареждане и показваме съобщение за успех
            if (summaryBox) {
                const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.innerHTML = '<svg class="icon" style="width:1.2rem;height:1.2rem;"><use href="#icon-check"></use></svg><span>Макросите са изчислени автоматично</span>';
                    loadingIndicator.style.backgroundColor = 'var(--success-color-light, #e8f5e9)';
                    loadingIndicator.style.color = 'var(--success-color, #2e7d32)';
                    
                    // Скриваме съобщението след определено време
                    setTimeout(() => {
                        loadingIndicator.classList.add('hidden');
                    }, SUCCESS_MESSAGE_TIMEOUT_MS);
                }
            }
        } catch (err) {
            console.error('Failed to automatically calculate macros', err);
            
            // Определяме по-информативно съобщение за грешка
            let errorMessage = 'Макросите не могат да бъдат изчислени автоматично. ';
            
            // Проверяваме дали имаме описание на храната
            if (!foodDesc || !foodDesc.trim()) {
                errorMessage += 'Моля, въведете описание на храната.';
            } else if (err instanceof TypeError && err.message && err.message.toLowerCase().includes('fetch')) {
                // TypeError with 'fetch' typically indicates network error
                errorMessage += 'Проблем с връзката. Моля, опитайте отново.';
            } else if (!navigator.onLine) {
                // Browser reports offline
                errorMessage += 'Няма интернет връзка. Моля, проверете връзката си.';
            } else {
                errorMessage += 'Може да ги въведете ръчно или да продължите без тях.';
            }
            
            // Показваме съобщение за грешка, но не блокираме потребителя
            if (summaryBox) {
                const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.innerHTML = `<svg class="icon" style="width:1.2rem;height:1.2rem;"><use href="#icon-alert"></use></svg><span>${errorMessage}</span>`;
                    loadingIndicator.style.backgroundColor = 'var(--warning-color-light, #fff3e0)';
                    loadingIndicator.style.color = 'var(--warning-color, #f57c00)';
                }
            }
        }
    }
}

export async function initializeExtraMealFormLogic(formContainerElement) {
    const form = formContainerElement.querySelector('#extraMealEntryFormActual');
    if (!form) {
        console.error("EMF Logic Error: Form #extraMealEntryFormActual not found within container!");
        return;
    }

    await ensureProductMacrosLoaded();
    await ensureProductMeasuresLoaded();

    const steps = Array.from(form.querySelectorAll('.form-step'));
    const navigationContainer = form.querySelector('.form-wizard-navigation');
    const prevBtn = navigationContainer?.querySelector('#emPrevStepBtn');
    const nextBtn = navigationContainer?.querySelector('#emNextStepBtn');
    const submitBtn = navigationContainer?.querySelector('#emSubmitBtn');
    const cancelBtn = navigationContainer?.querySelector('#emCancelBtn');
    const stepProgressBar = form.querySelector('#stepProgressBar');
    const currentStepNumberEl = form.querySelector('#currentStepNumber');
    const totalStepNumberEl = form.querySelector('#totalStepNumber');

    let currentStepIndex = 0;
    const totalSteps = steps.length;

    form.addEventListener('submit', handleExtraMealFormSubmit);

    function updateStepIndicator() {
        if (stepProgressBar) {
            const progressPercentage = totalSteps > 1 ? ((currentStepIndex + 1) / totalSteps) * 100 : (totalSteps === 1 ? 100 : 0);
            stepProgressBar.style.width = progressPercentage + '%';
        }
        if (currentStepNumberEl) currentStepNumberEl.textContent = currentStepIndex + 1;
        if (totalStepNumberEl) totalStepNumberEl.textContent = totalSteps;
    }
    async function showCurrentStep() {
        steps.forEach((step, index) => {
            step.style.display = (index === currentStepIndex) ? 'block' : 'none';
            if (index === currentStepIndex) {
                step.classList.add('active-step');
                const firstInput = step.querySelector('input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)');
                if (firstInput) setTimeout(() => { try { firstInput.focus({ preventScroll: true }); } catch {} }, 60);
            } else {
                step.classList.remove('active-step');
            }
        });
        if (prevBtn) prevBtn.style.display = (currentStepIndex > 0) ? 'inline-flex' : 'none';
        if (nextBtn) nextBtn.style.display = (currentStepIndex < totalSteps - 1) ? 'inline-flex' : 'none';
        if (submitBtn) submitBtn.style.display = (currentStepIndex === totalSteps - 1) ? 'inline-flex' : 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        updateStepIndicator();
        if (currentStepIndex === totalSteps - 1) {
            await populateSummaryWithAiMacros(form);
        }
    }
    let navigationInProgress = false;
    if (nextBtn) nextBtn.addEventListener('click', async () => { 
        if (navigationInProgress) return;
        if (currentStepIndex < totalSteps - 1) { 
            navigationInProgress = true;
            try {
                currentStepIndex++; 
                await showCurrentStep();
            } finally {
                navigationInProgress = false;
            }
        }
    });
    if (prevBtn) prevBtn.addEventListener('click', async () => { 
        if (navigationInProgress) return;
        if (currentStepIndex > 0) { 
            navigationInProgress = true;
            try {
                currentStepIndex--; 
                await showCurrentStep();
            } finally {
                navigationInProgress = false;
            }
        }
    });

    const foodDescriptionInput = form.querySelector('#foodDescription');
    const suggestionsDropdown = form.querySelector('#foodSuggestionsDropdown');
    const measureOptionsContainer = form.querySelector('#measureOptions');
    if (measureOptionsContainer && measureOptionsContainer.children.length === 0) {
        measureOptionsContainer.classList.add('hidden');
    }
    const quantityHiddenInput = form.querySelector('#quantity');
    const quantityCustomInput = form.querySelector('#quantityCustom');
    const quantityCountInput = form.querySelector('#quantityCountInput');
    const macroFieldsContainer = form.querySelector('#macroFieldsContainer');
    const macroInputsGrid = form.querySelector('.macro-inputs-grid');
    let autoFillMsg;
    if (macroInputsGrid) {
        autoFillMsg = document.createElement('div');
        autoFillMsg.id = 'autoFillMsg';
        autoFillMsg.className = 'auto-fill-msg hidden';
        autoFillMsg.style.cssText = 'display:flex;align-items:center;gap:0.25rem;font-size:0.8rem;color:var(--text-color-muted);margin-top:var(--space-xs);';
        autoFillMsg.innerHTML = '<i class="bi bi-magic"></i><span>Стойностите са попълнени автоматично</span>';
        macroInputsGrid.parentElement?.appendChild(autoFillMsg);
        macroInputsGrid.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => autoFillMsg.classList.add('hidden')));
    }
    
    let quantityLookupLoading = false;
    let quantityLookupSpinner;
    if (quantityCustomInput) {
        quantityLookupSpinner = document.createElement('svg');
        quantityLookupSpinner.classList.add('icon', 'spinner', 'lookup-spinner', 'hidden');
        quantityLookupSpinner.innerHTML = '<use href="#icon-spinner"></use>';
        quantityCustomInput.insertAdjacentElement('afterend', quantityLookupSpinner);
    }
    
    const quantityVisualRadios = form.querySelectorAll('input[name="quantityEstimateVisual"]');
    quantityVisualRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            quantityVisualRadios.forEach(r => r.closest('.quantity-card-option')?.classList.toggle('selected', r.checked));
            const desc = foodDescriptionInput?.value?.trim();
            if (!measureOptionsContainer || measureOptionsContainer.classList.contains('hidden')) {
                if (!tryAutofillFromOverride(form, desc, radio.value, autoFillMsg) && autoFillMsg) {
                    autoFillMsg.classList.add('hidden');
                }
            }
        });
    });

    // Function to show macro fields ONLY when they have values populated
    function showMacroFieldsIfFilled() {
        if (!macroFieldsContainer) return;
        
        // Check if ALL macro fields have values
        let allFilled = true;
        MACRO_FIELDS.forEach(f => {
            const field = form.querySelector(`input[name="${f}"]`);
            if (!field || !field.value || field.value.trim() === '') {
                allFilled = false;
            }
        });
        
        // Only show macro fields if all are filled
        if (allFilled) {
            macroFieldsContainer.classList.remove('hidden');
        } else {
            macroFieldsContainer.classList.add('hidden');
        }
    }

    // Function to trigger background AI macro lookup when macros are not in local database
    async function triggerBackgroundMacroLookup(description, quantity) {
        console.log('[extraMealForm] triggerBackgroundMacroLookup called:', { description, quantity });
        
        if (!description || !quantity) {
            console.log('[extraMealForm] Early return - missing description or quantity');
            return;
        }
        
        // Check if macros are already filled
        let macrosFilled = true;
        MACRO_FIELDS.forEach(f => {
            const field = form.querySelector(`input[name="${f}"]`);
            if (!field || !field.value || field.value.trim() === '') {
                macrosFilled = false;
            }
        });
        
        if (macrosFilled) {
            console.log('[extraMealForm] Macros already filled, skipping lookup');
            return; // Don't lookup if already filled
        }
        
        console.log('[extraMealForm] Starting AI macro lookup...');
        
        // Show loading indicator
        if (autoFillMsg) {
            autoFillMsg.innerHTML = '<svg class="icon spinner" style="width:1rem;height:1rem;"><use href="#icon-spinner"></use></svg><span>Изчисляване на макроси...</span>';
            autoFillMsg.classList.remove('hidden');
        }
        
        try {
            // Call nutrientLookup in background
            const data = await nutrientLookup(description, quantity);
            console.log('[extraMealForm] AI lookup successful:', data);
            
            // Fill the macro fields with the retrieved data
            MACRO_FIELDS.forEach(f => {
                const field = form.querySelector(`input[name="${f}"]`);
                if (field && data[f] !== undefined) {
                    const value = Number(data[f]);
                    field.value = Number.isFinite(value) ? value.toFixed(2) : data[f];
                    field.dataset.autofilled = 'true';
                }
            });
            
            if (autoFillMsg) {
                autoFillMsg.innerHTML = '<i class="bi bi-magic"></i><span>Стойностите са попълнени автоматично</span>';
                autoFillMsg.classList.remove('hidden');
            }
            
            // Show macro fields after filling them
            showMacroFieldsIfFilled();
        } catch (err) {
            console.error('[extraMealForm] AI lookup failed:', err);
            // Show error message to user so they know what happened
            if (autoFillMsg) {
                autoFillMsg.innerHTML = '<i class="bi bi-exclamation-triangle"></i><span>Неуспешно изчисляване. Ще се опита отново в обобщението.</span>';
                autoFillMsg.style.color = 'var(--warning-color, #f57c00)';
                autoFillMsg.classList.remove('hidden');
                // Hide after a delay
                setTimeout(() => {
                    autoFillMsg.classList.add('hidden');
                    autoFillMsg.style.color = ''; // Reset color
                }, 3000);
            }
        }
    }

    // --- measureOptions с fuzzy и автоматичен избор
    function updateMeasureOptions(desc) {
        if (!measureOptionsContainer) return;
        const key = fuzzyFindProductKey(desc);
        measureOptionsContainer.innerHTML = '';
        if (!key || !productMeasures[key]) {
            measureOptionsContainer.classList.add('hidden');
            toggleQuantityVisual(true, form);
            return;
        }
        toggleQuantityVisual(false, form);
        const measures = productMeasures[key] || [];
        const frag = document.createDocumentFragment();
        measures.forEach((m, i) => {
            const label = document.createElement('label');
            label.className = 'quantity-card-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'measureOption';
            radio.dataset.grams = m.grams;
            if (i === 0) radio.checked = true;
            radio.addEventListener('change', computeQuantity);
            const content = document.createElement('span');
            content.className = 'card-content';
            content.innerHTML = `<span class="card-label">${m.label}</span><span class="card-desc">~${m.grams} g</span>`;
            label.append(radio, content);
            frag.appendChild(label);
        });
        const otherLabel = document.createElement('label');
        otherLabel.className = 'quantity-card-option';
        const otherRadio = document.createElement('input');
        otherRadio.type = 'radio';
        otherRadio.name = 'measureOption';
        otherRadio.value = 'other';
        otherRadio.addEventListener('change', computeQuantity);
        const otherContent = document.createElement('span');
        otherContent.className = 'card-content';
        otherContent.innerHTML = '<span class="card-label">Друго</span>';
        otherLabel.append(otherRadio, otherContent);
        frag.appendChild(otherLabel);

        measureOptionsContainer.appendChild(frag);
        measureOptionsContainer.classList.remove('hidden');
        computeQuantity();
    }

    function computeQuantity() {
        if (!quantityHiddenInput) return;
        const selectedMeasure = measureOptionsContainer?.querySelector('input[name="measureOption"]:checked');
        const total = Number(selectedMeasure?.dataset.grams || 0);
        if (quantityHiddenInput) quantityHiddenInput.value = total > 0 ? String(total) : '';
        
        const description = foodDescriptionInput?.value?.trim().toLowerCase();
        if (autoFillMsg) autoFillMsg.classList.add('hidden');
        if (description && total > 0) {
            const measureValue = selectedMeasure?.value || selectedMeasure?.dataset.value || selectedMeasure?.dataset.grams || '';
            let applied = tryAutofillFromOverride(form, description, measureValue, autoFillMsg);
            if (!applied) {
                const product = findClosestProduct(description);
                if (product) {
                    const scaled = scaleMacros(product, total);
                    applied = applyAutofillMacros(form, scaled, autoFillMsg, true);
                }
            }
            if (!applied && autoFillMsg) autoFillMsg.classList.add('hidden');
            
            // If macros were not found, trigger AI lookup in background
            if (!applied) {
                triggerBackgroundMacroLookup(description, total);
            } else {
                // Show macro fields if they were filled from local data
                showMacroFieldsIfFilled();
            }
        }
    }

    if (measureOptionsContainer && measureOptionsContainer.children.length > 0 && !measureOptionsContainer.classList.contains('hidden')) {
        computeQuantity();
    }

    if (measureOptionsContainer) {
        measureOptionsContainer.querySelectorAll('input[name="measureOption"]').forEach((radio) => {
            radio.addEventListener('change', computeQuantity);
        });
    }

    function computeQuantityFromManual() {
        if (!quantityHiddenInput || !quantityCustomInput || !quantityCountInput) return;
        const count = parseFloat(quantityCountInput.value);
        const desc = foodDescriptionInput?.value?.trim().toLowerCase() || '';
        
        console.log('[extraMealForm] computeQuantityFromManual called:', { desc, count });
        
        if (!desc || !(count > 0)) {
            console.log('[extraMealForm] Early return - missing required fields:', { hasDesc: !!desc, validCount: count > 0 });
            return;
        }
        
        const key = fuzzyFindProductKey(desc);
        
        console.log('[extraMealForm] Product lookup result:', { key });
        
        let grams = 0;
        if (key && productMeasures[key] && productMeasures[key][0]) {
            // Product found in database, calculate grams from first measure
            grams = productMeasures[key][0].grams * count;
            console.log('[extraMealForm] Product found in DB, calculated grams:', grams);
        } else {
            // Product not in database, build descriptive query for AI
            const quantityDescription = `${count} броя`;
            if (quantityCustomInput) quantityCustomInput.value = quantityDescription;
            
            console.log('[extraMealForm] Product NOT in DB, triggering AI lookup with:', { desc, quantityDescription });
            
            // Trigger AI lookup with descriptive quantity
            triggerBackgroundMacroLookup(desc, quantityDescription);
            return; // Exit early as AI lookup is in progress
        }
        
        if (quantityHiddenInput) quantityHiddenInput.value = String(grams);
        quantityCustomInput.value = `${grams} гр`;
        
        if (autoFillMsg) autoFillMsg.classList.add('hidden');
        let applied = false;
        const product = findClosestProduct(desc);
        if (product) {
            const scaled = scaleMacros(product, grams);
            applied = applyAutofillMacros(form, scaled, autoFillMsg, true);
        }
        if (!applied) {
            applied = tryAutofillFromOverride(form, desc, grams, autoFillMsg);
        }
        
        // If macros were not found, trigger AI lookup in background
        if (!applied) {
            triggerBackgroundMacroLookup(desc, grams);
        } else {
            // Show macro fields if they were filled from local data
            showMacroFieldsIfFilled();
        }
    }

    if (quantityCountInput) quantityCountInput.addEventListener('input', computeQuantityFromManual);

    // ОПТИМИЗАЦИЯ: Използваме debounce за nutrient lookup, за да намалим API заявките
    // Създаваме debounced версия на lookup функцията
    const performNutrientLookup = debounce(async () => {
        const desc = foodDescriptionInput?.value?.trim();
        const qty = quantityCustomInput?.value?.trim();
        if (!desc || !qty || quantityLookupLoading) return;
        quantityLookupLoading = true;
        quantityLookupSpinner?.classList.remove('hidden');
        try {
            const data = await nutrientLookup(desc, qty);
            MACRO_FIELDS.forEach(f => {
                const field = form.querySelector(`input[name="${f}"]`);
                if (field && data[f] !== undefined) {
                    const value = Number(data[f]);
                    field.value = Number.isFinite(value) ? value.toFixed(2) : data[f];
                    field.dataset.autofilled = 'true';
                }
            });
            if (autoFillMsg) autoFillMsg.classList.remove('hidden');
            showMacroFieldsIfFilled(); // Show macro fields after filling them
        } catch (err) {
            console.error('Невъзможно изчисление на макроси', err);
        } finally {
            quantityLookupSpinner?.classList.add('hidden');
            quantityLookupLoading = false;
        }
    }, 500); // Увеличен delay от 300 на 500ms за по-добра оптимизация

    // динамична калкулация при промяна на quantityCustom
    if (quantityCustomInput) {
        quantityCustomInput.addEventListener('input', () => {
            const val = quantityCustomInput.value.trim();
            const quantityKey = val;
            let parsed = false;
            let applied = false;

            // 1) Чисто число или "<число> гр"
            const gramsMatch = val.match(/^(\d+(?:[.,]\d+)?)\s*(гр|g)?$/i);
            if (gramsMatch) {
                const grams = parseFloat(gramsMatch[1].replace(',', '.'));
                const desc = foodDescriptionInput?.value?.trim();
                const product = desc ? findClosestProduct(desc) : null;
                if (product && grams > 0) {
                    if (quantityHiddenInput) quantityHiddenInput.value = String(grams);
                    const scaled = scaleMacros(product, grams);
                    applied = applyAutofillMacros(form, scaled, autoFillMsg, true);
                    parsed = applied;
                }
                if (!applied && desc && grams > 0) {
                    if (tryAutofillFromOverride(form, desc, quantityKey, autoFillMsg)) {
                        if (quantityHiddenInput) quantityHiddenInput.value = String(grams);
                        parsed = true;
                        applied = true;
                    }
                }
                
                // If not found in local database, trigger background AI lookup
                if (!applied && desc && grams > 0) {
                    triggerBackgroundMacroLookup(desc, grams);
                    parsed = true; // Consider it parsed even if we need AI lookup
                } else if (applied) {
                    // Show macro fields if they were filled from local data
                    showMacroFieldsIfFilled();
                }
            }

            // 2) "<брой> x <продукт>"
            if (!parsed) {
                const match = val.match(/^(\d+)\s*[xх*]?\s*(.+)$/i);
                if (match) {
                    const count = parseInt(match[1], 10);
                    const prod = match[2].trim().toLowerCase();
                    const key = fuzzyFindProductKey(prod);
                    if (key && productMeasures[key] && productMeasures[key][0]) {
                        const grams = count * productMeasures[key][0].grams;
                        if (quantityHiddenInput) quantityHiddenInput.value = grams;
                        const product = findClosestProduct(key);
                        if (product) {
                            const scaled = scaleMacros(product, grams);
                            applied = applyAutofillMacros(form, scaled, autoFillMsg, true);
                        }
                        if (!applied) {
                            applied = tryAutofillFromOverride(form, key, quantityKey, autoFillMsg);
                        }
                        if (applied) {
                            parsed = true;
                            showMacroFieldsIfFilled();
                        } else {
                            // If not found in local database, trigger background AI lookup
                            triggerBackgroundMacroLookup(key, grams);
                            parsed = true;
                        }
                    } else if (count > 0) {
                        // Product not found in database, trigger AI lookup with descriptive quantity
                        const desc = foodDescriptionInput?.value?.trim();
                        if (desc) {
                            const quantityDescription = `${count} ${prod}`;
                            triggerBackgroundMacroLookup(desc, quantityDescription);
                            parsed = true;
                        }
                    }
                }
            }

            if (parsed) {
                quantityCustomInput.classList.remove('invalid-format');
                quantityCustomInput.removeAttribute('title');
                performNutrientLookup.cancel(); // Отменяме pending lookup ако има
                return;
            }

            // Неуспешно парсване – изчистване и подсказка
            if (quantityHiddenInput) quantityHiddenInput.value = '';
            MACRO_FIELDS.forEach(f => {
                const field = form.querySelector(`input[name="${f}"]`);
                if (field) field.value = '';
            });
            if (autoFillMsg) autoFillMsg.classList.add('hidden');
            macroFieldsContainer.classList.add('hidden'); // Hide macro fields if parsing failed
            quantityCustomInput.classList.add('invalid-format');
            quantityCustomInput.title = 'Формат: "150" или "150 гр"';

            // Извикваме debounced lookup вместо setTimeout
            performNutrientLookup();
        });
    }

    // autocomplete и автоматично зареждане на мерки
    function showSuggestions(inputValue) {
        if (!suggestionsDropdown || !foodDescriptionInput) return;
        suggestionsDropdown.innerHTML = '';
        if (!inputValue || inputValue.length < 1) { suggestionsDropdown.classList.add('hidden'); return; }
        const filtered = productMeasureNames.filter(name => name.includes(inputValue.toLowerCase())).slice(0, 5);
        if (filtered.length === 0) { suggestionsDropdown.classList.add('hidden'); return; }
        filtered.forEach((name) => {
            const div = document.createElement('div');
            div.textContent = name;
            div.setAttribute('role', 'option');
            div.tabIndex = -1;
            div.addEventListener('click', () => {
                foodDescriptionInput.value = name;
                suggestionsDropdown.classList.add('hidden');
                foodDescriptionInput.focus();
                updateMeasureOptions(name);
            });
            suggestionsDropdown.appendChild(div);
        });
        suggestionsDropdown.classList.remove('hidden');
    }

    if (foodDescriptionInput) {
        foodDescriptionInput.addEventListener('input', function() {
            updateMeasureOptions(this.value);
            showSuggestions(this.value);
            if (!measureOptionsContainer || measureOptionsContainer.classList.contains('hidden')) {
                const selectedVisual = form.querySelector('input[name="quantityEstimateVisual"]:checked');
                if (!tryAutofillFromOverride(form, this.value, selectedVisual?.value, autoFillMsg) && autoFillMsg) {
                    autoFillMsg.classList.add('hidden');
                }
            }
        });
        // Enter избира първото предложение
        foodDescriptionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !suggestionsDropdown.classList.contains('hidden')) {
                e.preventDefault();
                const first = suggestionsDropdown.querySelector('div');
                if (first) first.click();
            }
        });
    }

    // Fallback при грешки
    if (!productMeasuresLoaded) {
        if (measureOptionsContainer) {
            measureOptionsContainer.innerHTML = '<span style="color:red">Неуспешно зареждане на мерки. Моля, въведете ръчно количество.</span>';
            measureOptionsContainer.classList.remove('hidden');
            toggleQuantityVisual(true, form);
        }
    }

    if (steps.length > 0) showCurrentStep();
}
