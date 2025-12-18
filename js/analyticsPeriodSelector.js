// analyticsPeriodSelector.js - Управление на селектора за период на аналитиката

let currentPeriod = 7; // Default 7 days
let onPeriodChangeCallback = null;

/**
 * Инициализира селектора за период на аналитиката в потребителския dashboard
 */
export function initAnalyticsPeriodSelector(onPeriodChange) {
    onPeriodChangeCallback = onPeriodChange;
    
    const periodButtons = document.querySelectorAll('.period-btn');
    if (periodButtons.length === 0) return;
    
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.getAttribute('data-period');
            setActivePeriod(period, periodButtons);
            
            // Call the callback to refresh analytics
            if (onPeriodChangeCallback) {
                onPeriodChangeCallback(period);
            }
        });
    });
}

/**
 * Задава активния период и актуализира визуално бутоните
 */
function setActivePeriod(period, buttons) {
    currentPeriod = period === 'all' ? 'all' : parseInt(period);
    
    buttons.forEach(btn => {
        const btnPeriod = btn.getAttribute('data-period');
        const isActive = btnPeriod === period;
        
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        
        if (isActive) {
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--primary-color)';
        } else {
            btn.style.background = 'var(--card-bg)';
            btn.style.color = 'var(--text-color)';
            btn.style.borderColor = 'var(--border-color)';
        }
    });
}

/**
 * Връща текущо избрания период
 */
export function getCurrentPeriod() {
    return currentPeriod;
}

/**
 * Форматира периода за показване
 */
export function formatPeriodText(periodDays) {
    if (periodDays === 'all' || periodDays > 90) {
        return 'От началото';
    } else if (periodDays === 30) {
        return 'Последните 30 дни';
    } else if (periodDays === 7) {
        return 'Последните 7 дни';
    } else {
        return `Последните ${periodDays} дни`;
    }
}
