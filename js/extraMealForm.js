// extraMealForm.js - Логика за Формата за Извънредно Хранене
import { selectors } from './uiElements.js';
import { showLoading, showToast, openModal as genericOpenModal, closeModal as genericCloseModal } from './uiHandlers.js';
import { apiEndpoints } from './config.js';
import { currentUserId, todaysExtraMeals, currentIntakeMacros, loadCurrentIntake, updateMacrosAndAnalytics, fullDashboardData } from './app.js';
import nutrientOverrides from '../kv/DIET_RESOURCES/nutrient_overrides.json' with { type: 'json' };
import { removeMealMacros, registerNutrientOverrides, getNutrientOverride, loadProductMacros, scaleMacros } from './macroUtils.js';
import {
    addExtraMealWithOverride,
    appendExtraMealCard
} from './populateUI.js';
import { sanitizeHTML } from './htmlSanitizer.js';
import { getLocalDate } from './utils.js';

const MACRO_FIELDS = ['calories','protein','carbs','fat','fiber'];

const dynamicNutrientOverrides = { ...nutrientOverrides };
registerNutrientOverrides(dynamicNutrientOverrides);
const nutrientLookupCache = {};

// --- OPTIMIZED: Синоними за продуктите
const PRODUCT_SYNONYMS = {
    'ябълка': ['ябълки', 'apple', 'зелена ябълка', 'червена ябълка'],
    // добави и за други продукти по нужда
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
        // --- OPTIMIZED: Добавяме синоними
        Object.entries(PRODUCT_SYNONYMS).forEach(([main, synonyms]) => {
            synonyms.forEach(syn => {
                if (!productMeasures[syn.toLowerCase()]) {
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

// --- OPTIMIZED: Подобрено търсене на продукт и fuzzy match
function normalizeProductName(str = '') {
    // Вземи само първата дума, премахни пунктуация, малки букви
    return (str.split(/[ ,.;\-]/)[0] || '').toLowerCase().trim();
}

function fuzzyFindProductKey(desc = '') {
    let query = normalizeProductName(desc);
    if (productMeasures[query]) return query;
    // Синоними
    if (PRODUCT_SYNONYMS[query]) return query;
    // Fuzzy по разстояние Левенщайн
    let best = null, bestDist = Infinity;
    for (const key of productMeasureNames) {
        const dist = levenshtein(key, query);
        if (dist < bestDist) {
            best = key;
            bestDist = dist;
        }
    }
    // threshold = 1 за къси думи, иначе 2-3
    if (bestDist <= Math.max(1, Math.floor(query.length * 0.3))) return best;
    return null;
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

    if (totalSteps === 0) {
        if(navigationContainer) navigationContainer.style.display = 'none';
        return;
    }

    // ... (оставям останалата логика за стъпките без промяна)

    const foodDescriptionInput = form.querySelector('#foodDescription');
    const suggestionsDropdown = form.querySelector('#foodSuggestionsDropdown');
    const quantityVisualRadios = form.querySelectorAll('input[name="quantityEstimateVisual"]');
    const mealTimeSelect = form.querySelector('#mealTimeSelect');
    const measureOptionsContainer = form.querySelector('#measureOptions');
    if (measureOptionsContainer) measureOptionsContainer.classList.add('hidden');
    const quantityHiddenInput = form.querySelector('#quantity');
    const quantityCustomInput = form.querySelector('#quantityCustom');
    const mealTimeSpecificInput = form.querySelector('#mealTimeSpecific');
    const reasonRadioGroup = form.querySelectorAll('input[name="reasonPrimary"]');
    const reasonOtherText = form.querySelector('#reasonOtherText');
    const replacedPlannedRadioGroup = form.querySelectorAll('input[name="replacedPlanned"]');
    const skippedMealSelect = form.querySelector('#skippedMeal');
    const macroInputsGrid = form.querySelector('.macro-inputs-grid');

    // --- OPTIMIZED: Покажи/скрий quantityVisual при наличие на конкретни мерки
    function toggleQuantityVisual(show) {
        quantityVisualRadios.forEach(radio => {
            const label = radio.closest('.quantity-card-option');
            if (label) label.style.display = show ? '' : 'none';
        });
    }

    // --- OPTIMIZED: updateMeasureOptions с fuzzy и автоматичен избор
    function updateMeasureOptions(desc) {
        if (!measureOptionsContainer) return;
        const key = fuzzyFindProductKey(desc);
        measureOptionsContainer.innerHTML = '';
        if (!key || !productMeasures[key]) {
            measureOptionsContainer.classList.add('hidden');
            toggleQuantityVisual(true);
            return;
        }
        // Ако има мерки, скрий quantityVisual
        toggleQuantityVisual(false);
        const measures = productMeasures[key] || [];
        const frag = document.createDocumentFragment();
        measures.forEach((m, i) => {
            const label = document.createElement('label');
            label.className = 'quantity-card-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'measureOption';
            radio.dataset.grams = m.grams;
            if (i === 0) radio.checked = true; // Автоматичен избор на първата мярка
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
        const otherContent = document.createElement('span');
        otherContent.className = 'card-content';
        otherContent.innerHTML = '<span class="card-label">Друго</span>';
        otherLabel.append(otherRadio, otherContent);
        frag.appendChild(otherLabel);

        measureOptionsContainer.appendChild(frag);
        measureOptionsContainer.classList.remove('hidden');
        computeQuantity();
    }

    // ... останалата логика остава същата, но:
    // - quantityVisual остава видим само ако няма мерки
    // - при input във foodDescription, винаги се вика updateMeasureOptions
    // - при избор на autocomplete - updateMeasureOptions
    // - quantityCustom парсва "2 ябълки" => 2 * default грамове, ако е възможно

    // OPTIMIZED: quantityCustom интелигентно парсване
    if (quantityCustomInput) {
        quantityCustomInput.addEventListener('input', () => {
            let val = quantityCustomInput.value.trim();
            // Парсирай "2 ябълки" или "2 x ябълка"
            let match = val.match(/^(\d+)\s*[xх*]?\s*(.+)$/i);
            if (match) {
                let count = parseInt(match[1], 10);
                let prod = match[2].trim().toLowerCase();
                let key = fuzzyFindProductKey(prod);
                if (key && productMeasures[key] && productMeasures[key][0]) {
                    let grams = count * productMeasures[key][0].grams;
                    quantityHiddenInput.value = grams;
                    // Попълни макроси
                    const product = findClosestProduct(key);
                    if (product) {
                        const scaled = scaleMacros(product, grams);
                        MACRO_FIELDS.forEach(f => form.querySelector(`input[name="${f}"]`).value = scaled[f].toFixed(2));
                    }
                }
            }
        });
    }

    // OPTIMIZED: при избор на autocomplete, автоматично зареди мерките
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
                foodDescriptionInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                updateMeasureOptions(name);
            });
            suggestionsDropdown.appendChild(div);
        });
        suggestionsDropdown.classList.remove('hidden');
    }

    if (foodDescriptionInput) {
        foodDescriptionInput.addEventListener('input', function() {
            updateMeasureOptions(this.value);
            // Останалата логика...
            showSuggestions(this.value);
        });
    }

    // --- Fallback при грешки
    if (!productMeasuresLoaded) {
        if (measureOptionsContainer) {
            measureOptionsContainer.innerHTML = '<span style="color:red">Неуспешно зареждане на мерки. Моля, въведете ръчно количество.</span>';
            measureOptionsContainer.classList.remove('hidden');
            toggleQuantityVisual(true);
        }
    }

    // ... всичко друго остава като в предишната версия
    if (steps.length > 0) showCurrentStep();
}
