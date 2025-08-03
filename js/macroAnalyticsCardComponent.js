import { loadLocale } from './macroCardLocales.js';
import { ensureChart } from './chartLoader.js';
import { scaleMacros, formatPercent } from './macroUtils.js';

let Chart;

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }
    .card {
      background: var(--card-bg);
      border-radius: 20px;
      padding: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 450px;
      margin: 2rem auto;
      opacity: 0;
      transform: scale(0.95);
    }
    :host(.loaded) .card { animation: fade-in 0.6s ease forwards; }
    @keyframes fade-in { to { opacity: 1; transform: scale(1); } }
    .analytics-card h5 {
      text-align: center;
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: var(--text-color);
    }
    .chart-container {
      position: relative;
      margin: 0 auto;
      max-width: 250px;
      height: 250px;
    }
    .loading-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 32px;
      height: 32px;
      margin: -16px 0 0 -16px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: var(--macro-protein-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .chart-center-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
    }
    .chart-center-text .consumed-calories {
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.1;
      color: var(--text-color);
    }
    .chart-center-text .total-calories-label {
      font-size: 0.8rem;
      color: var(--text-secondary-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .chart-center-text .plan-vs-target {
      font-size: 0.75rem;
      color: var(--text-secondary-color);
    }
    .macro-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .macro-metric {
      text-align: center;
      padding: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.3s ease, transform 0.3s ease;
    }
    .macro-metric:hover { transform: scale(1.05); }
    .macro-metric.active { border-width: 2px; }
    .macro-metric.protein.active { border-color: var(--macro-protein-color); }
    .macro-metric.carbs.active { border-color: var(--macro-carbs-color); }
    .macro-metric.fat.active { border-color: var(--macro-fat-color); }
    .macro-metric.fiber.active { border-color: var(--macro-fiber-color); }
    .macro-metric.over {
      border-color: var(--color-danger);
      animation: macro-over-pulse 1s ease-in-out infinite alternate;
    }
    .macro-metric.under {
      border-color: var(--color-warning);
      animation: macro-under-pulse 1s ease-in-out infinite alternate;
    }
    @keyframes macro-over-pulse {
      from { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
      to { box-shadow: 0 0 10px 4px rgba(231, 76, 60, 0); }
    }
    @keyframes macro-under-pulse {
      from { box-shadow: 0 0 0 0 rgba(243, 156, 18, 0.7); }
      to { box-shadow: 0 0 10px 4px rgba(243, 156, 18, 0); }
    }
    .macro-icon { font-size: 1.2rem; }
    .macro-label { font-size: 0.85rem; margin-top: 0.25rem; }
    .macro-value { font-size: 1.1rem; font-weight: 600; }
    .macro-subtitle { font-size: 0.75rem; color: var(--text-secondary-color); }

    .macro-warning {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: var(--color-warning, #f39c12);
      display: none;
    }
    .macro-warning.show { display: block; }

    /* Skeleton loading */
    .skeleton {
      position: relative;
      overflow: hidden;
      background-color: rgba(255, 255, 255, 0.1);
    }
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: shimmer 1.2s infinite;
    }
    @keyframes shimmer {
      100% { transform: translateX(100%); }
    }
    .chart-skeleton { width: 100%; height: 100%; border-radius: 50%; }
    .metric-skeleton { height: 60px; border-radius: 12px; }

    @media (max-width: 480px) {
      .card { padding: 1rem; }
      .chart-container { max-width: 200px; height: 200px; }
      .macro-metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
  <div class="card analytics-card">
    <h5></h5>
    <div class="chart-container">
      <div class="chart-skeleton skeleton"></div>
      <div class="loading-indicator" hidden></div>
      <canvas hidden aria-label="Диаграма на макронутриенти" role="img"></canvas>
      <div class="chart-center-text"></div>
    </div>
    <div class="macro-warning" role="alert"></div>
    <div class="macro-metrics-grid" role="list">
      <div class="macro-metric metric-skeleton skeleton"></div>
      <div class="macro-metric metric-skeleton skeleton"></div>
      <div class="macro-metric metric-skeleton skeleton"></div>
      <div class="macro-metric metric-skeleton skeleton"></div>
      <div class="macro-metric metric-skeleton skeleton"></div>
    </div>
  </div>
`;

export class MacroAnalyticsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.grid = this.shadowRoot.querySelector('.macro-metrics-grid');
    this.centerText = this.shadowRoot.querySelector('.chart-center-text');
    this.canvas = this.shadowRoot.querySelector('canvas');
    this.loadingIndicator = this.shadowRoot.querySelector('.loading-indicator');
    this.titleEl = this.shadowRoot.querySelector('h5');
    this.warningEl = this.shadowRoot.querySelector('.macro-warning');
    this.chart = null;
    this.activeMacroIndex = null;
    this.targetData = null;
    this.planData = null;
    this.currentData = null;
    this.observer = null;
    this.refreshTimer = null;
    this.locale = this.getAttribute('locale') || document.documentElement.lang || 'bg';
    // Множителят, над който приемът се счита за превишен (например 1.2 = 120%).
    this.exceedThreshold = parseFloat(this.getAttribute('exceed-threshold')) || 1.15;
    this.labels = {
      title: '',
      caloriesLabel: '',
      macros: { protein: '', carbs: '', fat: '', fiber: '' },
      fromGoal: '',
      subtitle: '',
      totalCaloriesLabel: '',
      exceedWarning: '',
      planVsTargetLabel: ''
    };
  }

  static get observedAttributes() {
    return ['target-data', 'plan-data', 'current-data', 'locale', 'data-endpoint', 'refresh-interval', 'exceed-threshold'];
  }

    async connectedCallback() {
      this.classList.add('loaded');
      await this.updateLocale(document.documentElement.lang);
      this.lazyLoadChart();
      this.setupAutoRefresh();
    }

  attributeChangedCallback(name, _oldVal, newVal) {
      if (name === 'locale') {
        this.updateLocale(newVal);
        return;
      }
    if (name === 'data-endpoint' || name === 'refresh-interval') {
      this.setupAutoRefresh();
      return;
    }
    if (name === 'exceed-threshold') {
      // Позволява динамично променяне на прага за превишение.
      const val = parseFloat(newVal);
      if (!Number.isNaN(val)) this.exceedThreshold = val;
      this.renderMetrics();
      return;
    }
    try {
      let parsed = JSON.parse(newVal);
      if (name === 'current-data' && parsed && typeof parsed.grams === 'number') {
        if (parsed.macros) {
          const scaled = scaleMacros(parsed.macros, parsed.grams);
          parsed = {
            calories: scaled.calories,
            protein_grams: scaled.protein,
            carbs_grams: scaled.carbs,
            fat_grams: scaled.fat
          };
        } else {
          const scaled = scaleMacros(parsed, parsed.grams);
          parsed = {
            calories: scaled.calories,
            protein_grams: scaled.protein,
            carbs_grams: scaled.carbs,
            fat_grams: scaled.fat
          };
        }
      }
      if (name === 'target-data') this.targetData = parsed;
      if (name === 'plan-data') this.planData = parsed;
      if (name === 'current-data') this.currentData = parsed;
      this.renderMetrics();
      this.renderChart();
    } catch (e) {
      console.error(`Invalid JSON for ${name}`, e);
    }
  }

    async updateLocale(lng) {
      const locale = lng || this.locale || document.documentElement.lang || 'bg';
      this.locale = locale;
      this.labels = await loadLocale(locale);
      if (this.titleEl) this.titleEl.textContent = this.labels.title;
      this.renderMetrics();
      this.renderChart();
    }

  disconnectedCallback() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  showLoading() {
    if (this.loadingIndicator) this.loadingIndicator.hidden = false;
  }

  hideLoading() {
    if (this.loadingIndicator) this.loadingIndicator.hidden = true;
  }

  lazyLoadChart() {
    if (this.observer) return;
    const load = async () => {
      this.showLoading();
      try {
        Chart = await ensureChart();
        this.renderChart();
      } catch (e) {
        console.error('Failed to load Chart.js', e);
        const container = this.shadowRoot.querySelector('.chart-container');
        if (container) {
          container.innerHTML = '<div class="alert alert-warning" role="alert">Диаграмата не може да се зареди.</div>';
        }
      } finally {
        this.hideLoading();
      }
    };
    if (!('IntersectionObserver' in window)) {
      load();
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.observer.disconnect();
          load();
        }
      });
    }, { threshold: 0.1 });
    this.observer.observe(this);
  }

  setupAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    const endpoint = this.getAttribute('data-endpoint');
    if (!endpoint || !this.isConnected) return;
    const interval = parseInt(this.getAttribute('refresh-interval') || '60000', 10);
    const fetchData = async () => {
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.target && data.current) {
          this.setData(data);
        }
      } catch (e) {
        console.error('Failed to fetch macro data', e);
      }
    };
    fetchData();
    this.refreshTimer = setInterval(fetchData, interval);
  }

  setData({ target, plan, current }) {
    if (target) this.setAttribute('target-data', JSON.stringify(target));
    if (plan) this.setAttribute('plan-data', JSON.stringify(plan));
    if (current) this.setAttribute('current-data', JSON.stringify(current));
  }

  getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  highlightMacro(el, index) {
    this.grid.querySelectorAll('.macro-metric').forEach((div) => {
      div.classList.remove('active');
      div.setAttribute('aria-pressed', 'false');
    });
    if (this.chart) this.chart.setActiveElements([]);
    if (this.activeMacroIndex === index) {
      this.activeMacroIndex = null;
      if (this.chart) this.chart.update();
      return;
    }
    this.activeMacroIndex = index;
    if (el) {
      el.classList.add('active');
      el.setAttribute('aria-pressed', 'true');
    }
    if (this.chart && index !== null && index > -1) {
      this.chart.setActiveElements([{ datasetIndex: 1, index }]);
      this.chart.update();
    }
  }

  renderMetrics() {
    const target = this.targetData;
    const plan = this.planData;
    const current = this.currentData || {};
    const hasCurrent = !!this.currentData;
    const hasMacroData = hasCurrent && ['calories','protein_grams','carbs_grams','fat_grams','fiber_grams'].some(k => typeof current[k] === 'number');
    if (!target) return;
    this.grid.innerHTML = '';
    if (this.warningEl) {
      this.warningEl.classList.remove('show');
      this.warningEl.textContent = '';
    }
    const hasPlan = plan && typeof plan.calories === 'number';
    const planLine =
      hasPlan && this.labels.planVsTargetLabel
        ? `<div class="plan-vs-target">${this.labels.planVsTargetLabel
            .replace('{plan}', plan.calories)
            .replace('{target}', target.calories)}</div>`
        : '';
    const consumedCaloriesRaw = hasMacroData ? current.calories : undefined;
    const consumedCalories = typeof consumedCaloriesRaw === 'number' ? consumedCaloriesRaw : '--';
    const caloriesExceeded =
      typeof consumedCaloriesRaw === 'number' &&
      target.calories &&
      // Превишение се отчита само над зададения множител.
      consumedCaloriesRaw > target.calories * this.exceedThreshold;
    this.centerText.innerHTML = `
      <div class="consumed-calories">${consumedCalories}</div>
      <div class="total-calories-label">${this.labels.totalCaloriesLabel.replace('{calories}', target.calories)}</div>
      ${planLine}`;
    const calDiv = document.createElement('div');
    calDiv.className = 'macro-metric calories';
    if (caloriesExceeded) calDiv.classList.add('over');
    else if (
      typeof consumedCaloriesRaw === 'number' &&
      target.calories &&
      consumedCaloriesRaw < target.calories
    ) calDiv.classList.add('under');
    calDiv.setAttribute('role', 'listitem');
    calDiv.setAttribute('aria-label', `${this.labels.caloriesLabel}: ${consumedCalories} ${this.labels.totalCaloriesLabel.replace('{calories}', target.calories)}`);
    calDiv.innerHTML = `
      <span class="macro-icon"><i class="bi bi-fire"></i></span>
      <div class="macro-label">${this.labels.caloriesLabel}</div>
      <div class="macro-value">${consumedCalories} / ${target.calories} kcal</div>`;
    this.grid.appendChild(calDiv);
    const overMacros = [];
    if (caloriesExceeded) overMacros.push(this.labels.caloriesLabel);
    const macros = [
      { key: 'protein', icon: 'bi-egg-fried' },
      { key: 'carbs', icon: 'bi-basket' },
      { key: 'fat', icon: 'bi-droplet-half' },
      { key: 'fiber', icon: 'bi-flower1' }
    ];
    macros.forEach((item, idx) => {
      const label = this.labels.macros[item.key];
      const currentRaw = hasMacroData ? current[`${item.key}_grams`] : undefined;
      const displayCurrent = typeof currentRaw === 'number' ? currentRaw : '--';
      const targetVal = target[`${item.key}_grams`];
      const percent = formatPercent(currentRaw / targetVal);
      const subtitle = this.labels.subtitle
        ? this.labels.subtitle.replace('{percent}', percent)
        : `${percent} ${this.labels.fromGoal}`.trim();
      const div = document.createElement('div');
      div.className = `macro-metric ${item.key}`;
      if (typeof currentRaw === 'number' && typeof targetVal === 'number') {
        const ratio = currentRaw / targetVal;
        // Клас "over" се добавя само при надвишение над прага.
        if (ratio > this.exceedThreshold) div.classList.add('over');
        else if (ratio < 1) div.classList.add('under');
      }
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `${label}: ${displayCurrent} от ${targetVal} грама (${subtitle})`);
      div.setAttribute('aria-pressed', 'false');
      div.innerHTML = `
        <span class="macro-icon"><i class="bi ${item.icon}"></i></span>
        <div class="macro-label">${label}</div>
        <div class="macro-value">${displayCurrent} / ${targetVal}г</div>
        <div class="macro-subtitle">${subtitle}</div>`;
      div.addEventListener('click', () => this.highlightMacro(div, idx));
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.highlightMacro(div, idx);
        }
      });
      this.grid.appendChild(div);
      if (typeof currentRaw === 'number' && targetVal && currentRaw > targetVal * this.exceedThreshold) {
        // Запомняме макросите, превишили прага, за текстово предупреждение.
        overMacros.push(label);
      }
    });
    if (this.warningEl) {
      if (!hasCurrent) {
        const msg = this.locale === 'en' ? 'No intake data available.' : 'Липсват текущи данни.';
        this.warningEl.textContent = msg;
        this.warningEl.classList.add('show');
      } else if (!hasMacroData) {
        const msg = this.locale === 'en' ? 'No macro data for the product.' : 'Няма макроданни за продукта.';
        this.warningEl.textContent = msg;
        this.warningEl.classList.add('show');
      } else if (overMacros.length > 0) {
        this.warningEl.textContent = this.labels.exceedWarning.replace('{items}', overMacros.join(', '));
        this.warningEl.classList.add('show');
      }
    }
  }

  renderChart() {
    const target = this.targetData;
    const current = this.currentData;
    if (!target || !this.canvas || typeof Chart === 'undefined') return;
    this.hideLoading();
    const skeleton = this.shadowRoot.querySelector('.chart-skeleton');
    if (skeleton) skeleton.remove();
    if (this.canvas.hasAttribute('hidden')) this.canvas.removeAttribute('hidden');
    if (this.chart) this.chart.destroy();
    const ctx = this.canvas.getContext('2d');
    const macroColors = [
      this.getCssVar('--macro-protein-color'),
      this.getCssVar('--macro-carbs-color'),
      this.getCssVar('--macro-fat-color'),
      this.getCssVar('--macro-fiber-color')
    ];
    const datasets = [
      {
        label: this.locale === 'en' ? 'Target (g)' : 'Цел (гр)',
        data: [target.protein_grams, target.carbs_grams, target.fat_grams, target.fiber_grams],
        backgroundColor: current ? macroColors.map((c) => `${c}40`) : macroColors,
        borderWidth: 0,
        cutout: current ? '80%' : '65%'
      }
    ];
    if (current) {
      datasets.push({
        label: this.locale === 'en' ? 'Intake (g)' : 'Прием (гр)',
        data: [current.protein_grams, current.carbs_grams, current.fat_grams, current.fiber_grams],
        backgroundColor: macroColors,
        borderColor: this.getCssVar('--card-bg'),
        borderWidth: 4,
        borderRadius: 8,
        cutout: '65%',
        hoverOffset: 12
      });
    }
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [
          `${this.labels.macros.protein} (${target.protein_percent}%)`,
          `${this.labels.macros.carbs} (${target.carbs_percent}%)`,
          `${this.labels.macros.fat} (${target.fat_percent}%)`,
          `${this.labels.macros.fiber} (${target.fiber_percent}%)`
        ],
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                return `${label}: ${context.parsed}g`;
              }
            }
          }
        },
        onClick: (evt, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const macroCard = this.grid.querySelectorAll('.macro-metric')[idx + 1];
            this.highlightMacro(macroCard, idx);
          } else {
            this.highlightMacro(null, this.activeMacroIndex);
          }
        }
      }
    });
  }
}

customElements.define('macro-analytics-card', MacroAnalyticsCard);
