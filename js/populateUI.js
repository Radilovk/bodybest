// populateUI.js - Попълване на UI с данни
import { selectors, trackerInfoTexts, detailedMetricInfoTexts } from './uiElements.js';
import { safeGet, safeParseFloat, capitalizeFirstLetter, escapeHtml, applyProgressFill, getCssVar, formatDateBgShort, getLocalDate } from './utils.js';
import { generateId, apiEndpoints, standaloneMacroUrl } from './config.js';
import { fullDashboardData, todaysMealCompletionStatus, currentIntakeMacros, planHasRecContent, todaysExtraMeals, currentUserId, todaysPlanMacros, updateMacrosAndAnalytics, ensureFreshDailyIntake } from './app.js';
import { showToast } from './uiHandlers.js'; // For populateDashboardDetailedAnalytics accordion
import { ensureChart } from './chartLoader.js';
import { getNutrientOverride, scaleMacros, calculatePlanMacros, calculateMacroPercents } from './macroUtils.js';
import { logMacroPayload } from '../utils/debug.js';
import { ensureMacroAnalyticsElement } from './eventListeners.js';
import { getEffectiveMealData } from './mealReplacementCache.js';

let macroAnalyticsComponentPromise;
export let macroChartInstance = null;
export let progressChartInstance = null;
export let macroExceedThreshold = 1.15;

export function setMacroExceedThreshold(val) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 1) {
        macroExceedThreshold = num;
    } else {
        macroExceedThreshold = 1.15;
    }
    const card = selectors.macroAnalyticsCardContainer?.querySelector('macro-analytics-card');
    if (card) {
        card.setAttribute('exceed-threshold', String(macroExceedThreshold));
    }
}

export function buildMacroCardUrl() {
    return `${standaloneMacroUrl}?threshold=${macroExceedThreshold}`;
}

// Helper for tests to inject chart instance
export function __setProgressChartInstance(instance) {
    progressChartInstance = instance;
}


function addAlpha(color, alpha) {
    const c = color.trim();
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (c.startsWith('rgba')) {
        return c.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),[^)]+\)/, `rgba($1,$2,$3,${alpha})`);
    }
    if (c.startsWith('rgb')) {
        return c.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    return c;
}

