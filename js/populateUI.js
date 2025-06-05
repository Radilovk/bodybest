// populateUI.js - Попълване на UI с данни
import { selectors, trackerInfoTexts, detailedMetricInfoTexts } from './uiElements.js';
import { safeGet, safeParseFloat, capitalizeFirstLetter } from './utils.js';
import { generateId } from './config.js';
import { fullDashboardData, todaysMealCompletionStatus } from './app.js'; // Assuming app.js exports these
import { showToast, openModal, closeModal } from './uiHandlers.js'; // For populateDashboardDetailedAnalytics accordion

export function populateUI() {
    const data = fullDashboardData; // Access global state
    if (!data || Object.keys(data).length === 0) {
        showToast("Липсват данни за показване.", true); return;
    }
    try { populateUserInfo(data.userName); } catch(e) { console.error("Error in populateUserInfo:", e); }
    try { populateDashboardMainIndexes(data.analytics?.current); } catch(e) { console.error("Error in populateDashboardMainIndexes:", e); }
    try { populateDashboardDetailedAnalytics(data.analytics); } catch(e) { console.error("Error in populateDashboardDetailedAnalytics:", e); }
    try { populateDashboardDailyPlan(data.planData?.week1Menu, data.dailyLogs, data.recipeData); } catch(e) { console.error("Error in populateDashboardDailyPlan:", e); }
    try { populateDashboardLog(data.dailyLogs, data.currentStatus, data.initialData); } catch(e) { console.error("Error in populateDashboardLog:", e); }
    try { populateProfileTab(data.userName, data.initialData, data.currentStatus, data.initialAnswers); } catch(e) { console.error("Error in populateProfileTab:", e); }
    try { populateWeekPlanTab(data.planData?.week1Menu, data.planData?.currentPrinciples || data.planData?.principlesWeek2_4); } catch(e) { console.error("Error in populateWeekPlanTab:", e); }
    try { populateRecsTab(data.planData, data.initialAnswers); } catch(e) { console.error("Error in populateRecsTab:", e); }
    try { populateProgressHistory(data.dailyLogs, data.initialData); } catch(e) { console.error("Error in populateProgressHistory:", e); }
}

function populateUserInfo(userName) {
    if (selectors.headerTitle) selectors.headerTitle.textContent = `Табло: ${userName || 'Потребител'}`;
}

function populateDashboardMainIndexes(currentAnalytics) {
    if (!currentAnalytics) {
        const defaultText = "Няма данни";
        if(selectors.goalProgressText) selectors.goalProgressText.textContent = defaultText;
        if(selectors.engagementProgressText) selectors.engagementProgressText.textContent = defaultText;
        if(selectors.healthProgressText) selectors.healthProgressText.textContent = defaultText;
        if(selectors.goalProgressMask) selectors.goalProgressMask.style.width = '100%';
        if(selectors.engagementProgressMask) selectors.engagementProgressMask.style.width = '100%';
        if(selectors.healthProgressMask) selectors.healthProgressMask.style.width = '100%';
        return;
    }
    const goalProgressPercent = safeGet(currentAnalytics, 'goalProgress', 0);
    if (selectors.goalProgressMask) selectors.goalProgressMask.style.width = `${100 - Math.max(0, Math.min(100, goalProgressPercent))}%`;
    if (selectors.goalProgressText) {
        const goal = safeGet(fullDashboardData.initialAnswers, 'goal', '').toLowerCase();
        const startWeight = safeParseFloat(safeGet(fullDashboardData.initialData, 'weight'));
        const lossKgTarget = safeParseFloat(safeGet(fullDashboardData.initialAnswers, 'lossKg'));
        let goalDesc = `${Math.round(goalProgressPercent)}%`;
        if (goal === 'отслабване' && !isNaN(startWeight) && !isNaN(lossKgTarget) && lossKgTarget > 0) {
             const targetWeight = startWeight - lossKgTarget;
             goalDesc = `Цел: ${targetWeight.toFixed(1)} кг | ${Math.round(goalProgressPercent)}%`;
        } else if (goal) {
            goalDesc = `${capitalizeFirstLetter(goal)} | ${Math.round(goalProgressPercent)}%`;
        }
        selectors.goalProgressText.textContent = goalDesc;
    }
    const engagementScore = safeGet(currentAnalytics, 'engagementScore', 0);
    if (selectors.engagementProgressMask) selectors.engagementProgressMask.style.width = `${100 - Math.max(0, Math.min(100, engagementScore))}%`;
    if (selectors.engagementProgressText) selectors.engagementProgressText.textContent = `${Math.round(engagementScore)}%`;
    const healthScore = safeGet(currentAnalytics, 'overallHealthScore', 0);
    if (selectors.healthProgressMask) selectors.healthProgressMask.style.width = `${100 - Math.max(0, Math.min(100, healthScore))}%`;
    if (selectors.healthProgressText) selectors.healthProgressText.textContent = `${Math.round(healthScore)}%`;
}

