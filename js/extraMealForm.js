// extraMealForm.js - Логика за Формата за Извънредно Хранене
import { selectors } from './uiElements.js';
import { showLoading, showToast, openModal as genericOpenModal, closeModal as genericCloseModal } from './uiHandlers.js';
import { apiEndpoints } from './config.js';
import { currentUserId, todaysExtraMeals, currentIntakeMacros, loadCurrentIntake, updateMacrosAndAnalytics, fullDashboardData } from './app.js';
import nutrientOverrides from '../kv/DIET_RESOURCES/nutrient_overrides.json' with { type: 'json' };
import { removeMealMacros, registerNutrientOverrides, getNutrientOverride, loadProductMacros } from './macroUtils.js';
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
async function ensureProductMeasuresLoaded() {
    if (productMeasuresLoaded) return;
    try {
        const { default: data } = await import('../kv/DIET_RESOURCES/product_measure.json', { with: { type: 'json' } });
        productMeasures = Object.fromEntries(
            Object.entries(data || {}).map(([k, v]) => [k.toLowerCase(), v])
        );
    } catch (e) {
        console.error('Неуспешно зареждане на мерни единици', e);
    }
    productMeasuresLoaded = true;
}

let extraMealFormLoaded = false;
let commonFoods = [];
let commonFoodsErrorShown = false;
if (typeof fetch !== 'undefined') {
    fetch(new URL("../data/commonFoods.json", import.meta.url))
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) commonFoods = d; })
        .catch(e => {
            console.error("Failed to load foods", e);
            if (!commonFoodsErrorShown) {
                showToast("Неуспешно зареждане на списъка с храни", true);
                commonFoodsErrorShown = true;
            }
        });
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

    function updateStepIndicator() {
        if (stepProgressBar) {
            const progressPercentage = totalSteps > 1 ? ((currentStepIndex + 1) / totalSteps) * 100 : (totalSteps === 1 ? 100 : 0);
            stepProgressBar.style.width = progressPercentage + '%';
        }
        if (currentStepNumberEl) currentStepNumberEl.textContent = currentStepIndex + 1;
        if (totalStepNumberEl) totalStepNumberEl.textContent = totalSteps;
    }

    function populateSummary() {
        const summaryContainer = form.querySelector('#extraMealSummary');
        if (!summaryContainer) return;
        const getElValue = (id) => form.querySelector(`#${id}`)?.value || '';
        const getSelectedText = (id) => {
            const el = form.querySelector(`#${id}`);
            if (el && el.selectedIndex !== -1 && el.options[el.selectedIndex]) {
                return el.options[el.selectedIndex].text;
            }
            return '';
        };
        const getRadioText = (name) => form.querySelector(`input[name="${name}"]:checked`)?.closest('label')?.textContent.trim() || '';
        const getIconRadioText = (name) => form.querySelector(`input[name="${name}"]:checked`)?.closest('label')?.querySelector('.icon-radio-text')?.textContent.trim() || '';

        summaryContainer.querySelector('[data-summary="foodDescription"]').textContent = getElValue('foodDescription') || 'Няма описание';

        const selectedQuantityRadio = form.querySelector('input[name="quantityEstimateVisual"]:checked');
        const quantityDisplay = getQuantityDisplay(selectedQuantityRadio, getElValue('quantityCustom'));
        summaryContainer.querySelector('[data-summary="quantityEstimate"]').textContent = quantityDisplay;

        let mealTimeDisplay = getSelectedText('mealTimeSelect');
        if (getElValue('mealTimeSpecific')) {
            try {
                const dateVal = getElValue('mealTimeSpecific');
                if (dateVal) mealTimeDisplay += ` (${new Date(dateVal).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })})`;
            } catch(e) { console.warn("EMF Warn: Error parsing mealTimeSpecific date for summary", e); }
        }
        summaryContainer.querySelector('[data-summary="mealTimeSelect"]').textContent = mealTimeDisplay;
        let reasonDisplay = getRadioText('reasonPrimary');
        if (getElValue('reasonOtherText')) reasonDisplay += ` (${getElValue('reasonOtherText')})`;
        summaryContainer.querySelector('[data-summary="reasonPrimary"]').textContent = reasonDisplay;
        summaryContainer.querySelector('[data-summary="feelingAfter"]').textContent = getIconRadioText('feelingAfter');
        let replacedDisplay = getRadioText('replacedPlanned');
        const skippedMealVal = getSelectedText('skippedMeal');
        const replacedVal = form.querySelector('input[name="replacedPlanned"]:checked')?.value;
        if ((replacedVal === 'да_напълно' || replacedVal === 'да_частично') && skippedMealVal && !skippedMealVal.includes("-- Кое хранене беше засегнато? --")) {
            replacedDisplay += ` (Засегнато: ${skippedMealVal})`;
        }
        summaryContainer.querySelector('[data-summary="replacedPlanned"]').textContent = replacedDisplay;

        MACRO_FIELDS.forEach(field => {
            const el = summaryContainer.querySelector(`[data-summary="${field}"]`);
            if (el) {
                const input = form.querySelector(`input[name="${field}"]`);
                const val = input?.value || '';
                el.textContent = val ? val : '-';
            }
        });
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
        if (currentStepIndex === totalSteps - 1) populateSummary();
    }

    if (nextBtn) nextBtn.addEventListener('click', () => { if (currentStepIndex < totalSteps - 1) { currentStepIndex++; showCurrentStep(); }});
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentStepIndex > 0) { currentStepIndex--; showCurrentStep(); }});

    const foodDescriptionInput = form.querySelector('#foodDescription');
    const suggestionsDropdown = form.querySelector('#foodSuggestionsDropdown');
    const quantityVisualRadios = form.querySelectorAll('input[name="quantityEstimateVisual"]');
    const mealTimeSelect = form.querySelector('#mealTimeSelect');
    const measureSelect = form.querySelector('#measureSelect');
    const measureCountInput = form.querySelector('#measureCount');
    const quantityHiddenInput = form.querySelector('#quantity');
    const mealTimeSpecificInput = form.querySelector('#mealTimeSpecific');
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

    let activeSuggestionIndex = -1;

    function updateMeasureOptions(name) {
        if (!measureSelect || !measureCountInput) return;
        const measures = productMeasures[(name || '').toLowerCase()] || [];
        measureSelect.innerHTML = '';
        if (measures.length > 0) {
            const frag = document.createDocumentFragment();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- Мерна единица --';
            frag.appendChild(placeholder);
            measures.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.grams;
                opt.textContent = m.label;
                opt.dataset.grams = m.grams;
                frag.appendChild(opt);
            });
            measureSelect.appendChild(frag);
            measureSelect.classList.remove('hidden');
            measureCountInput.classList.remove('hidden');
            measureCountInput.value = 1;
        } else {
            measureSelect.classList.add('hidden');
            measureCountInput.classList.add('hidden');
            measureCountInput.value = '';
        }
        computeQuantity();
    }

    function computeQuantity() {
        if (!quantityHiddenInput) return;
        const grams = Number(measureSelect?.selectedOptions[0]?.dataset.grams || 0);
        const count = Number(measureCountInput?.value || 0);
        const total = grams * count;
        quantityHiddenInput.value = total > 0 ? String(total) : '';
        const description = foodDescriptionInput?.value?.trim().toLowerCase();
        if (autoFillMsg) autoFillMsg.classList.add('hidden');
        if (description && total > 0) {
            const product = productList.find(p => p.name.toLowerCase() === description);
            if (product) {
                const factor = total / 100;
                MACRO_FIELDS.forEach(field => {
                    const input = form.querySelector(`input[name="${field}"]`);
                    if (input) input.value = ((product[field] ?? 0) * factor).toFixed(2);
                });
                if (autoFillMsg) autoFillMsg.classList.remove('hidden');
            } else {
                applyMacroOverrides(description, total);
                if (!getNutrientOverride(buildCacheKey(description, total))) {
                    fetchAndApplyMacros(description, total);
                }
            }
        }
    }

    if (measureSelect) measureSelect.addEventListener('change', computeQuantity);
    if (measureCountInput) measureCountInput.addEventListener('input', computeQuantity);

    function applyMacroOverrides(name, quantity = '') {
        const macros = getNutrientOverride(buildCacheKey(name, quantity));
        if (!macros) return;
        let filled = false;
        MACRO_FIELDS.forEach(field => {
            const input = form.querySelector(`input[name="${field}"]`);
            if (input && !input.value) {
                input.value = macros[field] ?? '';
                filled = true;
            }
        });
        if (filled && autoFillMsg) autoFillMsg.classList.remove('hidden');
    }

    async function fetchAndApplyMacros(name, quantity = '') {
        try {
            await nutrientLookup(name, quantity);
            applyMacroOverrides(name, quantity);
        } catch (e) {
            console.error('Nutrient lookup failed', e);
        }
    }

    function showSuggestions(inputValue) {
        if (!suggestionsDropdown || !foodDescriptionInput) return;
        suggestionsDropdown.innerHTML = '';
        if (!inputValue || inputValue.length < 1) { suggestionsDropdown.classList.add('hidden'); return; }
        const filtered = productList.filter(p => p.name.toLowerCase().includes(inputValue.toLowerCase()));
        if (filtered.length === 0) { suggestionsDropdown.classList.add('hidden'); return; }
        activeSuggestionIndex = -1;
        const grouped = filtered.reduce((acc, p) => {
            const cat = p.category || 'Друго';
            (acc[cat] = acc[cat] || []).push(p);
            return acc;
        }, {});
        Object.entries(grouped).forEach(([cat, items]) => {
            const header = document.createElement('div');
            header.textContent = cat;
            header.className = 'suggestion-category';
            header.setAttribute('role', 'presentation');
            header.style.cssText = 'font-weight:600;padding:0.25rem 0.5rem;background:var(--surface-background);';
            suggestionsDropdown.appendChild(header);
            items.slice(0, 5).forEach((item) => {
                const div = document.createElement('div');
                div.textContent = item.name;
                div.setAttribute('role', 'option');
                div.tabIndex = -1;
                div.addEventListener('click', () => {
                    foodDescriptionInput.value = item.name;
                    suggestionsDropdown.classList.add('hidden');
                    foodDescriptionInput.focus();
                    foodDescriptionInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                });
                suggestionsDropdown.appendChild(div);
            });
        });
        suggestionsDropdown.classList.remove('hidden');
    }

    function updateActiveSuggestion(suggestionsElements) {
        suggestionsElements.forEach((div, index) => {
            const isActive = index === activeSuggestionIndex;
            div.classList.toggle('active-suggestion', isActive); div.setAttribute('aria-selected', isActive.toString());
            if (isActive) div.scrollIntoView({ block: 'nearest' });
        });
    }


    function getCurrentQuantity() {
        const hiddenVal = form.querySelector('#quantity')?.value;
        if (hiddenVal) return hiddenVal;
        const selected = form.querySelector('input[name="quantityEstimateVisual"]:checked');
        if (!selected) return '';
        if (selected.value === 'other_quantity_describe') {
            return form.querySelector('#quantityCustom')?.value.trim() || '';
        }
        return selected.value;
    }

    if (foodDescriptionInput && quantityVisualRadios.length > 0) {
        foodDescriptionInput.addEventListener('input', function() {
            const description = this.value.toLowerCase();
            updateMeasureOptions(description);
            const quantity = getCurrentQuantity();
            if (autoFillMsg) autoFillMsg.classList.add('hidden');
            applyMacroOverrides(description, quantity);
            if (description.length >= 3 && !getNutrientOverride(buildCacheKey(description, quantity))) {
                fetchAndApplyMacros(description, quantity);
            }
            let suggestedRadioValue = null;
            if (description.includes("фили") && (description.includes("2") || description.includes("две"))) {
                suggestedRadioValue = "малко_количество";
            } else if (description.includes("чаша") && (description.includes("1") || description.includes("една"))) {
                suggestedRadioValue = "средно_количество";
            } else if (description.includes("ябълка") || description.includes("банан") || description.includes("портокал")) {
                 suggestedRadioValue = "малко_количество";
            }
            if (suggestedRadioValue) {
                const radioToSelect = form.querySelector(`input[name="quantityEstimateVisual"][value="${suggestedRadioValue}"]`);
                if (radioToSelect) {
                    radioToSelect.checked = true;
                    radioToSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                }
            }
        });
    }

    if (foodDescriptionInput) {
        foodDescriptionInput.addEventListener('input', function() { showSuggestions(this.value); });
        foodDescriptionInput.addEventListener('focus', function() { if(this.value.length >=1 && suggestionsDropdown) showSuggestions(this.value); });
        foodDescriptionInput.addEventListener('blur', function() { setTimeout(() => { if (suggestionsDropdown && !suggestionsDropdown.contains(document.activeElement)) { suggestionsDropdown.classList.add('hidden'); } }, 150); });
        foodDescriptionInput.addEventListener('keydown', function(e) {
            if (!suggestionsDropdown) return;
            const suggestionsElements = Array.from(suggestionsDropdown.querySelectorAll('div[role="option"]'));
            if (suggestionsElements.length === 0 || suggestionsDropdown.classList.contains('hidden')) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestionsElements.length; updateActiveSuggestion(suggestionsElements); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestionsElements.length) % suggestionsElements.length; updateActiveSuggestion(suggestionsElements); }
            else if (e.key === 'Enter' && activeSuggestionIndex > -1) {
                e.preventDefault();
                if(suggestionsElements[activeSuggestionIndex]) suggestionsElements[activeSuggestionIndex].click();
                activeSuggestionIndex = -1;
            }
            else if (e.key === 'Escape') { suggestionsDropdown.classList.add('hidden'); activeSuggestionIndex = -1; }
        });
    }

    if (mealTimeSelect) {
        mealTimeSelect.addEventListener('change', function() {
            if (!mealTimeSpecificInput) return;
            const showSpecific = this.value === 'specific_time' || this.value === 'yesterday_specific_time';
            mealTimeSpecificInput.classList.toggle('hidden', !showSpecific);
            if (showSpecific) {
                const now = new Date();
                if (this.value === 'yesterday_specific_time') now.setDate(now.getDate() - 1);
                const year = now.getFullYear(), month = String(now.getMonth() + 1).padStart(2, '0'), day = String(now.getDate()).padStart(2, '0');
                let hours = String(now.getHours()).padStart(2, '0'), minutes = String(now.getMinutes()).padStart(2, '0');
                mealTimeSpecificInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                mealTimeSpecificInput.focus();
            }
        });
    }
    reasonRadioGroup.forEach(radio => {
        radio.addEventListener('change', function() {
            if(reasonOtherText) reasonOtherText.classList.toggle('hidden', this.value !== 'other_reason' || !this.checked);
            if (this.value === 'other_reason' && this.checked && reasonOtherText) reasonOtherText.focus();
        });
    });
    replacedPlannedRadioGroup.forEach(radio => {
        radio.addEventListener('change', function() {
            if(skippedMealSelect) skippedMealSelect.classList.toggle('hidden', (this.value !== 'да_напълно' && this.value !== 'да_частично') || !this.checked);
            if((this.value === 'да_напълно' || this.value === 'да_частично') && this.checked && skippedMealSelect) skippedMealSelect.focus();
        });
    });
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            genericCloseModal(selectors.extraMealEntryModal.id);
        });
    }
    form.querySelectorAll('.icon-radio-label input[type="radio"]').forEach(radio => {
        const label = radio.closest('.icon-radio-label');
        if(radio.checked && label) label.classList.add('selected');
        radio.addEventListener('change', function() {
            form.querySelectorAll('.icon-radio-label').forEach(l => l.classList.remove('selected'));
            const currentLabel = this.closest('.icon-radio-label');
            if (this.checked && currentLabel) currentLabel.classList.add('selected');
        });
    });

    if (steps.length > 0) showCurrentStep();
}

