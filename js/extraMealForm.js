// extraMealForm.js - Логика за Формата за Извънредно Хранене (оптимизирана)
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
    const summaryData = {
        foodDescription: form.querySelector('#foodDescription')?.value.trim() || '',
        quantityEstimate: getQuantityDisplay(
            form.querySelector('input[name="quantityEstimateVisual"]:checked'),
            form.querySelector('#quantityCustom')?.value
        ),
        calories: form.querySelector('input[name="calories"]')?.value || '',
        protein: form.querySelector('input[name="protein"]')?.value || '',
        carbs: form.querySelector('input[name="carbs"]')?.value || '',
        fat: form.querySelector('input[name="fat"]')?.value || '',
        fiber: form.querySelector('input[name="fiber"]')?.value || '',
        reasonPrimary: form.querySelector('input[name="reasonPrimary"]:checked')?.value || '',
        feelingAfter: form.querySelector('input[name="feelingAfter"]:checked')?.value || '',
        replacedPlanned: form.querySelector('input[name="replacedPlanned"]:checked')?.value || ''
    };
    Object.entries(summaryData).forEach(([key, value]) => {
        const el = form.querySelector(`[data-summary="${key}"]`);
        if (el) el.textContent = value;
    });
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

    function updateStepIndicator() {
        if (stepProgressBar) {
            const progressPercentage = totalSteps > 1 ? ((currentStepIndex + 1) / totalSteps) * 100 : (totalSteps === 1 ? 100 : 0);
            stepProgressBar.style.width = progressPercentage + '%';
        }
        if (currentStepNumberEl) currentStepNumberEl.textContent = currentStepIndex + 1;
        if (totalStepNumberEl) totalStepNumberEl.textContent = totalSteps;
    }
    function showCurrentStep() {
        steps.forEach((step, index) => {
            step.style.display = (index === currentStepIndex) ? 'block' : 'none';
            if (index === currentStepIndex) {
                step.classList.add('active-step');
                const firstInput = step.querySelector('input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)');
                if (firstInput) setTimeout(() => { try { firstInput.focus({ preventScroll: true }); } catch(e){} }, 60);
            } else {
                step.classList.remove('active-step');
            }
        });
        if (prevBtn) prevBtn.style.display = (currentStepIndex > 0) ? 'inline-flex' : 'none';
        if (nextBtn) nextBtn.style.display = (currentStepIndex < totalSteps - 1) ? 'inline-flex' : 'none';
        if (submitBtn) submitBtn.style.display = (currentStepIndex === totalSteps - 1) ? 'inline-flex' : 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        updateStepIndicator();
        if (currentStepIndex === totalSteps - 1) populateSummary(form);
    }
    if (nextBtn) nextBtn.addEventListener('click', () => { if (currentStepIndex < totalSteps - 1) { currentStepIndex++; showCurrentStep(); }});
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentStepIndex > 0) { currentStepIndex--; showCurrentStep(); }});

    const foodDescriptionInput = form.querySelector('#foodDescription');
    const suggestionsDropdown = form.querySelector('#foodSuggestionsDropdown');
    const quantityVisualRadios = form.querySelectorAll('input[name="quantityEstimateVisual"]');
    quantityVisualRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            quantityVisualRadios.forEach(r => r.closest('.quantity-card-option')?.classList.toggle('selected', r.checked));
        });
    });
    const measureOptionsContainer = form.querySelector('#measureOptions');
    if (measureOptionsContainer) measureOptionsContainer.classList.add('hidden');
    const measureInput = form.querySelector('#measureInput');
    const measureSuggestionList = form.querySelector('#measureSuggestionList');
    if (measureInput) measureInput.classList.add('hidden');
    const quantityHiddenInput = form.querySelector('#quantity');
    const quantityCustomInput = form.querySelector('#quantityCustom');
    const quantityCountInput = form.querySelector('#quantityCountInput');
    let quantityLookupLoading = false;
    let quantityLookupSpinner;
    if (quantityCustomInput) {
        quantityLookupSpinner = document.createElement('svg');
        quantityLookupSpinner.classList.add('icon', 'spinner', 'lookup-spinner', 'hidden');
        quantityLookupSpinner.innerHTML = '<use href="#icon-spinner"></use>';
        quantityCustomInput.insertAdjacentElement('afterend', quantityLookupSpinner);
    }
    const reasonRadioGroup = form.querySelectorAll('input[name="reasonPrimary"]');
    const reasonOtherText = form.querySelector('#reasonOtherText');
    const replacedPlannedRadioGroup = form.querySelectorAll('input[name="replacedPlanned"]');
    const skippedMealSelect = form.querySelector('#skippedMeal');
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

    function updateMeasureSuggestions(desc) {
        if (!measureSuggestionList || !measureInput) return;
        const labels = getMeasureLabels(desc);
        measureSuggestionList.innerHTML = '';
        if (labels.length === 0) {
            measureInput.classList.add('hidden');
            return;
        }
        labels.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l;
            measureSuggestionList.appendChild(opt);
        });
        measureInput.classList.remove('hidden');
    }

    function computeQuantity() {
        if (!quantityHiddenInput) return;
        const selectedMeasure = measureOptionsContainer?.querySelector('input[name="measureOption"]:checked');
        const total = Number(selectedMeasure?.dataset.grams || 0);
        quantityHiddenInput.value = total > 0 ? String(total) : '';
        const description = foodDescriptionInput?.value?.trim().toLowerCase();
        if (autoFillMsg) autoFillMsg.classList.add('hidden');
        if (description && total > 0) {
            const product = findClosestProduct(description);
            if (product) {
                const scaled = scaleMacros(product, total);
                MACRO_FIELDS.forEach(f => form.querySelector(`input[name="${f}"]`).value = scaled[f].toFixed(2));
                if (autoFillMsg) autoFillMsg.classList.remove('hidden');
            }
        }
    }

    function computeQuantityFromManual() {
        if (!quantityHiddenInput || !quantityCustomInput || !measureInput || !quantityCountInput) return;
        const count = parseFloat(quantityCountInput.value);
        const label = measureInput.value.trim().toLowerCase();
        const desc = foodDescriptionInput?.value?.trim().toLowerCase() || '';
        if (!desc || !label || !(count > 0)) return;
        const key = fuzzyFindProductKey(desc);
        const measure = key ? (productMeasures[key] || []).find(m => m.label.toLowerCase() === label) : null;
        if (!measure) return;
        const grams = measure.grams * count;
        quantityHiddenInput.value = String(grams);
        quantityCustomInput.value = `${grams} гр`;
        if (autoFillMsg) autoFillMsg.classList.add('hidden');
        const product = findClosestProduct(desc);
        if (product) {
            const scaled = scaleMacros(product, grams);
            MACRO_FIELDS.forEach(f => form.querySelector(`input[name="${f}"]`).value = scaled[f].toFixed(2));
            if (autoFillMsg) autoFillMsg.classList.remove('hidden');
        }
    }

    if (quantityCountInput) quantityCountInput.addEventListener('input', computeQuantityFromManual);
    if (measureInput) measureInput.addEventListener('input', computeQuantityFromManual);

    // динамична калкулация при промяна на quantityCustom
    if (quantityCustomInput) {
        let lookupTimer;
        quantityCustomInput.addEventListener('input', () => {
            let val = quantityCustomInput.value.trim();
            const match = val.match(/^(\d+)\s*[xх*]?\s*(.+)$/i);
            if (match) {
                const count = parseInt(match[1], 10);
                const prod = match[2].trim().toLowerCase();
                const key = fuzzyFindProductKey(prod);
                if (key && productMeasures[key] && productMeasures[key][0]) {
                    const grams = count * productMeasures[key][0].grams;
                    quantityHiddenInput.value = grams;
                    const product = findClosestProduct(key);
                    if (product) {
                        const scaled = scaleMacros(product, grams);
                        MACRO_FIELDS.forEach(f => form.querySelector(`input[name="${f}"]`).value = scaled[f].toFixed(2));
                        if (autoFillMsg) autoFillMsg.classList.remove('hidden');
                    }
                }
            }

            clearTimeout(lookupTimer);
            lookupTimer = setTimeout(async () => {
                const desc = foodDescriptionInput?.value?.trim();
                const qty = quantityCustomInput.value.trim();
                if (!desc || !qty || quantityLookupLoading) return;
                quantityLookupLoading = true;
                quantityLookupSpinner?.classList.remove('hidden');
                try {
                    const data = await nutrientLookup(desc, qty);
                    MACRO_FIELDS.forEach(f => {
                        const field = form.querySelector(`input[name="${f}"]`);
                        if (field && data[f] !== undefined) field.value = Number(data[f]).toFixed(2);
                    });
                    if (autoFillMsg) autoFillMsg.classList.remove('hidden');
                } catch (err) {
                    console.error('Невъзможно изчисление на макроси', err);
                } finally {
                    quantityLookupSpinner?.classList.add('hidden');
                    quantityLookupLoading = false;
                }
            }, 300);
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
                updateMeasureSuggestions(name);
            });
            suggestionsDropdown.appendChild(div);
        });
        suggestionsDropdown.classList.remove('hidden');
    }

    if (foodDescriptionInput) {
        foodDescriptionInput.addEventListener('input', function() {
            updateMeasureOptions(this.value);
            updateMeasureSuggestions(this.value);
            showSuggestions(this.value);
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