function getBrightness(color) {
    const c = color.trim();
    let r, g, b;
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    } else if (c.startsWith('rgb')) {
        [r, g, b] = c.replace(/rgba?\(|\)|\s/g, '').split(',').map(Number);
    } else {
        return 1; // assume light background
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function getProgressChartColors() {
    // Вземаме цветовете от body, за да се съобразят с активната тема
    const root = document.body || document.documentElement;
    const styles = getComputedStyle(root);
    const header = styles.getPropertyValue('--primary-color').trim();
    const cardBg = (styles.getPropertyValue('--card-bg') || '#fff').trim();
    const darkBg = getBrightness(cardBg) < 0.5;
    const fillAlpha = darkBg ? 0.3 : 0.1;
    const gridAlpha = darkBg ? 0.2 : 0.1;
    return {
        border: header,
        fill: addAlpha(header, fillAlpha),
        grid: addAlpha(header, gridAlpha),
        tick: header
    };
}

export function updateProgressChartColors() {
    if (!progressChartInstance) return;
    const { border, fill, grid, tick } = getProgressChartColors();
    const ds = progressChartInstance.data.datasets[0];
    ds.borderColor = border;
    ds.backgroundColor = fill;
    const scales = progressChartInstance.options.scales;
    if (scales.x?.ticks) scales.x.ticks.color = tick;
    if (scales.y?.ticks) scales.y.ticks.color = tick;
    if (scales.y?.title) scales.y.title.color = tick;
    if (scales.y?.grid) scales.y.grid.color = grid;
    const legend = progressChartInstance.options.plugins?.legend;
    if (legend?.labels) legend.labels.color = tick;
    progressChartInstance.update();
}

document.addEventListener('progressChartThemeChange', updateProgressChartColors);

export async function populateUI() {
    const data = fullDashboardData; // Access global state
    if (!data || Object.keys(data).length === 0) {
        showToast("Липсват данни за показване.", true); return;
    }
    ensureFreshDailyIntake();
    updateMacrosAndAnalytics();
    try { populateUserInfo(data.userName); } catch(e) { console.error("Error in populateUserInfo:", e); }
    try { populateDashboardMainIndexes(data.analytics?.current); } catch(e) { console.error("Error in populateDashboardMainIndexes:", e); }
    try { populateDashboardDetailedAnalytics(data.analytics); } catch(e) { console.error("Error in populateDashboardDetailedAnalytics:", e); }
    // планът съдържа плосък обект caloriesMacros
    try { await populateDashboardMacros(data.planData?.caloriesMacros); } catch(e) { console.error("Error in populateDashboardMacros:", e); }
    try { populateDashboardStreak(data.analytics?.streak); } catch(e) { console.error("Error in populateDashboardStreak:", e); }
    try { populateDashboardDailyPlan(data.planData?.week1Menu, data.dailyLogs, data.recipeData); } catch(e) { console.error("Error in populateDashboardDailyPlan:", e); }
    todaysExtraMeals.forEach(m =>
        appendExtraMealCard(m.foodDescription ?? 'Хранене', m.quantityEstimate ?? '')
    );
    try { populateDashboardLog(data.dailyLogs, data.currentStatus, data.initialData); } catch(e) { console.error("Error in populateDashboardLog:", e); }
    try { populateProfileTab(data.userName, data.initialData, data.currentStatus, data.initialAnswers); } catch(e) { console.error("Error in populateProfileTab:", e); }
    try { populateWeekPlanTab(data.planData?.week1Menu); } catch(e) { console.error("Error in populateWeekPlanTab:", e); }
    const guidelinesData =
        data.planData?.principlesWeek2_4 ||
        data.planData?.additionalGuidelines ||
        data.additionalGuidelines;
    try { populateRecsTab(data.planData, data.initialAnswers, guidelinesData); } catch(e) { console.error("Error in populateRecsTab:", e); }
}

// eslint-disable-next-line no-unused-vars
function populateUserInfo(userName) {
    // Header logo is now static, no need to update title text
    // Previously: if (selectors.headerTitle) selectors.headerTitle.textContent = `Табло: ${userName || 'Потребител'}`;
}

function populateDashboardMainIndexes(currentAnalytics) {
    const hide = (el) => { if (el) el.classList.add('hidden'); };
    const show = (el) => { if (el) el.classList.remove('hidden'); };

    if (!currentAnalytics) {
        hide(selectors.goalCard);
        hide(selectors.engagementCard);
        hide(selectors.healthCard);
        return;
    }

    const goalProgressPercent = safeParseFloat(safeGet(currentAnalytics, 'goalProgress'), null);
    if (goalProgressPercent === null || goalProgressPercent <= 0) {
        hide(selectors.goalCard);
    } else {
        show(selectors.goalCard);
        if (selectors.goalProgressFill) {
            applyProgressFill(selectors.goalProgressFill, goalProgressPercent);
        }
        if (selectors.goalProgressBar) selectors.goalProgressBar.setAttribute('aria-valuenow', `${Math.round(goalProgressPercent)}`);
        const goal = safeGet(fullDashboardData.initialAnswers, 'goal', '').toLowerCase();
        const startWeight = safeParseFloat(safeGet(fullDashboardData.initialData, 'weight'));
        const lossKgTarget = safeParseFloat(safeGet(fullDashboardData.initialAnswers, 'lossKg'));
        let goalName = 'Цел';
        let goalTitle = '';
        // Показваме целта с дума (отслабване, антиейджинг и др)
        if (goal) {
            goalName = capitalizeFirstLetter(goal);
            goalTitle = goalName;
            // За отслабване добавяме и целевото тегло в tooltip
            if (goal === 'отслабване' && !isNaN(startWeight) && !isNaN(lossKgTarget) && lossKgTarget > 0) {
                const targetWeight = startWeight - lossKgTarget;
                goalTitle = `${goalName} (Цел: ${targetWeight.toFixed(1)} кг)`;
            }
        }
        if (selectors.goalName) selectors.goalName.textContent = goalName;
        if (selectors.goalCard && goalTitle) {
            selectors.goalCard.setAttribute('title', goalTitle);
        }
        if (selectors.goalProgressText) {
            selectors.goalProgressText.textContent = `${Math.round(goalProgressPercent)}%`;
        }
    }

    const engagementScore = safeParseFloat(safeGet(currentAnalytics, 'engagementScore'), null);
    if (engagementScore === null || Number.isNaN(engagementScore) || engagementScore < 0) {
        hide(selectors.engagementCard);
    } else {
        show(selectors.engagementCard);
        if (selectors.engagementProgressFill) {
            applyProgressFill(selectors.engagementProgressFill, engagementScore);
        }
        if (selectors.engagementProgressBar) selectors.engagementProgressBar.setAttribute('aria-valuenow', `${Math.round(engagementScore)}`);
        if (selectors.engagementProgressText) selectors.engagementProgressText.textContent = `${Math.round(engagementScore)}%`;
    }

    const healthScore = safeParseFloat(safeGet(currentAnalytics, 'overallHealthScore'), null);
    if (healthScore === null || healthScore <= 0) {
        hide(selectors.healthCard);
    } else {
        show(selectors.healthCard);
        if (selectors.healthProgressFill) {
            applyProgressFill(selectors.healthProgressFill, healthScore);
        }
        if (selectors.healthProgressBar) selectors.healthProgressBar.setAttribute('aria-valuenow', `${Math.round(healthScore)}`);
        if (selectors.healthProgressText) selectors.healthProgressText.textContent = `${Math.round(healthScore)}%`;
    }
}

function populateDashboardDetailedAnalytics(analyticsData) {
    const cardsContainer = selectors.analyticsCardsContainer;
    const accordionContent = selectors.detailedAnalyticsContent;
    const textualAnalysisContainer = selectors.dashboardTextualAnalysis;
    const macroContainer = selectors.macroAnalyticsCardContainer;

    if (!cardsContainer || !accordionContent || !textualAnalysisContainer) {
        console.warn("Detailed analytics elements for dashboard not found.");
        return;
    }

    // Запазваме макро картата, за да не се рестартира анимацията
    Array.from(cardsContainer.children).forEach(child => {
        if (child !== macroContainer) child.remove();
    });
    if (macroContainer) {
        macroContainer.classList.remove('loading');
        if (!cardsContainer.contains(macroContainer)) {
            cardsContainer.appendChild(macroContainer);
        }
        ensureMacroAnalyticsElement();
        populateDashboardMacros();
    }
    textualAnalysisContainer.innerHTML = '';


    const detailedMetrics = safeGet(analyticsData, 'detailed', []);
    const textualAnalysis = safeGet(analyticsData, 'textualAnalysis');
    const periodDays = safeGet(analyticsData, 'periodDays', 7);

    // Add period information
    let periodText = '';
    if (periodDays === 7) {
        periodText = 'последните 7 дни';
    } else if (periodDays === 30) {
        periodText = 'последните 30 дни';
    } else if (periodDays > 90) {
        periodText = 'целия период от началото';
    } else {
        periodText = `последните ${periodDays} дни`;
    }

    if (textualAnalysis) {
        textualAnalysisContainer.innerHTML = `<p style="margin-bottom: 0.5rem;"><small style="color: var(--text-color-secondary);">Анализ за ${periodText}</small></p><p>${escapeHtml(textualAnalysis).replace(/\n/g, "<br>")}</p>`;
    } else {
        textualAnalysisContainer.innerHTML = '<p class="placeholder">Текстовият анализ се генерира или не е наличен...</p>';
    }

    if (Array.isArray(detailedMetrics) && detailedMetrics.length > 0) {
        detailedMetrics.forEach(metric => {
            const card = document.createElement('div');
            card.className = 'analytics-card';

            const header = document.createElement('h5');
            header.textContent = metric.label || 'Показател';
            card.appendChild(header);

            const progress = document.createElement('div');
            progress.className = 'mini-progress-bar';
            progress.setAttribute('role', 'progressbar');
            progress.setAttribute('aria-valuemin', '0');
            progress.setAttribute('aria-valuemax', '100');
            const fill = document.createElement('div');
            fill.className = 'mini-progress-fill';
            progress.appendChild(fill);
            card.appendChild(progress);

            const currentDiv = document.createElement('div');
            currentDiv.className = 'metric-current-text';
            currentDiv.textContent = metric.currentValueText || 'Няма данни';
            card.appendChild(currentDiv);

            const valuesDiv = document.createElement('div');
            valuesDiv.className = 'metric-item-values';
            const formatValue = (val, cls) => {
                if (val === 'N/A' || val === 'Няма данни' || val === 'Не е зададена' || val === null || val === undefined) {
                    return `<span class="value-muted">${val === null || val === undefined ? 'Няма данни' : val}</span>`;
                }
                return `<span class="value-${cls}">${val}</span>`;
            };
            valuesDiv.innerHTML = `
                <div class="metric-value-group">
                    <span class="metric-value-label">Начална стойност:</span>
                    ${formatValue(metric.initialValueText || 'Няма данни', 'initial')}
                </div>
                <div class="metric-value-group">
                    <span class="metric-value-label">Целева стойност:</span>
                    ${formatValue(metric.expectedValueText || 'Не е зададена', 'expected')}
                </div>
                <div class="metric-value-group">
                    <span class="metric-value-label">Текуща стойност:</span>
                    ${formatValue(metric.currentValueText || 'Няма данни', 'current')}
                </div>`;

            const details = document.createElement('div');
            details.className = 'analytics-card-details';
            const infoContainer = document.createElement('div');
            infoContainer.className = 'metric-info-container';
            const infoText = detailedMetricInfoTexts[metric.infoTextKey || (metric.key ? metric.key + '_info' : '')] || metric.infoText || '';
            if (infoText) {
                const p = document.createElement('p');
                p.className = 'metric-info';
                p.textContent = infoText;
                infoContainer.appendChild(p);
            }
            if (metric.periodDays !== undefined) {
                const pPeriod = document.createElement('p');
                pPeriod.className = 'metric-period';
                pPeriod.textContent = metric.periodDays > 0
                    ? `Период на изчисление: последните ${metric.periodDays} дни.`
                    : 'Изчислено от последните налични данни.';
                infoContainer.appendChild(pPeriod);
            }
            details.appendChild(infoContainer);
            details.appendChild(valuesDiv);
            card.appendChild(details);

            card.addEventListener('click', () => {
                card.classList.toggle('open');
            });

            if (!isNaN(metric.currentValueNumeric)) {
                const value = Number(metric.currentValueNumeric);
                const percent = value <= 5 ? value * 20 : Math.max(0, Math.min(100, value));
                progress.setAttribute('aria-valuenow', `${Math.round(percent)}`);
                applyProgressFill(fill, percent);
            }

            cardsContainer.appendChild(card);
        });
    } else {
        cardsContainer.innerHTML = '<p class="placeholder">Няма налични детайлни показатели за показване.</p>';
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

export function updateAnalyticsSections(analyticsData) {
    if (!analyticsData) return;
    fullDashboardData.analytics = analyticsData;
    populateDashboardMainIndexes(analyticsData.current);
    populateDashboardDetailedAnalytics(analyticsData);
}


export function appendExtraMealCard(name, quantity) {
    const list = selectors.dailyMealList;
    if (!list) return;

    const extraLi = document.createElement('li');
    extraLi.classList.add('card', 'meal-card', 'soft-shadow', 'completed', 'extra-meal');

    const colorBar = document.createElement('div');
    colorBar.className = 'meal-color-bar';
    extraLi.appendChild(colorBar);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'meal-content-wrapper';
    extraLi.appendChild(contentWrapper);

    const title = document.createElement('h2');
    title.className = 'meal-name';
    title.textContent = name || 'Хранене';
    const checkIcon = document.createElement('span');
    checkIcon.className = 'check-icon';
    checkIcon.setAttribute('aria-hidden', 'true');
    checkIcon.innerHTML = '<svg class="icon"><use href="#icon-check"/></svg>';
    title.appendChild(checkIcon);
    contentWrapper.appendChild(title);

    const items = document.createElement('div');
    items.className = 'meal-items';
    items.textContent = `Количество: ${quantity ?? ''}`;
    contentWrapper.appendChild(items);

    // Поставяме картата след последното приключено хранене или най-отгоре при липса на такива
    const completed = list.querySelectorAll('li.completed');
    const anchor = completed.length ? completed[completed.length - 1].nextSibling : list.firstChild;
    list.insertBefore(extraLi, anchor);
}

export function addExtraMealWithOverride(name = '', macros = {}, grams) {
    const hasMacros = macros && Object.keys(macros).length > 0;
    let gramValue = typeof grams === 'number' ? grams : undefined;
    if (!hasMacros) {
        const input = typeof prompt !== 'undefined' ? prompt('Въведете грамаж (г):', '100') : '100';
        const parsed = parseFloat(input);
        gramValue = !isNaN(parsed) && parsed > 0 ? parsed : 100;
    }
    const override = getNutrientOverride(name) || {};
    const base = hasMacros ? macros : override;
    const scaled = gramValue ? scaleMacros(base, gramValue) : base;
    const entry = gramValue ? { ...scaled, grams: gramValue } : { ...scaled };
    if (gramValue) {
        Object.defineProperty(entry, '__macrosScaled', {
            value: true,
            enumerable: false
        });
    } else if (hasMacros && macros.__macrosScaled) {
        Object.defineProperty(entry, '__macrosScaled', {
            value: true,
            enumerable: false
        });
    }
    todaysExtraMeals.push(entry);
    // Обновяваме макросите и аналитиката след добавяне на хранене
    updateMacrosAndAnalytics();
}

function renderMacroPreviewGrid(macros) {
    const preview = selectors.macroMetricsPreview;
    if (!preview) return;
    preview.innerHTML = '';
    if (!macros) {
        preview.classList.add('hidden');
        return;
    }
    preview.classList.remove('hidden');
    const percents = calculateMacroPercents(macros);
    const list = [
        { l: 'cal.', v: macros.calories, s: 'kcal', cls: 'calories' },
        { l: 'prot.', v: macros.protein_percent ?? percents.protein_percent, s: '%' },
        { l: 'carb.', v: macros.carbs_percent ?? percents.carbs_percent, s: '%' },
        { l: 'fat.', v: macros.fat_percent ?? percents.fat_percent, s: '%' }
    ];
    const iconMap = {
        'cal.': 'bi-fire',
        'prot.': 'bi-egg-fried',
        'carb.': 'bi-basket',
        'fat.': 'bi-droplet',
        'fiber.': 'bi-flower1'
    };
    const colorMap = {
        'prot.': '--macro-protein-color',
        'carb.': '--macro-carbs-color',
        'fat.': '--macro-fat-color',
        'fiber.': '--macro-fiber-color'
    };
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'macro-metric' + (item.cls ? ` ${item.cls}` : '');
        const icon = document.createElement('span');
        icon.className = 'macro-icon';
        const i = document.createElement('i');
        i.className = `bi ${iconMap[item.l] || 'bi-circle'}`;
        icon.appendChild(i);
        const label = document.createElement('div');
        label.className = 'macro-label';
        const clrVar = colorMap[item.l];
        const clr = clrVar ? getCssVar(clrVar) : null;
        if (clr) {
            label.style.color = clr;
            icon.style.color = clr;
        }
        label.textContent = item.l;
        const value = document.createElement('div');
        value.className = 'macro-value';
        value.textContent = item.v ?? '--';
        const sub = document.createElement('div');
        sub.className = 'macro-subtitle';
        sub.textContent = item.s;
        div.appendChild(icon);
        div.appendChild(label);
        div.appendChild(value);
        div.appendChild(sub);
        preview.appendChild(div);
    });
}

/**
 * Валидира структурата на макро payload-а.
 * Проверява наличието на ключове и че стойностите им са числа.
 * @param {{ plan: object, current: object }} payload
 * @returns {boolean}
 */
export function validateMacroPayload({ plan, current }) {
    const isObj = v => v && typeof v === 'object';
    const check = (obj, keys) => isObj(obj) && keys.every(k => typeof obj[k] === 'number' && !isNaN(obj[k]));
    const planValid = check(plan, ['calories', 'protein_grams', 'carbs_grams', 'fat_grams']) &&
        (plan?.fiber_grams === undefined || typeof plan.fiber_grams === 'number');
    const planPercentsValid = ['protein_percent', 'carbs_percent', 'fat_percent']
        .every(k => typeof plan?.[k] === 'number' && !isNaN(plan[k]));
    const fiberPercentValid = plan?.fiber_percent === undefined
        ? true
        : typeof plan.fiber_percent === 'number' && !isNaN(plan.fiber_percent);
    const currentValid = check(current, ['calories', 'protein_grams', 'carbs_grams', 'fat_grams']) &&
        (current?.fiber_grams === undefined || typeof current.fiber_grams === 'number');
    return planValid && currentValid && planPercentsValid && fiberPercentValid;
}

export async function populateDashboardMacros(macros) {
    let macroContainer = selectors.macroAnalyticsCardContainer;
    if (!macroContainer || !document.contains(macroContainer)) {
        macroContainer = document.createElement('div');
        macroContainer.id = 'macroAnalyticsCardContainer';
        macroContainer.className = 'card analytics-card';
        selectors.analyticsCardsContainer?.appendChild(macroContainer);
        selectors.macroAnalyticsCardContainer = macroContainer;
    }

    if (macros == null) {
        let shouldFetch = macros === null;
        if (macros === undefined) {
            const hasExistingPlan = typeof todaysPlanMacros.calories === 'number' && todaysPlanMacros.calories > 0;
            if (hasExistingPlan) {
                macros = {
                    calories: todaysPlanMacros.calories,
                    protein_grams: todaysPlanMacros.protein,
                    carbs_grams: todaysPlanMacros.carbs,
                    fat_grams: todaysPlanMacros.fat,
                    fiber_grams: todaysPlanMacros.fiber
                };
            } else {
                shouldFetch = true;
            }
        }
        if (shouldFetch) {
            renderMacroPreviewGrid(null);
            macroContainer.innerHTML = '<div class="spinner-border" role="status"></div>';
            try {
                const res = await fetch(`${apiEndpoints.dashboard}?userId=${currentUserId}&recalcMacros=1`);
                const data = await res.json();
                macros = data?.planData?.caloriesMacros;
                if (!macros) {
                    macroContainer.innerHTML = '<p class="placeholder">Липсват данни за макроси.</p>';
                    return;
                }
            } catch (e) {
                console.error('Failed to recalc macros', e);
                showToast('Неуспешно изчисляване на макроси.', true);
                macroContainer.innerHTML = '<p class="placeholder">Липсват данни за макроси.</p>';
                return;
            }
        }
    }

    todaysPlanMacros.calories = macros.calories ?? todaysPlanMacros.calories;
    todaysPlanMacros.protein = macros.protein_grams ?? macros.protein ?? todaysPlanMacros.protein;
    todaysPlanMacros.carbs = macros.carbs_grams ?? macros.carbs ?? todaysPlanMacros.carbs;
    todaysPlanMacros.fat = macros.fat_grams ?? macros.fat ?? todaysPlanMacros.fat;
    todaysPlanMacros.fiber = macros.fiber_grams ?? macros.fiber ?? todaysPlanMacros.fiber;

    const percentFallback = calculateMacroPercents({
        calories: todaysPlanMacros.calories,
        protein: todaysPlanMacros.protein,
        carbs: todaysPlanMacros.carbs,
        fat: todaysPlanMacros.fat,
        fiber: todaysPlanMacros.fiber
    });

    const parsePercent = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return undefined;
    };

    const ensurePlanPercent = (key) => {
        const fromMacros = parsePercent(macros?.[key]);
        if (fromMacros !== undefined) {
            todaysPlanMacros[key] = fromMacros;
            return fromMacros;
        }
        const stored = parsePercent(todaysPlanMacros[key]);
        if (stored !== undefined) {
            todaysPlanMacros[key] = stored;
            return stored;
        }
        const fallback = parsePercent(percentFallback[key]);
        const value = fallback !== undefined ? fallback : 0;
        todaysPlanMacros[key] = value;
        return value;
    };

    ['protein_percent', 'carbs_percent', 'fat_percent', 'fiber_percent'].forEach(ensurePlanPercent);

    renderMacroPreviewGrid(currentIntakeMacros);
    const existingSpinner = macroContainer.querySelector('.spinner-border');
    if (existingSpinner) existingSpinner.remove();
    const plan = {
        calories: todaysPlanMacros.calories,
        protein_grams: todaysPlanMacros.protein,
        carbs_grams: todaysPlanMacros.carbs,
        fat_grams: todaysPlanMacros.fat,
        fiber_grams: todaysPlanMacros.fiber,
        protein_percent: todaysPlanMacros.protein_percent,
        carbs_percent: todaysPlanMacros.carbs_percent,
        fat_percent: todaysPlanMacros.fat_percent,
        fiber_percent: todaysPlanMacros.fiber_percent
    };
    const current = {
        calories: currentIntakeMacros.calories,
        protein_grams: currentIntakeMacros.protein,
        carbs_grams: currentIntakeMacros.carbs,
        fat_grams: currentIntakeMacros.fat,
        fiber_grams: currentIntakeMacros.fiber
    };
    const payload = { plan, current };
    if (!validateMacroPayload(payload)) {
        console.warn('Невалидна структура на макро-данните', payload);
        logMacroPayload({ error: 'Invalid macro payload structure', payload });
        return;
    }
    // Зареждаме компонента за макро анализ при първа нужда
    macroAnalyticsComponentPromise ||= import('./macroAnalyticsCardComponent.js');
    await macroAnalyticsComponentPromise;
    // Създаваме или взимаме макро-картата и я обновяваме с текущите данни
    const card = ensureMacroAnalyticsElement();
    if (typeof card.setData !== 'function') {
        console.warn('macro-analytics-card не е зареден');
        return;
    }
    logMacroPayload(payload);
    card.setData(payload); // компонентът се актуализира със стойностите
}