export async function openExtraMealModal() {
    if (!selectors.extraMealEntryModal || !selectors.extraMealFormContainer) {
        console.error("Selectors (extraMealEntryModal or extraMealFormContainer) are not defined.");
        return;
    }
    const modal = selectors.extraMealEntryModal, formContainer = selectors.extraMealFormContainer;
    if (!modal || !formContainer) { console.error("Extra meal modal or form container not found via selectors."); return; }

    if (!extraMealFormLoaded) {
        formContainer.innerHTML = `<div class="placeholder-form-loading"><svg class="icon spinner" style="width:30px;height:30px;"><use href="#icon-spinner"/></svg><p>Зареждане...</p></div>`;
        try {
            const templateUrl = 'extra-meal-entry-form.html';
            const resolved = new URL(templateUrl, window.location.href);
            if (resolved.origin !== window.location.origin) {
                throw new Error('Cross-origin template load blocked.');
            }
            const response = await fetch(resolved);
            if (!response.ok) throw new Error(`Грешка зареждане форма: ${response.status}`);
            const raw = await response.text();
            formContainer.innerHTML = sanitizeHTML(raw);
            await initializeExtraMealFormLogic(formContainer);
            extraMealFormLoaded = true;
            genericOpenModal('extraMealEntryModal');
            const actualForm = formContainer.querySelector('#extraMealEntryFormActual');
            if (actualForm) {
                actualForm.removeEventListener('submit', handleExtraMealFormSubmit);
                actualForm.addEventListener('submit', handleExtraMealFormSubmit);
            }
        } catch (error) {
            formContainer.innerHTML = `<p style="color:var(--color-danger);text-align:center;">Грешка при зареждане на формата: ${error.message}</p><button class="button-secondary modal-close-btn" data-modal-close="extraMealEntryModal" style="margin-top:1rem;">Затвори</button>`;
            genericOpenModal('extraMealEntryModal');
        }
    } else {
        const actualForm = formContainer.querySelector('#extraMealEntryFormActual');
        if (actualForm) {
            actualForm.reset();
            const firstQuantityRadio = actualForm.querySelector('input[name="quantityEstimateVisual"][value="не_посочено_в_стъпка_2"]');
            if (firstQuantityRadio) firstQuantityRadio.checked = true;
            await initializeExtraMealFormLogic(formContainer);
        }
        genericOpenModal('extraMealEntryModal');
    }
}

