// extraMealForm.js - Логика за Формата за Извънредно Хранене
import { selectors } from './uiElements.js';
import { showLoading, showToast, openModal as genericOpenModal, closeModal as genericCloseModal } from './uiHandlers.js';
import { apiEndpoints } from './config.js';
import { currentUserId } from './app.js'; // Accessing currentUserId from app.js

let extraMealFormLoaded = false;
let commonFoods = [];
let commonFoodsErrorShown = false;
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

function initializeExtraMealFormLogic(formContainerElement) {
    const form = formContainerElement.querySelector('#extraMealEntryFormActual');
    if (!form) {
        console.error("EMF Logic Error: Form #extraMealEntryFormActual not found within container!");
        return;
    }

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

        let quantityDisplay = "";
        const selectedQuantityRadio = form.querySelector('input[name="quantityEstimateVisual"]:checked');
        if (selectedQuantityRadio) {
            const radioValue = selectedQuantityRadio.value;
            if (radioValue === 'other_quantity_describe') {
                const customVal = getElValue('quantityCustom').trim();
                quantityDisplay = customVal ? customVal : "Друго (неуточнено)";
            } else if (radioValue === 'не_посочено_в_стъпка_2') {
                quantityDisplay = "(описано в стъпка 1)";
            } else {
                const cardLabelEl = selectedQuantityRadio.closest('.quantity-card-option')?.querySelector('.card-label');
                quantityDisplay = cardLabelEl ? cardLabelEl.textContent.trim() : radioValue;
            }
        } else {
            quantityDisplay = 'Не е посочено';
        }
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
    const quantityCustomInput = form.querySelector('#quantityCustom');
    const quantityVisualRadios = form.querySelectorAll('input[name="quantityEstimateVisual"]');
    const mealTimeSelect = form.querySelector('#mealTimeSelect');
    const mealTimeSpecificInput = form.querySelector('#mealTimeSpecific');
    const reasonRadioGroup = form.querySelectorAll('input[name="reasonPrimary"]');
    const reasonOtherText = form.querySelector('#reasonOtherText');
    const replacedPlannedRadioGroup = form.querySelectorAll('input[name="replacedPlanned"]');
    const skippedMealSelect = form.querySelector('#skippedMeal');

    let activeSuggestionIndex = -1;

    function showSuggestions(inputValue) {
        if (!suggestionsDropdown || !foodDescriptionInput) return;
        suggestionsDropdown.innerHTML = '';
        if (!inputValue || inputValue.length < 1) { suggestionsDropdown.classList.add('hidden'); return; }
        const filteredFoods = commonFoods.filter(food => food.toLowerCase().includes(inputValue.toLowerCase()));
        if (filteredFoods.length === 0) { suggestionsDropdown.classList.add('hidden'); return; }
        activeSuggestionIndex = -1;
        filteredFoods.slice(0, 5).forEach((food) => {
            const div = document.createElement('div'); div.textContent = food; div.setAttribute('role', 'option'); div.tabIndex = -1;
            div.addEventListener('click', () => {
                foodDescriptionInput.value = food; suggestionsDropdown.classList.add('hidden'); foodDescriptionInput.focus();
                foodDescriptionInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            });
            suggestionsDropdown.appendChild(div);
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

    if (quantityVisualRadios.length > 0 && quantityCustomInput) {
        quantityVisualRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'other_quantity_describe' && this.checked) {
                    quantityCustomInput.classList.remove('hidden');
                    quantityCustomInput.focus();
                } else {
                    quantityCustomInput.classList.add('hidden');
                }
            });
        });
        const initiallyCheckedRadio = form.querySelector('input[name="quantityEstimateVisual"]:checked');
        if (initiallyCheckedRadio && initiallyCheckedRadio.value === 'other_quantity_describe') {
            quantityCustomInput.classList.remove('hidden');
        } else if (quantityCustomInput) {
            quantityCustomInput.classList.add('hidden');
        }
    }

    if (foodDescriptionInput && quantityVisualRadios.length > 0) {
        foodDescriptionInput.addEventListener('input', function() {
            const description = this.value.toLowerCase();
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
            const response = await fetch('extra-meal-entry-form.html');
            if (!response.ok) throw new Error(`Грешка зареждане форма: ${response.status}`);
            formContainer.innerHTML = await response.text();
            initializeExtraMealFormLogic(formContainer);
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
            initializeExtraMealFormLogic(formContainer);
        }
        genericOpenModal('extraMealEntryModal');
    }
}

async function handleExtraMealFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const dataToSend = { userId: currentUserId, timestamp: new Date().toISOString() };

    for (let [key, value] of formData.entries()) {
        if (key === 'quantityEstimateVisual') {
            dataToSend['quantityEstimate'] = value;
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
        (form.querySelector('input[name="quantityEstimateVisual"]:checked')?.value === 'other_quantity_describe' && dataToSend.quantityEstimate === dataToSend.quantityCustom) ) {
        delete dataToSend.quantityCustom;
    }

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
        genericCloseModal('extraMealEntryModal');
    } catch (error) {
        showToast(`Грешка: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}