function populateDashboardStreak(streakData) {
    if (!selectors.streakGrid) return;
    selectors.streakGrid.innerHTML = '';
    const days = streakData?.dailyStatusArray || [];
    days.forEach(d => {
        const el = document.createElement('div');
        el.className = 'streak-day' + (d.logged ? ' logged' : '');
        el.title = new Date(d.date).toLocaleDateString('bg-BG');
        selectors.streakGrid.appendChild(el);
    });
}

function populateDashboardDailyPlan(week1Menu, dailyLogs, recipeData) {
    const listElement = selectors.dailyMealList;
    if (!listElement) {
        console.warn("Daily meal list element not found.");
        return;
    }

    const today = new Date();
    const todayDateStr = getLocalDate(today);
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDayKey = dayNames[today.getDay()];
    const todayTitle = today.toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' });

    if (selectors.dailyPlanTitle) selectors.dailyPlanTitle.innerHTML = `<svg class="icon"><use href="#icon-calendar"></use></svg> Меню (${capitalizeFirstLetter(todayTitle)})`;

    const dailyPlanData = safeGet(week1Menu, currentDayKey, []);
    Object.assign(
        todaysPlanMacros,
        calculatePlanMacros(
            dailyPlanData,
            true,
            true,
            fullDashboardData?.planData?.mealMacrosIndex || null,
            currentDayKey
        )
    );

    populateDashboardMacros();

    if (!dailyPlanData || dailyPlanData.length === 0) {
        listElement.innerHTML = '<li class="placeholder">Няма налично меню за днес.</li>'; return;
    }
    listElement.innerHTML = '';
    const todaysLogFromServer = dailyLogs?.find(log => log.date === todayDateStr)?.data || {};
    const completedMealsFromServer = todaysLogFromServer.completedMealsStatus || {};
    // Accessing todaysMealCompletionStatus which is exported from app.js
    // and assuming it's updated directly or via a setter from app.js
    // For now, we directly modify it here, assuming app.js manages its persistence or re-reads.
    Object.keys(todaysMealCompletionStatus).forEach(key => delete todaysMealCompletionStatus[key]); // Clear local
    Object.assign(todaysMealCompletionStatus, completedMealsFromServer); // Populate with server data


    dailyPlanData.forEach((mealItem, index) => {
        // Check if there's a cached replacement for this meal
        const effectiveMeal = getEffectiveMealData(mealItem, currentDayKey, index);
        
        const li = document.createElement('li');
        li.classList.add('card', 'meal-card', 'soft-shadow');
        li.dataset.day = currentDayKey;
        li.dataset.index = index;
        const mealStatusKey = `${currentDayKey}_${index}`;

        const lowerName = (effectiveMeal.meal_name || '').toLowerCase();
        const mealTypeKeywords = {
            breakfast: ['закуска'],
            lunch: ['обяд', 'обед', 'обедно хранене'],
            dinner: ['вечеря', 'вечерно хранене', 'късна вечеря']
        };
        for (const [type, words] of Object.entries(mealTypeKeywords)) {
            if (words.some(word => lowerName.includes(word))) {
                li.dataset.mealType = type;
                break;
            }
        }

        let itemsHtml = (effectiveMeal.items || []).map(i => {
            const name = i.name || 'Неизвестен продукт';
            const grams = i.grams ? `<span class="caption">(${i.grams})</span>` : '';
            return `• ${name} ${grams}`;
        }).join('<br>');

        if (!(effectiveMeal.items && effectiveMeal.items.length > 0)) itemsHtml = '<em class="text-muted">Няма продукти.</em>';

        const recipeButtonHtml = (effectiveMeal.recipeKey && recipeData && recipeData[effectiveMeal.recipeKey])
            ? `<button class="button-icon-only info" data-type="recipe" data-key="${effectiveMeal.recipeKey}" title="Виж рецепта" aria-label="Информация за рецепта ${effectiveMeal.meal_name || ''}"><svg class="icon"><use href="#icon-info"/></svg></button>` : '';
        
        const alternativesButtonHtml = `<button class="button-icon-only alternatives-btn" data-meal-index="${index}" data-day="${currentDayKey}" title="Алтернативи" aria-label="Генерирай алтернативи за ${effectiveMeal.meal_name || 'хранене'}"><svg class="icon"><use href="#icon-swap"/></svg></button>`;

        li.innerHTML = `
            <div class="meal-color-bar"></div>
            <div class="meal-content-wrapper">
                <h2 class="meal-name">${effectiveMeal.meal_name || 'Хранене'}
                    <span class="check-icon" aria-hidden="true"><svg class="icon"><use href="#icon-check"/></svg></span>
                    ${alternativesButtonHtml}
                </h2>
                <div class="meal-items">${itemsHtml}</div>
            </div>
            ${recipeButtonHtml ? `<div class="actions">${recipeButtonHtml}</div>` : ''}`;

        // Store effective meal data (with cache applied) on the element for later use
        li.dataset.mealData = JSON.stringify(effectiveMeal);

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
    const todayDateStr = getLocalDate(today);
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
            <span class="metric-icon"><svg class="icon"><use href="#icon-scale"></use></svg></span> Тегло (кг):
            <button class="button-icon-only info-btn metric-info-btn" aria-label="Информация за тегло">
                <svg class="icon"><use href="#icon-info"></use></svg>
            </button>
        </label>
        <input type="number" id="dailyLogWeightInput" class="daily-log-weight-input-field" placeholder="Напр. 75.5" step="0.1" value="${weightValueForInput}" min="20" max="300" aria-label="Текущо тегло в килограми">
    `;
    trackerDiv.appendChild(weightMetricDiv);

    const metrics = [
        { key: 'health_tone', label: 'Здраве / тонус', icon: '<i class="bi bi-heart-pulse"></i>', defaultVal: 3 },
        { key: 'activity', label: 'Физическа активност', icon: '<i class="bi bi-person-walking"></i>', defaultVal: 3 },
        { key: 'stress', label: 'Стрес / напрежение', icon: '<i class="bi bi-lightning-fill"></i>', defaultVal: 3 },
        { key: 'sleep', label: 'Качество на съня', icon: '<i class="bi bi-moon"></i>', defaultVal: 3 },
        { key: 'hydration', label: 'Хидратация', icon: '<i class="bi bi-droplet"></i>', defaultVal: 3 }
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
                 <button class="button-icon-only info-btn metric-info-btn" aria-label="Информация за ${metric.label}">
                    <svg class="icon"><use href="#icon-info"></use></svg>
                </button>
            </label>
            <div class="rating-squares" data-metric-key="${metric.key}">
                ${[1,2,3,4,5].map(val => {
                    const levelDescription = trackerInfoTexts[metric.key]?.levels?.[val] || `Оценка ${val} от 5`;
                    return `<div
                                class="rating-square ${val <= currentValue ? `filled level-${currentValue}` : ''}"
                                data-value="${val}"
                                title="${levelDescription}"
                                aria-label="${levelDescription}"></div>`;
                }).join('')}
            </div>
            <input type="hidden" id="${metric.key}-rating-input" value="${currentValue}">`;
        if(currentValue > 0) metricDiv.classList.add('active');
        trackerDiv.appendChild(metricDiv);
    });

    if (selectors.dailyNote) {
        selectors.dailyNote.value = todaysLog.note || '';
        const noteIsEffectivelyVisible = !!todaysLog.note || !selectors.dailyNote.classList.contains('hidden');
        selectors.dailyNote.classList.toggle('hidden', !noteIsEffectivelyVisible);
        if(selectors.addNoteBtn) {
            const icon = '<i class="bi bi-pencil-square"></i>';
            const baseText = "бележка за деня";
            selectors.addNoteBtn.innerHTML = `${icon} ${noteIsEffectivelyVisible ? `Скрий ${baseText}` : `Добави ${baseText}`}`;
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
            const dislikedFoodsDetails = safeGet(initialAnswers, 'foodPreferenceDisliked') || safeGet(initialAnswers, 'q1745806494081');
            const otherPrefDetails = safeGet(initialAnswers, 'foodPreferenceOther') || safeGet(initialAnswers, 'q1745806409218');
            if (foodPreference === "Друго / Не обичам следните:" && dislikedFoodsDetails && dislikedFoodsDetails.trim() !== '') preferenceText = `Посочени като "Друго / Не обичам следните": ${dislikedFoodsDetails}`;
            else if (foodPreferenceTrimmed.startsWith("друго") && otherPrefDetails && otherPrefDetails.trim() !== '') preferenceText = `Посочени като "Друго": ${otherPrefDetails}`;
            const note = document.createElement('div'); note.className = 'info-note note-base';
            note.innerHTML = `<span><strong style="display:inline-block; margin-right:5px;"><svg class="icon"><use href="#icon-utensils"></use></svg> Хранителни предпочитания/Ограничения:</strong> ${preferenceText}</span>`;
            considerationsDiv.appendChild(note); hasConsiderations = true;
        }
        const mainChallengeText = safeGet(initialAnswers, 'mainChallenge');
         if (typeof mainChallengeText === 'string' && mainChallengeText.trim() !== '' && mainChallengeText.toLowerCase() !== 'n/a' && mainChallengeText.toLowerCase() !== 'няма') {
             const challengesHtml = `
                <div class="info-note note-base" style="flex-direction: column; align-items: flex-start;">
                    <p style="margin:0; display:flex; align-items:center;">
                        <strong style="display:inline-block; margin-right:5px;"><i class="bi bi-flag" aria-hidden="true"></i> Най-голямо предизвикателство (от въпросника):</strong>
                    </p>
                    <p style="margin:0; padding-left: 1.5em;">${mainChallengeText}</p>
                </div>`;
             considerationsDiv.insertAdjacentHTML('beforeend', challengesHtml); hasConsiderations = true;
        }
        if (!hasConsiderations) considerationsDiv.innerHTML = '<p class="placeholder">Няма посочени специфични съображения от въпросника.</p>';
    }
    
    // Display psycho test results if available (pass initialAnswers to get from KV data)
    displayPsychTestResults(initialAnswers);
}