export async function fetchMacrosFromAi(_foodDescription, quantity) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
        showToast('Количеството трябва да е положително число.', true);
        throw new Error('Invalid quantity');
    }
    try {
        return await nutrientLookup(_foodDescription, qty);
    } catch (e) {
        console.error('Nutrient lookup failed', e);
        showToast('Неуспешно извличане на макроси', true);
        throw e;
    }
}

export function __setNutrientLookupFn(fn) {
    nutrientLookup = fn;
}

export async function handleExtraMealFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const quantityCustomVal = (formData.get('quantityCustom') || '').trim();
    let quantityField = (formData.get('quantity') || '').toString().trim();
    if (!quantityField && quantityCustomVal) {
        const match = quantityCustomVal.match(/[\d.,]+/);
        if (match) {
            quantityField = match[0].replace(',', '.');
            formData.set('quantity', quantityField);
        }
    }

    let parsedQuantity;
    if (quantityField) {
        parsedQuantity = Number(quantityField);
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            showToast('Количеството трябва да е положително число.', true);
            return;
        }
    }

    const selectedVisual = form.querySelector('input[name="quantityEstimateVisual"]:checked');
    if (!selectedVisual && !quantityCustomVal) {
        showToast('Моля, изберете количество или въведете стойност.', true);
        return;
    }

    const macrosEmpty = MACRO_FIELDS.every(field => {
        const val = formData.get(field);
        return val === null || val === undefined || String(val).trim() === '';
    });

    if (macrosEmpty && parsedQuantity !== undefined) {
        try {
            const desc = (formData.get('foodDescription') || '').toString().trim();
            const macros = await fetchMacrosFromAi(desc, parsedQuantity);
            MACRO_FIELDS.forEach(field => {
                if (macros[field] !== undefined) {
                    formData.set(field, macros[field]);
                    const input = form.querySelector(`input[name="${field}"]`);
                    if (input) input.value = macros[field];
                    const summaryEl = form.querySelector(`#extraMealSummary [data-summary="${field}"]`);
                    if (summaryEl) summaryEl.textContent = macros[field];
                }
            });
            const autoFillMsgEl = form.querySelector('#autoFillMsg');
            if (autoFillMsgEl) autoFillMsgEl.classList.remove('hidden');
        } catch (err) {
            console.error('Неуспешно извличане на макроси', err);
        }
    }

    const dataToSend = { userId: currentUserId, timestamp: new Date().toISOString() };
    if (parsedQuantity !== undefined) dataToSend.quantity = parsedQuantity;

    let quantityDisplay = getQuantityDisplay(selectedVisual, quantityCustomVal);
    if (!selectedVisual && quantityCustomVal) {
        dataToSend.quantityEstimate = quantityCustomVal;
    }

    for (let [key, value] of formData.entries()) {
        if (key === 'quantityEstimateVisual') {
            dataToSend['quantityEstimate'] = value;
        } else if (MACRO_FIELDS.includes(key)) {
            const num = parseFloat(value);
            if (!isNaN(num)) dataToSend[key] = num;
        } else {
            dataToSend[key] = value;
        }
    }

    if (dataToSend.quantityEstimate === "other_quantity_describe") {
        if (dataToSend.quantityCustom && dataToSend.quantityCustom.trim() !== '') {
            dataToSend.quantityEstimate = dataToSend.quantityCustom;
        } else {
            dataToSend.quantityEstimate = "друго_неуточнено";
        }
    } else if (dataToSend.quantityEstimate === "не_посочено_в_стъпка_2") {
        if (dataToSend.foodDescription && dataToSend.foodDescription.trim() !== '') {
            dataToSend.quantityEstimate = "описано_в_текст";
        } else {
            dataToSend.quantityEstimate = "не_посочено_количество";
        }
    }

    if (!dataToSend.quantityCustom || dataToSend.quantityCustom.trim() === '' ||
        ((!selectedVisual || selectedVisual.value === 'other_quantity_describe') && dataToSend.quantityEstimate === dataToSend.quantityCustom) ) {
        delete dataToSend.quantityCustom;
    }

    if (!quantityDisplay) quantityDisplay = dataToSend.quantityEstimate || '';

    showLoading(true, "Записване...");
    try {
        if (!apiEndpoints.logExtraMeal) {
            throw new Error("apiEndpoints.logExtraMeal is not defined.");
        }
        const response = await fetch(apiEndpoints.logExtraMeal, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
        showToast(result.message || "Храненето е записано!", false);
        const entry = {};
        MACRO_FIELDS.forEach(field => { entry[field] = dataToSend[field]; });
        addExtraMealWithOverride(dataToSend.foodDescription, entry);
        // Актуализираме дневните логове с новото хранене
        const todayStr = getLocalDate();
        if (!Array.isArray(fullDashboardData.dailyLogs)) fullDashboardData.dailyLogs = [];
        let todayLog = fullDashboardData.dailyLogs.find(l => l.date === todayStr);
        if (!todayLog) {
            todayLog = { date: todayStr, data: { extraMeals: [] } };
            fullDashboardData.dailyLogs.push(todayLog);
        }
        if (!Array.isArray(todayLog.data.extraMeals)) todayLog.data.extraMeals = [];
        todayLog.data.extraMeals.push(entry);
        appendExtraMealCard(dataToSend.foodDescription, quantityDisplay);
        // Синхронизираме макросите и аналитиката
        updateMacrosAndAnalytics();
        genericCloseModal('extraMealEntryModal');
    } catch (error) {
        showToast(`Грешка: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}

export function deleteExtraMeal(index) {
    const [removed] = todaysExtraMeals.splice(index, 1);
    if (removed) {
        removeMealMacros(removed, currentIntakeMacros);
        loadCurrentIntake();
        // Опресняваме макросите и аналитиката след изтриване
        updateMacrosAndAnalytics();
        showToast('Храненето е изтрито.', false, 2000);
    }
}