function populateDashboardDetailedAnalytics(analyticsData) {
    const list = selectors.detailedAnalyticsList;
    const accordionContent = selectors.detailedAnalyticsContent;
    const textualAnalysisContainer = selectors.dashboardTextualAnalysis;

    if (!list || !accordionContent || !textualAnalysisContainer) {
        console.warn("Detailed analytics elements for dashboard not found.");
        return;
    }
    list.innerHTML = '';
    textualAnalysisContainer.innerHTML = '';

    const detailedMetrics = safeGet(analyticsData, 'detailed', []);
    const textualAnalysis = safeGet(analyticsData, 'textualAnalysis');

    if (textualAnalysis) {
        textualAnalysisContainer.innerHTML = `<p>${textualAnalysis.replace(/\n/g, "<br>")}</p>`;
    } else {
        textualAnalysisContainer.innerHTML = '<p class="placeholder">Текстовият анализ се генерира или не е наличен...</p>';
    }

    if (Array.isArray(detailedMetrics) && detailedMetrics.length > 0) {
        detailedMetrics.forEach(metric => {
            const initialText = metric.initialValueText || 'Няма данни';
            const expectedText = metric.expectedValueText || 'Не е зададена';
            const currentText = metric.currentValueText || 'Няма данни';

            const li = document.createElement('li');
            li.classList.add('detailed-metric-item');

            const formatValue = (value, typeClassSuffix) => {
                if (value === 'N/A' || value === 'Няма данни' || value === 'Не е зададена' || value === null || value === undefined) {
                    return `<span class="value-muted">${value === null || value === undefined ? 'Няма данни' : value}</span>`;
                }
                return `<span class="value-${typeClassSuffix}">${value}</span>`;
            };

            li.innerHTML = `
                <div class="metric-item-header">
                    <span class="metric-label">${metric.label || 'Неизвестен показател'}</span>
                    <button class="button-icon-only info-btn-metric" data-info-key="${metric.infoTextKey || (metric.key ? metric.key + '_info' : generateId('info'))}" aria-label="Информация за ${metric.label || 'показател'}">
                        <svg class="icon"><use href="#icon-info"/></svg>
                    </button>
                </div>
                <div class="metric-item-values">
                    <div class="metric-value-group">
                        <span class="metric-value-label">Начална стойност:</span>
                        ${formatValue(initialText, 'initial')}
                    </div>
                    <div class="metric-value-group">
                        <span class="metric-value-label">Целева стойност:</span>
                        ${formatValue(expectedText, 'expected')}
                    </div>
                    <div class="metric-value-group">
                        <span class="metric-value-label">Текуща стойност:</span>
                        ${formatValue(currentText, 'current')}
                    </div>
                </div>`;
            list.appendChild(li);
        });
    } else {
        list.innerHTML = '<li class="placeholder">Няма налични детайлни показатели за показване.</li>';
    }

    const accordionHeader = selectors.detailedAnalyticsAccordion?.querySelector('.accordion-header');
    if (accordionHeader) {
        const isCurrentlyOpen = accordionHeader.getAttribute('aria-expanded') === 'true';
        if (!isCurrentlyOpen) {
             accordionHeader.setAttribute('aria-expanded', 'false');
             accordionHeader.classList.remove('open');
             const arrow = accordionHeader.querySelector('.arrow');
             if (arrow) arrow.style.transform = 'rotate(0deg)';
             if(accordionContent) {
                accordionContent.style.display = 'none';
                accordionContent.classList.remove('open-active');
            }
        }
    }
}

function populateDashboardDailyPlan(week1Menu, dailyLogs, recipeData) {
    const listElement = selectors.dailyMealList;
    if (!listElement) {
        console.warn("Daily meal list element not found.");
        return;
    }

    const today = new Date();
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDayKey = dayNames[today.getDay()];
    const todayTitle = today.toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' });

    if(selectors.dailyPlanTitle) selectors.dailyPlanTitle.textContent = `📅 Дневен План (${capitalizeFirstLetter(todayTitle)})`;

    const dailyPlanData = safeGet(week1Menu, currentDayKey, []);
    if (!dailyPlanData || dailyPlanData.length === 0) {
        listElement.innerHTML = '<li class="placeholder">Няма наличен план за днес.</li>'; return;
    }
    listElement.innerHTML = '';

    const todayDateStr = today.toISOString().split('T')[0];
    const todaysLogFromServer = dailyLogs?.find(log => log.date === todayDateStr)?.data || {};
    const completedMealsFromServer = todaysLogFromServer.completedMealsStatus || {};
    // Accessing todaysMealCompletionStatus which is exported from app.js
    // and assuming it's updated directly or via a setter from app.js
    // For now, we directly modify it here, assuming app.js manages its persistence or re-reads.
    Object.keys(todaysMealCompletionStatus).forEach(key => delete todaysMealCompletionStatus[key]); // Clear local
    Object.assign(todaysMealCompletionStatus, completedMealsFromServer); // Populate with server data


    dailyPlanData.forEach((mealItem, index) => {
        const li = document.createElement('li');
        const mealStatusKey = `${currentDayKey}_${index}`;

        let itemsHtml = (mealItem.items || []).map(i => {
            let name = i.name || "Неизвестен продукт";
            let grams = i.grams ? `<span class="text-muted">(${i.grams})</span>` : '';
            return `• ${name} ${grams}`;
        }).join('<br>');

        if (!(mealItem.items && mealItem.items.length > 0)) itemsHtml = '<em class="text-muted">Няма продукти.</em>';

        const recipeButtonHtml = (mealItem.recipeKey && recipeData && recipeData[mealItem.recipeKey])
            ? `<button class="button-icon-only info" data-type="recipe" data-key="${mealItem.recipeKey}" title="Виж рецепта" aria-label="Информация за рецепта ${mealItem.meal_name || ''}"><svg class="icon"><use href="#icon-info"/></svg></button>` : '';

        li.innerHTML = `
            <div class="meal-content-wrapper">
                <span class="meal-name">${mealItem.meal_name || 'Хранене'}</span>
                <div class="meal-items">${itemsHtml}</div>
            </div>
            <div class="actions">
                ${recipeButtonHtml}
                <button class="button-icon-only complete" data-day="${currentDayKey}" data-index="${index}" title="Отбележи като изпълнено" aria-label="Отбележи ${mealItem.meal_name || 'храненето'} като изпълнено"><svg class="icon"><use href="#icon-check"/></svg></button>
            </div>`;

        if (todaysMealCompletionStatus[mealStatusKey] === true) {
            li.classList.add('completed');
        }
        listElement.appendChild(li);
    });
}