// Flag to track if accordion event listener is attached
let psychTestAccordionListenerAttached = false;

function handlePsychTestAccordionClick() {
    const content = document.getElementById('psychTestDetailsContent');
    const header = document.getElementById('psychTestDetailsHeader');
    const arrow = header?.querySelector('.arrow');
    const isExpanded = header?.getAttribute('aria-expanded') === 'true';
    
    if (header) {
        header.setAttribute('aria-expanded', !isExpanded);
    }
    if (content) {
        content.style.display = isExpanded ? 'none' : 'block';
    }
    if (arrow) {
        arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
    }
}

function formatTestDate(timestamp) {
    if (!timestamp) return 'Дата неизвестна';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Дата неизвестна';
    return date.toLocaleDateString('bg-BG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function displayPsychTestResults(initialAnswers) {
    try {
        // Get psychTests from initialAnswers (KV data), not from localStorage
        const psychTests = safeGet(initialAnswers, 'psychTests', null);
        
        if (!psychTests) {
            // Cache in localStorage for offline access
            return;
        }
        
        // Cache in localStorage for offline access
        try {
            localStorage.setItem('psychTests', JSON.stringify(psychTests));
        } catch (storageError) {
            console.warn('Failed to cache psychTests in localStorage:', storageError);
        }
        
        const hasVisualTest = psychTests.visualTest && Object.keys(psychTests.visualTest).length > 0;
        const hasPersonalityTest = psychTests.personalityTest && Object.keys(psychTests.personalityTest).length > 0;
        
        if (!hasVisualTest && !hasPersonalityTest) return;
        
        // Show the summary section
        const psychTestResults = document.getElementById('psychTestResults');
        const psychTestSummary = document.getElementById('psychTestSummary');
        
        if (psychTestResults && psychTestSummary) {
            psychTestResults.style.display = 'block';
            
            let summaryText = '';
            if (hasVisualTest) {
                summaryText += `<div style="margin-top: var(--space-xs);"><i class="bi bi-image"></i> Визуален тест: <strong>${escapeHtml(psychTests.visualTest.name || 'Завършен')}</strong></div>`;
            }
            if (hasPersonalityTest) {
                summaryText += `<div style="margin-top: var(--space-xs);"><i class="bi bi-person-check"></i> Личностен тест: <strong>${escapeHtml(psychTests.personalityTest.typeCode || 'Завършен')}</strong></div>`;
            }
            
            psychTestSummary.innerHTML = summaryText;
        }
        
        // Show detailed results section
        const psychTestDetailsCard = document.getElementById('psychTestDetailsCard');
        const psychTestDetailsContent = document.getElementById('psychTestDetailsContent');
        
        if (psychTestDetailsCard && psychTestDetailsContent) {
            psychTestDetailsCard.style.display = 'block';
            
            let detailsHtml = '';
            
            if (hasVisualTest) {
                const vt = psychTests.visualTest;
                detailsHtml += `
                    <div style="margin-bottom: var(--space-lg);">
                        <h4 style="color: var(--primary-color); margin-bottom: var(--space-sm);">
                            <i class="bi bi-image"></i> Визуален тест
                        </h4>
                        <div style="background: var(--surface-background); padding: var(--space-md); border-radius: var(--radius-md); border-left: 4px solid var(--primary-color);">
                            <p style="margin-bottom: var(--space-sm);"><strong>Профил:</strong> ${escapeHtml(vt.name || 'N/A')}</p>
                            <p style="margin-bottom: var(--space-sm); color: var(--text-color-secondary);">${escapeHtml(vt.short || '')}</p>
                            ${vt.psycho && Array.isArray(vt.psycho) ? `
                                <div style="margin-top: var(--space-md);">
                                    <strong>Психологически характеристики:</strong>
                                    <ul style="margin-top: var(--space-xs); padding-left: var(--space-lg);">
                                        ${vt.psycho.map(p => `<li style="margin-bottom: var(--space-xs);">${escapeHtml(p)}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${vt.habits && Array.isArray(vt.habits) ? `
                                <div style="margin-top: var(--space-md);">
                                    <strong>Хранителни навици:</strong>
                                    <ul style="margin-top: var(--space-xs); padding-left: var(--space-lg);">
                                        ${vt.habits.map(h => `<li style="margin-bottom: var(--space-xs);">${escapeHtml(h)}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            <p style="margin-top: var(--space-sm); font-size: var(--fs-xs); color: var(--text-color-secondary);">
                                <i class="bi bi-calendar"></i> ${formatTestDate(vt.timestamp)}
                            </p>
                        </div>
                    </div>
                `;
            }
            
            if (hasPersonalityTest) {
                const pt = psychTests.personalityTest;
                detailsHtml += `
                    <div style="margin-bottom: var(--space-lg);">
                        <h4 style="color: var(--secondary-color); margin-bottom: var(--space-sm);">
                            <i class="bi bi-person-check"></i> Личностен тест
                        </h4>
                        <div style="background: var(--surface-background); padding: var(--space-md); border-radius: var(--radius-md); border-left: 4px solid var(--secondary-color);">
                            <p style="margin-bottom: var(--space-sm);"><strong>Тип код:</strong> ${escapeHtml(pt.typeCode || 'N/A')}</p>
                            ${pt.scores && typeof pt.scores === 'object' ? `
                                <div style="margin-top: var(--space-md);">
                                    <strong>Резултати:</strong>
                                    <div style="margin-top: var(--space-xs);">
                                        ${Object.entries(pt.scores).map(([key, value]) => `
                                            <div style="margin-bottom: var(--space-xs);">
                                                <span style="display: inline-block; min-width: 120px;">${escapeHtml(key)}:</span>
                                                <span style="font-weight: 600;">${typeof value === 'number' ? value.toFixed(1) : escapeHtml(String(value))}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            ${pt.riskFlags && Array.isArray(pt.riskFlags) && pt.riskFlags.length > 0 ? `
                                <div style="margin-top: var(--space-md); background: var(--color-warning-bg); padding: var(--space-sm); border-radius: var(--radius-md);">
                                    <strong style="color: var(--color-warning);"><i class="bi bi-exclamation-triangle"></i> Важни забележки:</strong>
                                    <ul style="margin-top: var(--space-xs); padding-left: var(--space-lg);">
                                        ${pt.riskFlags.map(flag => `<li style="margin-bottom: var(--space-xs); color: var(--text-color-primary);">${escapeHtml(flag)}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            <p style="margin-top: var(--space-sm); font-size: var(--fs-xs); color: var(--text-color-secondary);">
                                <i class="bi bi-calendar"></i> ${formatTestDate(pt.timestamp)}
                            </p>
                        </div>
                    </div>
                `;
            }
            
            psychTestDetailsContent.innerHTML = detailsHtml;
            
            // Setup accordion behavior (use flag to prevent duplicate listeners)
            const header = document.getElementById('psychTestDetailsHeader');
            if (header && !psychTestAccordionListenerAttached) {
                header.addEventListener('click', handlePsychTestAccordionClick);
                psychTestAccordionListenerAttached = true;
            }
        }
    } catch (error) {
        console.error('Error displaying psych test results:', error);
    }
}

function populateWeekPlanTab(week1Menu) {
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
}

function populateRecsTab(planData, initialAnswers, additionalGuidelines) {
    const hasPlanContent = planHasRecContent(planData);
    const hasExtraGuidelines = additionalGuidelines && ((Array.isArray(additionalGuidelines) && additionalGuidelines.length > 0) || (typeof additionalGuidelines === 'string' && additionalGuidelines.trim() !== ''));
    if (!hasPlanContent && !hasExtraGuidelines) {
        console.warn("populateRecsTab: няма данни за показване");
        if (selectors.recFoodAllowedContent) selectors.recFoodAllowedContent.innerHTML = '<p class="placeholder">Няма налични препоръки.</p>';
        if (selectors.recFoodLimitContent) selectors.recFoodLimitContent.innerHTML = '<p class="placeholder">Няма налични препоръки.</p>';
        if (selectors.recHydrationContent) selectors.recHydrationContent.innerHTML = '<p class="placeholder">Няма налични препоръки.</p>';
        if (selectors.recCookingMethodsContent) selectors.recCookingMethodsContent.innerHTML = '<p class="placeholder">Няма налични препоръки.</p>';
        if (selectors.recStrategiesContent) selectors.recStrategiesContent.innerHTML = '<div class="card placeholder"><p>Няма налични препоръки.</p></div>';
        if (selectors.recSupplementsContent) selectors.recSupplementsContent.innerHTML = '<p class="placeholder">Няма налични препоръки.</p>';
        if (selectors.additionalGuidelines) selectors.additionalGuidelines.innerHTML = '<div class="card placeholder"><p>Няма налични препоръки.</p></div>';
        return;
    }
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
    if (safeGet(psychologicalGuidance, 'coping_strategies', []).length > 0) strategiesData.push({ title: '<svg class="icon"><use href="#icon-info"></use></svg> Стратегии за справяне', content: psychologicalGuidance.coping_strategies });
    if (safeGet(psychologicalGuidance, 'motivational_messages', []).length > 0) strategiesData.push({ title: '<i class="bi bi-chat-dots"></i> Мотивационни съобщения', content: psychologicalGuidance.motivational_messages });
    if (psychologicalGuidance?.habit_building_tip) strategiesData.push({ title: '<i class="bi bi-gear"></i> Изграждане на навици', content: psychologicalGuidance.habit_building_tip });
    if (psychologicalGuidance?.self_compassion_reminder) strategiesData.push({ title: '<i class="bi bi-heart-fill"></i> Разбиране към себе си', content: psychologicalGuidance.self_compassion_reminder });
    const activityContent = [];
    if (initialAnswers?.physicalActivity === 'Да') {
        const types = initialAnswers.regularActivityTypes || initialAnswers.q1745877358368; if (Array.isArray(types) && types.length > 0) activityContent.push(`<strong>Видове:</strong> ${types.join(', ')}`);
        const frequency = initialAnswers.weeklyActivityFrequency || initialAnswers.q1745878063775;
        if (frequency) activityContent.push(`<strong>Честота (пъти/седм.):</strong> ${frequency}`);
        const duration = initialAnswers.activityDuration || initialAnswers.q1745890775342;
        if (duration) activityContent.push(`<strong>Продължителност:</strong> ${duration}`);
    } else if (initialAnswers?.physicalActivity === 'Не') activityContent.push('Не са посочени планирани спортни занимания.');
    const dailyActivityLevel = initialAnswers?.dailyActivityLevel || initialAnswers?.q1745878295708; if (dailyActivityLevel) activityContent.push(`<strong>Ежедневна активност (общо ниво):</strong> ${dailyActivityLevel}`);
    if (activityContent.length > 0) strategiesData.push({ title: '<i class="bi bi-activity" aria-hidden="true"></i> Физическа активност (от въпросник)', content: activityContent.map(item => `<span>${item}</span>`).join('<br>') });
    renderAccordionGroup(selectors.recStrategiesContent, strategiesData, '<div class="card placeholder"><p>Няма налични стратегии.</p></div>', true);
    if (selectors.recSupplementsContent) {
        const placeholderEl = selectors.recSupplementsContent.querySelector('p.placeholder'); if (placeholderEl) placeholderEl.remove();
        let supplementsHtml = ''; const supps = safeGet(hydrationCookingSupplements, 'supplement_suggestions', []);
        if (supps.length > 0) {
            supplementsHtml += '<ul>';
            supps.forEach(s => { supplementsHtml += `<li><strong><i class="bi bi-capsule" aria-hidden="true"></i> ${s.supplement_name||'?'}</strong>${s.reasoning?`: ${s.reasoning}`:''}${s.dosage_suggestion?` <span class="text-muted">(Препоръка: ${s.dosage_suggestion})</span>`:''}${s.caution?` <br><em class="text-muted fs-sm" style="display:block; margin-top:0.2rem;">Внимание: ${s.caution}</em>`:''}</li>`; });
            supplementsHtml += '</ul>';
        } else supplementsHtml = '<p class="placeholder">Няма специфични препоръки за добавки.</p>';
        selectors.recSupplementsContent.innerHTML = supplementsHtml;
    }
    if (selectors.additionalGuidelines) {
        let guidelinesToRender = additionalGuidelines;
        if (typeof additionalGuidelines === "string" && additionalGuidelines.trim() !== "") {
            if (additionalGuidelines.trim().startsWith("[") && additionalGuidelines.trim().endsWith("]")) {
                try {
                    guidelinesToRender = JSON.parse(additionalGuidelines);
                } catch (e) {
                    console.warn("Could not parse additionalGuidelines as JSON:", e);
                    guidelinesToRender = [{ title: "Допълнителни насоки", content: additionalGuidelines }];
                }
            } else {
                guidelinesToRender = [{ title: "Допълнителни насоки", content: additionalGuidelines }];
            }
        } else if (!Array.isArray(additionalGuidelines)) {
            guidelinesToRender = [];
        }

        renderAccordionGroup(
            selectors.additionalGuidelines,
            guidelinesToRender,
            '<div class="card placeholder"><p>Няма налични насоки.</p></div>',
            true
        );
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
    if (!isOpen && this.closest('#detailedAnalyticsAccordion')) {
        macroChartInstance?.resize();
        progressChartInstance?.resize();
    }
}

export async function populateProgressHistory(dailyLogs, initialData) {
    const card = selectors.progressHistoryCard;
    if (!card) return;

    const weightData = [];
    const labels = [];
    const todayStr = formatDateBgShort(new Date());

    const initialWeight = safeParseFloat(initialData?.weight);
    if (initialWeight !== null) {
        const registrationDate = initialData?.registrationDate ??
            safeGet(fullDashboardData.initialAnswers, 'submissionDate', new Date().toISOString());
        labels.push(formatDateBgShort(registrationDate));
        weightData.push(initialWeight);
    }

    const reversedLogs = [...(dailyLogs || [])].reverse();
    reversedLogs.forEach(log => {
        if (log.date) {
            const loggedWeight = safeParseFloat(
                log.data?.weight ?? log.weight
            );
            if (loggedWeight !== null) {
                labels.push(formatDateBgShort(log.date));
                weightData.push(loggedWeight);
            }
        }
    });

    const lastWeight = weightData[weightData.length - 1];
    if (lastWeight !== undefined && labels[labels.length - 1] !== todayStr) {
        labels.push(todayStr);
        weightData.push(lastWeight);
    }

    if (weightData.length === 0) {
        card.classList.add('hidden');
        return;
    }

    card.classList.remove('hidden');
    card.innerHTML = '<div class="spinner-border" role="status"></div>';

    let Chart;
    try {
        Chart = await ensureChart();
    } catch (e) {
        console.warn('Chart.js is not loaded.', e);
        card.innerHTML = '<div class="alert alert-warning" role="alert">Графиката не може да се зареди.</div>';
        return;
    }

    if (progressChartInstance) {
        progressChartInstance.destroy();
        progressChartInstance = null;
    }

    card.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'progressChart';
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.appendChild(canvas);
    card.appendChild(chartContainer);

    const ctx = canvas.getContext('2d');
    const colors = getProgressChartColors();
    progressChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Тегло (кг)',
                data: weightData,
                borderColor: colors.border,
                backgroundColor: colors.fill,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.1,
                fill: false,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: colors.tick } },
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Тегло (кг)', color: colors.tick },
                    grid: { color: colors.grid },
                    ticks: { color: colors.tick }
                }
            },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: colors.tick } },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
    updateProgressChartColors();
}
