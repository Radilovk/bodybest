// adminAnalyticsPeriodSelector.js - Управление на селектора за период в админ панела

let currentLogsPeriod = 7; // Default for logs
let currentAnalyticsPeriod = 7; // Default for analytics

/**
 * Инициализира селектора за период на логовете
 */
export function initAdminLogsPeriodSelector(onPeriodChange) {
    const periodButtons = document.querySelectorAll('.admin-period-btn');
    if (periodButtons.length === 0) return;
    
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.getAttribute('data-period');
            // Validate and set current period
            if (period === 'all') {
                currentLogsPeriod = 'all';
            } else {
                const parsedPeriod = parseInt(period);
                currentLogsPeriod = isNaN(parsedPeriod) ? 7 : parsedPeriod; // Fallback to 7 if invalid
            }
            setActivePeriod(period, periodButtons);
            
            if (onPeriodChange) {
                onPeriodChange(currentLogsPeriod);
            }
        });
    });
}

/**
 * Инициализира селектора за период на аналитиката
 */
export function initAdminAnalyticsPeriodSelector(onPeriodChange) {
    const periodButtons = document.querySelectorAll('.admin-analytics-period-btn');
    if (periodButtons.length === 0) return;
    
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.getAttribute('data-period');
            // Validate and set current period
            if (period === 'all') {
                currentAnalyticsPeriod = 'all';
            } else {
                const parsedPeriod = parseInt(period);
                currentAnalyticsPeriod = isNaN(parsedPeriod) ? 7 : parsedPeriod; // Fallback to 7 if invalid
            }
            setActivePeriod(period, periodButtons);
            
            if (onPeriodChange) {
                onPeriodChange(currentAnalyticsPeriod);
            }
        });
    });
}

/**
 * Задава активния период и актуализира визуално бутоните
 */
function setActivePeriod(period, buttons) {
    buttons.forEach(btn => {
        const btnPeriod = btn.getAttribute('data-period');
        const isActive = btnPeriod === period;
        
        if (isActive) {
            btn.style.background = '#007bff';
            btn.style.color = 'white';
            btn.style.borderColor = '#007bff';
        } else {
            btn.style.background = 'white';
            btn.style.color = '#333';
            btn.style.borderColor = '#ccc';
        }
    });
}

/**
 * Връща текущо избрания период за логовете
 */
export function getCurrentLogsPeriod() {
    return currentLogsPeriod;
}

/**
 * Връща текущо избрания период за аналитиката
 */
export function getCurrentAnalyticsPeriod() {
    return currentAnalyticsPeriod;
}

/**
 * Форматира периода за показване
 */
export function formatPeriodText(periodDays) {
    if (periodDays === 'all' || periodDays > 90) {
        return 'Всички записи';
    } else if (periodDays === 30) {
        return 'Последните 30 дни';
    } else if (periodDays === 7) {
        return 'Последните 7 дни';
    } else {
        return `Последните ${periodDays} дни`;
    }
}