function populateDashboardLog(dailyLogs, currentStatus, initialData) {
    const trackerDiv = selectors.dailyTracker;
    if (!trackerDiv) {
        console.warn("Daily tracker element not found.");
        return;
    }

    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];
    if (selectors.dailyLogDate) selectors.dailyLogDate.textContent = `за ${today.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    const todaysLog = dailyLogs?.find(log => log.date === todayDateStr)?.data || {};
    trackerDiv.innerHTML = '';

    const weightMetricDiv = document.createElement('div');
    weightMetricDiv.className = 'metric-rating daily-log-weight-metric';
    const currentWeight = safeGet(currentStatus, 'weight');
    const initialWeight = safeGet(initialData, 'weight');
    const weightToDisplay = currentWeight ?? initialWeight;
    const weightValueForInput = safeParseFloat(weightToDisplay, '')?.toString() ?? '';
    const weightLabelTooltip = trackerInfoTexts.weight.general.replace(/\n/g, ' ');

    weightMetricDiv.innerHTML = `
        <label for="dailyLogWeightInput" data-tooltip-key="weight" title="${weightLabelTooltip}">
            <span class="metric-icon">⚖️</span> Тегло (кг):
            <button class="button-icon-only metric-info-btn" aria-label="Информация за тегло">
                <svg class="icon"><use href="#icon-info"></use></svg>
            </button>
        </label>
        <input type="number" id="dailyLogWeightInput" class="daily-log-weight-input-field" placeholder="Напр. 75.5" step="0.1" value="${weightValueForInput}" min="20" max="300" aria-label="Текущо тегло в килограми">
    `;
    trackerDiv.appendChild(weightMetricDiv);

    const metrics = [
        { key: 'mood', label: 'Настроение', icon: '😊', defaultVal: 3 },
        { key: 'energy', label: 'Енергия', icon: '⚡️', defaultVal: 3 },
        { key: 'calmness', label: 'Спокойствие', icon: '🧘', defaultVal: 3 },
        { key: 'hydration', label: 'Хидратация', icon: '💧', defaultVal: 3 },
        { key: 'sleep', label: 'Сън (нощен)', icon: '😴', defaultVal: 3 }
    ];
    metrics.forEach(metric => {
        const metricDiv = document.createElement('div');
        metricDiv.className = 'metric-rating';
        const currentValue = safeGet(todaysLog, metric.key, metric.defaultVal);
        const labelTooltipText = trackerInfoTexts[metric.key]?.general.replace(/\n/g, ' ') || metric.label;

        metricDiv.innerHTML = `
            <label for="${metric.key}-rating-input" data-tooltip-key="${metric.key}" title="${labelTooltipText}">
                <span class="metric-icon">${metric.icon}</span> ${metric.label}:
                <span class="rating-value" id="${metric.key}-value">${currentValue}</span>
                 <button class="button-icon-only metric-info-btn" aria-label="Информация за ${metric.label}">
                    <svg class="icon"><use href="#icon-info"></use></svg>
                </button>
            </label>
            <div class="rating-squares" data-metric-key="${metric.key}">
                ${[1,2,3,4,5].map(val => {
                    const levelDescription = trackerInfoTexts[metric.key]?.levels?.[val] || `Оценка ${val} от 5`;
                    return `<div 
                                class="rating-square ${val <= currentValue ? `filled level-${val}` : ''}" 
                                data-value="${val}" 
                                title="${levelDescription}" 
                                aria-label="${levelDescription}"></div>`;
                }).join('')}
            </div>
            <input type="hidden" id="${metric.key}-rating-input" value="${currentValue}">`;
        trackerDiv.appendChild(metricDiv);
    });

    if (selectors.dailyNote) {
        selectors.dailyNote.value = todaysLog.note || '';
        const noteIsEffectivelyVisible = !!todaysLog.note || !selectors.dailyNote.classList.contains('hidden');
        selectors.dailyNote.classList.toggle('hidden', !noteIsEffectivelyVisible);
        if(selectors.addNoteBtn) {
            const emoji = "📝";
            const baseText = "бележка за деня";
            selectors.addNoteBtn.innerHTML = `${emoji} ${noteIsEffectivelyVisible ? `Скрий ${baseText}` : `Добави ${baseText}`}`;
        }
    }
}

function populateProfileTab(userName, initialData, currentStatus, initialAnswers) {
    const personalDataUl = selectors.profilePersonalData;
    const goalsUl = selectors.profileGoals;
    const considerationsDiv = selectors.profileConsiderations;

    if (personalDataUl) {
        personalDataUl.innerHTML = '';
        const createProfileLi = (label, value, unit = '') => {
            const li = document.createElement('li');
            const strong = document.createElement('strong');
            strong.textContent = `${label}:`;
            li.appendChild(strong);
            const valueUnitGroup = document.createElement('span');
            valueUnitGroup.className = 'profile-value-unit-group';
            const valueSpan = document.createElement('span');
            valueSpan.setAttribute('data-profile-value', '');
            valueSpan.textContent = value !== null && value !== undefined ? String(value) : 'Няма данни';
            valueUnitGroup.appendChild(valueSpan);
            if (unit) {
                const unitSpan = document.createElement('span');
                unitSpan.setAttribute('data-profile-unit', '');
                unitSpan.textContent = unit;
                valueUnitGroup.appendChild(unitSpan);
            }
            li.appendChild(valueUnitGroup);
            return li;
        };
        personalDataUl.appendChild(createProfileLi('Име', userName || 'Няма данни'));
        personalDataUl.appendChild(createProfileLi('Възраст', safeGet(initialAnswers, 'age', 'Няма данни')));
        personalDataUl.appendChild(createProfileLi('Пол', capitalizeFirstLetter(safeGet(initialAnswers, 'gender', 'Няма данни'))));
        const height = safeGet(initialData, 'height', safeGet(initialAnswers, 'height', 'Няма данни'));
        personalDataUl.appendChild(createProfileLi('Височина', height, 'см'));
        const initialWeightNum = safeParseFloat(safeGet(initialData, 'weight', safeGet(initialAnswers, 'weight')));
        personalDataUl.appendChild(createProfileLi('Начално тегло', initialWeightNum ? initialWeightNum.toFixed(1) : 'Няма данни', 'кг'));
        const currentWeightNum = safeParseFloat(safeGet(currentStatus, 'weight'), initialWeightNum);
        const currentWeightDisplay = currentWeightNum ? currentWeightNum.toFixed(1) : (initialWeightNum ? initialWeightNum.toFixed(1) : 'Няма данни');
        personalDataUl.appendChild(createProfileLi('Текущо тегло', currentWeightDisplay, 'кг'));
    }

    if (goalsUl) {
        let goalsHtml = '';
        const goal = safeGet(initialAnswers, 'goal');
        if (goal && goal.trim() !== '') {
            goalsHtml += `<li>Основна цел: <strong>${capitalizeFirstLetter(goal)}</strong></li>`;
            if (goal.toLowerCase().includes('отслабване') && safeGet(initialAnswers, 'lossKg')) {
                goalsHtml += `<li>Желано сваляне на кг: <strong>${initialAnswers.lossKg} кг</strong></li>`;
            }
        }
        if (goalsHtml === '') goalsHtml = '<li class="placeholder">Няма зададени основни цели.</li>';
        goalsUl.innerHTML = goalsHtml;
    }

    if (considerationsDiv) {
        considerationsDiv.innerHTML = '';
        let hasConsiderations = false;
        const medicalConditions = safeGet(initialAnswers, 'medicalConditions', []);
        if (Array.isArray(medicalConditions) && medicalConditions.length > 0 && !(medicalConditions.length === 1 && medicalConditions[0].toLowerCase() === 'нямам')) {
            const note = document.createElement('div'); note.className = 'info-note note-base';
            note.innerHTML = `<svg class="icon prefix-icon"><use href="#icon-info"/></svg><span><strong>Медицински състояния:</strong> ${medicalConditions.join(', ')}</span>`;
            considerationsDiv.appendChild(note); hasConsiderations = true;
        }
        if (Array.isArray(medicalConditions) && medicalConditions.length > 0) {
            const allergiesAndIntolerances = medicalConditions.filter(c => typeof c === 'string' && (c.toLowerCase().includes('алергия') || c.toLowerCase().includes('непоносимост')));
            if (allergiesAndIntolerances.length > 0) {
                const note = document.createElement('div'); note.className = 'critical-note note-base';
                note.innerHTML = `<svg class="icon prefix-icon"><use href="#icon-warning-triangle"/></svg><span><strong>Посочени алергии/непоносимости:</strong> ${allergiesAndIntolerances.join(', ')}</span>`;
                considerationsDiv.appendChild(note); hasConsiderations = true;
            }
        }
        const foodPreference = safeGet(initialAnswers, 'foodPreference');
        const foodPreferenceTrimmed = typeof foodPreference === 'string' ? foodPreference.trim().toLowerCase() : '';
        if (foodPreference && foodPreferenceTrimmed !== '' && foodPreferenceTrimmed !== 'нямам') {
            let preferenceText = foodPreference;
            const dislikedFoodsKey = "q1745806494081"; const dislikedFoodsDetails = safeGet(initialAnswers, dislikedFoodsKey);
            const otherPrefKey = "q1745806409218"; const otherPrefDetails = safeGet(initialAnswers, otherPrefKey);
            if (foodPreference === "Друго / Не обичам следните:" && dislikedFoodsDetails && dislikedFoodsDetails.trim() !== '') preferenceText = `Посочени като "Друго / Не обичам следните": ${dislikedFoodsDetails}`;
            else if (foodPreferenceTrimmed.startsWith("друго") && otherPrefDetails && otherPrefDetails.trim() !== '') preferenceText = `Посочени като "Друго": ${otherPrefDetails}`;
            const note = document.createElement('div'); note.className = 'info-note note-base';
            note.innerHTML = `<span><strong style="display:inline-block; margin-right:5px;">🍽️ Хранителни предпочитания/Ограничения:</strong> ${preferenceText}</span>`;
            considerationsDiv.appendChild(note); hasConsiderations = true;
        }
        const mainChallengeText = safeGet(initialAnswers, 'mainChallenge');
         if (typeof mainChallengeText === 'string' && mainChallengeText.trim() !== '' && mainChallengeText.toLowerCase() !== 'n/a' && mainChallengeText.toLowerCase() !== 'няма') {
             const challengesHtml = `
                <div class="info-note note-base" style="flex-direction: column; align-items: flex-start;">
                    <p style="margin:0; display:flex; align-items:center;">
                        <strong style="display:inline-block; margin-right:5px;">🧗 Най-голямо предизвикателство (от въпросника):</strong>
                    </p>
                    <p style="margin:0; padding-left: 1.5em;">${mainChallengeText}</p>
                </div>`;
             considerationsDiv.insertAdjacentHTML('beforeend', challengesHtml); hasConsiderations = true;
        }
        if (!hasConsiderations) considerationsDiv.innerHTML = '<p class="placeholder">Няма посочени специфични съображения от въпросника.</p>';
    }
}

function populateWeekPlanTab(week1Menu, principles) {
    const tbody = selectors.weeklyPlanTbody;
    if (tbody) {
        tbody.innerHTML = '';
        const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayTranslations = { monday: "Понеделник", tuesday: "Вторник", wednesday: "Сряда", thursday: "Четвъртък", friday: "Петък", saturday: "Събота", sunday: "Неделя" };
        const mealSlotHeaders = ["Закуска", "Междинно 1", "Обяд", "Междинно 2", "Вечеря"];
        if (week1Menu && Object.keys(week1Menu).length > 0) {
            let planHasContentOverall = false;
            daysOrder.forEach(dayKey => {
                const dayData = [...(safeGet(week1Menu, dayKey, []))];
                const row = tbody.insertRow();
                const cellDay = row.insertCell(); cellDay.textContent = dayTranslations[dayKey] || capitalizeFirstLetter(dayKey); cellDay.setAttribute('data-label', 'Ден');
                let dayHasContent = false;
                mealSlotHeaders.forEach(slotHeader => {
                    const cellMeal = row.insertCell(); cellMeal.setAttribute('data-label', slotHeader);
                    let meal = null, mealIndex = -1;
                    mealIndex = dayData.findIndex(m => m.meal_name && m.meal_name.toLowerCase() === slotHeader.toLowerCase());
                    if (mealIndex === -1) mealIndex = dayData.findIndex(m => m.meal_name && m.meal_name.toLowerCase().includes(slotHeader.split(' ')[0].toLowerCase()));
                    if (mealIndex !== -1) { meal = dayData[mealIndex]; dayData.splice(mealIndex, 1); }
                    if (meal && meal.items) {
                        dayHasContent = true; planHasContentOverall = true;
                        let mealHtml = `<strong class="meal-name-desktop">${meal.meal_name}</strong>`;
                        if (meal.items.length > 0) mealHtml += `<ul>${meal.items.map(item => `<li>${item.name} ${item.grams ? `<span class="text-muted">(${item.grams})</span>` : ''}</li>`).join('')}</ul>`;
                        else mealHtml += '<p class="text-muted">-</p>';
                        cellMeal.innerHTML = mealHtml;
                    } else cellMeal.innerHTML = '—';
                });
                if(!dayHasContent && dayData.length > 0) {
                    for(let i=0; i<mealSlotHeaders.length && dayData.length > 0; i++) {
                        if(row.cells[i+1].innerHTML === '—') {
                            const meal = dayData.shift();
                            if(meal && meal.items){
                                 planHasContentOverall = true;
                                 let mealHtml = `<strong class="meal-name-desktop">${meal.meal_name}</strong>`;
                                 if (meal.items.length > 0) mealHtml += `<ul>${meal.items.map(item => `<li>${item.name} ${item.grams ? `<span class="text-muted">(${item.grams})</span>` : ''}</li>`).join('')}</ul>`;
                                 row.cells[i+1].innerHTML = mealHtml;
                                 row.cells[i+1].setAttribute('data-label', meal.meal_name);
                            }
                        }
                    }
                }
            });
            if (!planHasContentOverall) tbody.innerHTML = '<tr class="placeholder-row"><td colspan="6">Планът е празен.</td></tr>';
        } else tbody.innerHTML = '<tr class="placeholder-row"><td colspan="6">Планът не е наличен.</td></tr>';
    }
    let principlesToRender = principles;
    if (typeof principles === 'string' && principles.trim() !== '') {
        if (principles.trim().startsWith('[') && principles.trim().endsWith(']')) {
            try { principlesToRender = JSON.parse(principles); } catch (e) { console.warn("Could not parse principles string as JSON:", e); principlesToRender = [{ title: "Основни Принципи", content: principles }]; }
        } else {
             principlesToRender = [{ title: "Основни Принципи", content: principles }];
        }
    } else if (!Array.isArray(principles)) {
        principlesToRender = [];
    }
    renderAccordionGroup(selectors.weeklyPrinciplesFocus, principlesToRender, "Няма заредени принципи.");
}

function populateRecsTab(planData, initialAnswers) {
    const { allowedForbiddenFoods, hydrationCookingSupplements, psychologicalGuidance } = planData || {};
    if (selectors.recFoodAllowedContent) {
        const placeholderEl = selectors.recFoodAllowedContent.querySelector('p.placeholder'); if (placeholderEl) placeholderEl.remove();
        let allowedHtml = ''; const allowedCategories = safeGet(allowedForbiddenFoods, 'main_allowed_foods', []);
        if (Array.isArray(allowedCategories) && allowedCategories.length > 0) { allowedHtml += `<strong>Основни препоръчителни храни:</strong><ul>${allowedCategories.map(food => `<li>${food}</li>`).join('')}</ul>`; }
        else if (typeof allowedCategories === 'object' && Object.keys(allowedCategories).length > 0) { Object.entries(allowedCategories).forEach(([category, foods]) => { if (Array.isArray(foods) && foods.length > 0) { allowedHtml += `<strong>${category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong><ul>${foods.map(food => `<li>${food}</li>`).join('')}</ul>`; } }); }
        const detailedAllowed = safeGet(allowedForbiddenFoods, 'detailed_allowed_suggestions', []);
        if (detailedAllowed.length > 0) allowedHtml += `<p style="margin-top: 1rem;"><strong>Допълнителни препоръчителни храни/комбинации:</strong></p><ul>${detailedAllowed.map(s => `<li>${s}</li>`).join('')}</ul>`;
        selectors.recFoodAllowedContent.innerHTML = allowedHtml || '<p class="placeholder">Няма данни за препоръчителни храни.</p>';
        const hypoNoteContainer = document.getElementById('recFoodAllowedCard'); const hypoNote = hypoNoteContainer?.querySelector('[data-condition-value="хипотиреоидизъм"]');
        if(hypoNote){ const conditions = safeGet(initialAnswers, 'medicalConditions', []); hypoNote.classList.toggle('hidden', !conditions.includes('хипотиреоидизъм')); }
    }
    if (selectors.recFoodLimitContent) {
        const placeholderEl = selectors.recFoodLimitContent.querySelector('p.placeholder'); if (placeholderEl) placeholderEl.remove();
        let limitHtml = ''; const toLimit = safeGet(allowedForbiddenFoods, 'main_forbidden_foods', []);
        if (toLimit.length > 0) limitHtml += `<strong>Основни храни за ограничаване/избягване:</strong><ul>${toLimit.map(f => `<li>${f}</li>`).join('')}</ul>`;
        const detailedLimit = safeGet(allowedForbiddenFoods, 'detailed_limit_suggestions', []);
        if (detailedLimit.length > 0) limitHtml += `<p style="margin-top: 1rem;"><strong>Допълнителни храни/напитки за стриктно ограничаване:</strong></p><ul>${detailedLimit.map(s => `<li>${s}</li>`).join('')}</ul>`;
        if (!toLimit.length && !detailedLimit.length) limitHtml = '<p class="text-muted">Няма специфични общи препоръки за ограничаване.</p>';
        const dressingIdeas = safeGet(allowedForbiddenFoods, 'dressing_flavoring_ideas', []);
        if (Array.isArray(dressingIdeas) && dressingIdeas.length > 0) limitHtml += `<p style="margin-top: 1rem;"><strong>Идеи за дресинг/овкусяване:</strong> ${dressingIdeas.join(', ')}</p>`;
        const allergyNoteElement = selectors.userAllergiesNote; const currentChildren = Array.from(selectors.recFoodLimitContent.children);
        currentChildren.forEach(child => { if (child !== allergyNoteElement) child.remove(); });
        const limitContentDiv = document.createElement('div'); limitContentDiv.innerHTML = limitHtml; selectors.recFoodLimitContent.appendChild(limitContentDiv);
        if (allergyNoteElement && !selectors.recFoodLimitContent.contains(allergyNoteElement)) selectors.recFoodLimitContent.insertBefore(allergyNoteElement, selectors.recFoodLimitContent.firstChild);
        const allergies = safeGet(initialAnswers, 'foodAllergies', []);
        if (selectors.userAllergiesNote && selectors.userAllergiesList) {
            const medicalConditions = safeGet(initialAnswers, 'medicalConditions', []);
            const allergiesFromConditions = medicalConditions.filter(c => typeof c === 'string' && (c.toLowerCase().includes('алергия') || c.toLowerCase().includes('непоносимост')));
            const allReportedAllergies = [...new Set([...allergies, ...allergiesFromConditions])].filter(a => a && a.toLowerCase() !== 'няма');

            if (allReportedAllergies.length > 0) {
                selectors.userAllergiesList.textContent = allReportedAllergies.join(', ');
                selectors.userAllergiesNote.classList.remove('hidden');
            } else {
                selectors.userAllergiesNote.classList.add('hidden');
            }
        }
    }
    if (selectors.recHydrationContent) {
        const placeholderEl = selectors.recHydrationContent.querySelector('p.placeholder'); if (placeholderEl) placeholderEl.remove();
        let hydrationHtml = ''; const hydrData = safeGet(hydrationCookingSupplements, 'hydration_recommendations');
        if (hydrData) {
            if(hydrData.daily_liters) hydrationHtml += `<p><strong>Дневно количество:</strong> ${hydrData.daily_liters}</p>`;
            if(safeGet(hydrData,'tips',[]).length) hydrationHtml += `<p><strong>Съвети:</strong></p><ul>${hydrData.tips.map(t=>`<li>${t}</li>`).join('')}</ul>`;
            if(safeGet(hydrData,'suitable_drinks',[]).length) hydrationHtml += `<p><strong>Подходящи:</strong> ${hydrData.suitable_drinks.join(', ')}</p>`;
            if(safeGet(hydrData,'unsuitable_drinks',[]).length) hydrationHtml += `<p><strong>Неподходящи:</strong> ${hydrData.unsuitable_drinks.join(', ')}</p>`;
        }
        selectors.recHydrationContent.innerHTML = hydrationHtml || '<p class="placeholder">Няма данни за хидратация.</p>';
    }
    if (selectors.recCookingMethodsContent) {
        const placeholderEl = selectors.recCookingMethodsContent.querySelector('p.placeholder'); if (placeholderEl) placeholderEl.remove();
        let cookingHtml = ''; const cookData = safeGet(hydrationCookingSupplements, 'cooking_methods');
         if (cookData) {
             if(safeGet(cookData,'recommended',[]).length) cookingHtml += `<p><strong>Препоръчителни:</strong> ${cookData.recommended.join(', ')}</p>`;
             if(safeGet(cookData,'limit_or_avoid',[]).length) cookingHtml += `<p><strong>За ограничаване/избягване:</strong> ${cookData.limit_or_avoid.join(', ')}</p>`;
             if(cookData.fat_usage_tip) cookingHtml += `<p><strong>Съвет за мазнина при готвене:</strong> ${cookData.fat_usage_tip}</p>`;
         }
        selectors.recCookingMethodsContent.innerHTML = cookingHtml || '<p class="placeholder">Няма данни за методи на готвене.</p>';
    }
    const strategiesData = [];
    if (safeGet(psychologicalGuidance, 'coping_strategies', []).length > 0) strategiesData.push({ title: "🧠 Стратегии за справяне", content: psychologicalGuidance.coping_strategies });
    if (safeGet(psychologicalGuidance, 'motivational_messages', []).length > 0) strategiesData.push({ title: "💪 Мотивационни съобщения", content: psychologicalGuidance.motivational_messages });
    if (psychologicalGuidance?.habit_building_tip) strategiesData.push({ title: "⚙️ Изграждане на навици", content: psychologicalGuidance.habit_building_tip });
    if (psychologicalGuidance?.self_compassion_reminder) strategiesData.push({ title: "❤️ Напомняне за самосъстрадание", content: psychologicalGuidance.self_compassion_reminder });
    const activityContent = [];
    if (initialAnswers?.physicalActivity === 'Да') {
        const types = initialAnswers.q1745877358368; if (Array.isArray(types) && types.length > 0) activityContent.push(`<strong>Видове:</strong> ${types.join(', ')}`);
        if (initialAnswers.q1745878063775) activityContent.push(`<strong>Честота (пъти/седм.):</strong> ${initialAnswers.q1745878063775}`);
        if (initialAnswers.q1745890775342) activityContent.push(`<strong>Продължителност:</strong> ${initialAnswers.q1745890775342}`);
    } else if (initialAnswers?.physicalActivity === 'Не') activityContent.push('Не са посочени планирани спортни занимания.');
    const dailyActivityLevel = initialAnswers?.q1745878295708; if (dailyActivityLevel) activityContent.push(`<strong>Ежедневна активност (общо ниво):</strong> ${dailyActivityLevel}`);
    if (activityContent.length > 0) strategiesData.push({title: "🏃 Физическа активност (от въпросник)", content: activityContent.map(item => `<span>${item}</span>`).join('<br>')});
    renderAccordionGroup(selectors.recStrategiesContent, strategiesData, '<div class="card placeholder"><p>Няма налични стратегии.</p></div>', true);
    if (selectors.recSupplementsContent) {
        const placeholderEl = selectors.recSupplementsContent.querySelector('p.placeholder'); if (placeholderEl) placeholderEl.remove();
        let supplementsHtml = ''; const supps = safeGet(hydrationCookingSupplements, 'supplement_suggestions', []);
        if (supps.length > 0) {
            supplementsHtml += '<ul>';
            supps.forEach(s => { supplementsHtml += `<li><strong>💊 ${s.supplement_name||'?'}</strong>${s.reasoning?`: ${s.reasoning}`:''}${s.dosage_suggestion?` <span class="text-muted">(Препоръка: ${s.dosage_suggestion})</span>`:''}${s.caution?` <br><em class="text-muted" style="font-size:0.9em; display:block; margin-top:0.2rem;">Внимание: ${s.caution}</em>`:''}</li>`; });
            supplementsHtml += '</ul>';
        } else supplementsHtml = '<p class="placeholder">Няма специфични препоръки за добавки.</p>';
        selectors.recSupplementsContent.innerHTML = supplementsHtml;
    }
}

export function renderAccordionGroup(containerElement, itemsArray, placeholderText = "Няма данни.", isCardWrapper = false) {
    if (!containerElement) { console.warn("renderAccordionGroup: containerElement is null for ID:", containerElement?.id); return; }
    containerElement.innerHTML = ''; let contentRendered = false;
    if (Array.isArray(itemsArray) && itemsArray.length > 0) {
        itemsArray.forEach((item) => {
            if (!item || typeof item !== 'object' || !item.title || (!item.content && !item.items && typeof item.content !== 'string')) {
                console.warn("Skipping invalid item in renderAccordionGroup:", item); return;
            }
            const contentId = `accordion-content-${containerElement.id || 'group'}-${generateId()}`;
            let currentContentHtml = '';
            if (typeof item.content === 'string' && item.content.trim() !== '') currentContentHtml = `<p>${item.content.replace(/\n/g, "<br>")}</p>`;
            else if (Array.isArray(item.content) && item.content.length > 0) currentContentHtml = `<ul>${item.content.map(c => `<li>${String(c).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
            else if (Array.isArray(item.items) && item.items.length > 0) currentContentHtml = `<ul>${item.items.map(i => `<li><strong>${i.name}</strong>${i.description?`: ${String(i.description).replace(/\n/g, '<br>')}`:''}</li>`).join('')}</ul>`;
            if (currentContentHtml) {
                contentRendered = true;
                const accItemContainer = document.createElement('div');
                accItemContainer.className = isCardWrapper ? 'card' : 'accordion-container';
                if (isCardWrapper) { accItemContainer.style.padding = '0'; accItemContainer.style.overflow = 'hidden'; }
                accItemContainer.innerHTML = `
                    <div class="accordion-header" role="button" tabindex="0" aria-expanded="false" aria-controls="${contentId}">
                        <span>${item.title}</span>
                        <svg class="icon arrow"><use href="#icon-chevron-right"/></svg>
                    </div>
                    <div class="accordion-content" id="${contentId}" role="region" style="display: none;">${currentContentHtml}</div>`;
                containerElement.appendChild(accItemContainer);
            }
        });
    } else if (typeof itemsArray === 'string' && itemsArray.trim() !== '') {
         containerElement.innerHTML = `<p>${itemsArray.replace(/\n/g, "<br>")}</p>`; contentRendered = true;
    }
    if (!contentRendered) {
        const phElement = document.createElement(isCardWrapper ? 'div' : 'p');
        if(isCardWrapper) phElement.classList.add('card');
        phElement.classList.add('placeholder'); phElement.innerHTML = placeholderText;
        containerElement.appendChild(phElement);
    }
    containerElement.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function() { handleAccordionToggle.call(this); });
        header.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') handleAccordionToggle.call(header, e); });
    });
}

export function handleAccordionToggle(event) {
    if(event) event.preventDefault();
    const content = this.nextElementSibling; const isOpen = this.getAttribute('aria-expanded') === 'true';
    const group = this.closest('.accordion-group');
    if (group && !this.closest('#detailedAnalyticsAccordion')) {
        group.querySelectorAll('.accordion-header').forEach(otherHeader => {
            if (otherHeader !== this) {
                otherHeader.setAttribute('aria-expanded', 'false'); otherHeader.classList.remove('open');
                const otherArrow = otherHeader.querySelector('.arrow'); if (otherArrow) otherArrow.style.transform = 'rotate(0deg)';
                const otherContent = otherHeader.nextElementSibling;
                if (otherContent) { otherContent.style.display = 'none'; otherContent.classList.remove('open-active');}
            }
        });
    }
    this.setAttribute('aria-expanded', !isOpen); this.classList.toggle('open', !isOpen);
    const arrow = this.querySelector('.arrow'); if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    if (content) { content.style.display = isOpen ? 'none' : 'block'; content.classList.toggle('open-active', !isOpen); }
}

function populateProgressHistory(dailyLogs, initialData) {
    if (!selectors.progressHistoryCard) return;
    selectors.progressHistoryCard.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.id = 'progressChart';
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.appendChild(canvas);
    selectors.progressHistoryCard.appendChild(chartContainer);

    if (typeof Chart === 'undefined') {
        selectors.progressHistoryCard.innerHTML = '<p class="placeholder">Библиотеката за графики (Chart.js) не е заредена. Историята на прогреса не може да бъде показана.</p>';
        console.warn("Chart.js is not loaded.");
        return;
    }

    const weightData = [];
    const labels = [];

    const initialWeight = safeParseFloat(initialData?.weight);
    if (initialWeight !== null) {
        // Accessing fullDashboardData which is imported from app.js
        const submissionDate = safeGet(fullDashboardData.initialAnswers, 'submissionDate', new Date().toISOString());
        labels.push(new Date(submissionDate).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' }));
        weightData.push(initialWeight);
    }

    const reversedLogs = [...(dailyLogs || [])].reverse();
    reversedLogs.forEach(log => {
        if (log.date && log.data) {
            const loggedWeight = safeParseFloat(log.data.weight);
            if (loggedWeight !== null) {
                labels.push(new Date(log.date).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' }));
                weightData.push(loggedWeight);
            }
        }
    });

    if (labels.length < 2 && weightData.length < 2) {
         selectors.progressHistoryCard.innerHTML = '<p class="placeholder">Няма достатъчно данни за показване на история на прогреса в теглото.</p>';
         return;
    }

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Тегло (кг)',
                data: weightData,
                borderColor: 'rgba(58, 80, 107, 1)',
                backgroundColor: 'rgba(58, 80, 107, 0.1)',
                tension: 0.1,
                fill: false,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Тегло (кг)' },
                    grid: { color: 'rgba(0,0,0,0.05)'}
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}
