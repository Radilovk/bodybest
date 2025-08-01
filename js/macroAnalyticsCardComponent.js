const localeCache = {};

async function loadLocale(locale) {
  if (localeCache[locale]) return localeCache[locale];
  const fetchLocale = async (lng) => {
    const res = await fetch(`./locales/macroCard.${lng}.json`);
    if (!res.ok) throw new Error('Missing locale');
    return res.json();
  };
  let data;
  try {
    data = await fetchLocale(locale);
  } catch {
    data = await fetchLocale('bg');
  }
  localeCache[locale] = data;
  return data;
}

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
    .macro-icon { font-size: 1.2rem; }
    .macro-label { font-size: 0.85rem; margin-top: 0.25rem; }
    .macro-value { font-size: 1.1rem; font-weight: 600; }
    .macro-subtitle { font-size: 0.75rem; color: var(--text-secondary-color); }

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
      <canvas hidden aria-label="Диаграма на макронутриенти" role="img"></canvas>
      <div class="chart-center-text"></div>
    </div>
    <div class="macro-metrics-grid" role="list">
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
    this.titleEl = this.shadowRoot.querySelector('h5');
    this.chart = null;
    this.activeMacroIndex = null;
    this.targetData = null;
    this.currentData = null;
    this.observer = null;
    this.refreshTimer = null;
    this.locale = this.getAttribute('locale') || 'bg';
    this.labels = {
      title: '',
      caloriesLabel: '',
      macros: { protein: '', carbs: '', fat: '' },
      fromGoal: '',
      totalCaloriesLabel: ''
    };
  }

  static get observedAttributes() {
    return ['target-data', 'current-data', 'locale', 'data-endpoint', 'refresh-interval'];
  }

  async connectedCallback() {
    this.classList.add('loaded');
    await this.updateLocale();
    this.lazyLoadChart();
    this.setupAutoRefresh();
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'locale') {
      this.locale = newVal;
      this.updateLocale();
      return;
    }
    if (name === 'data-endpoint' || name === 'refresh-interval') {
      this.setupAutoRefresh();
      return;
    }
    try {
      const parsed = JSON.parse(newVal);
      if (name === 'target-data') this.targetData = parsed;
      if (name === 'current-data') this.currentData = parsed;
      this.renderMetrics();
      this.renderChart();
    } catch (e) {
      console.error(`Invalid JSON for ${name}`, e);
    }
  }

  async updateLocale() {
    this.labels = await loadLocale(this.locale);
    if (this.titleEl) this.titleEl.textContent = this.labels.title;
    this.renderMetrics();
    this.renderChart();
  }

  disconnectedCallback() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async ensureChartJs() {
    if (window.Chart) return;
    // Prevent duplicate script tags by sharing a global loading promise
    if (!window._chartPromise) {
      window._chartPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    await window._chartPromise;
  }

  lazyLoadChart() {
    if (this.observer) return;
    if (!('IntersectionObserver' in window)) {
      this.ensureChartJs().then(() => this.renderChart());
      return;
    }
    this.observer = new IntersectionObserver(async (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          this.observer.disconnect();
          await this.ensureChartJs();
          this.renderChart();
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
          this.setData(data.target, data.current);
        }
      } catch (e) {
        console.error('Failed to fetch macro data', e);
      }
    };
    fetchData();
    this.refreshTimer = setInterval(fetchData, interval);
  }

  setData(target, current) {
    this.setAttribute('target-data', JSON.stringify(target));
    this.setAttribute('current-data', JSON.stringify(current));
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
    const current = this.currentData;
    if (!target || !current) return;
    this.grid.innerHTML = '';
    this.centerText.innerHTML = `
      <div class="consumed-calories">${current.calories}</div>
      <div class="total-calories-label">${this.labels.totalCaloriesLabel.replace('{calories}', target.calories)}</div>`;
    const calDiv = document.createElement('div');
    calDiv.className = 'macro-metric calories';
    calDiv.setAttribute('role', 'listitem');
    calDiv.setAttribute('aria-label', `${this.labels.caloriesLabel}: ${current.calories} ${this.labels.totalCaloriesLabel.replace('{calories}', target.calories)}`);
    calDiv.innerHTML = `
      <span class="macro-icon"><i class="bi bi-fire"></i></span>
      <div class="macro-label">${this.labels.caloriesLabel}</div>
      <div class="macro-value">${current.calories} / ${target.calories} kcal</div>`;
    this.grid.appendChild(calDiv);
    const macros = [
      { key: 'protein', icon: 'bi-egg-fried' },
      { key: 'carbs', icon: 'bi-basket' },
      { key: 'fat', icon: 'bi-droplet-half' }
    ];
    macros.forEach((item, idx) => {
      const label = this.labels.macros[item.key];
      const currentVal = current[`${item.key}_grams`];
      const targetVal = target[`${item.key}_grams`];
      const percent = target[`${item.key}_percent`];
      const div = document.createElement('div');
      div.className = `macro-metric ${item.key}`;
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `${label}: ${currentVal} от ${targetVal} грама (${percent}% ${this.labels.fromGoal})`);
      div.setAttribute('aria-pressed', 'false');
      div.innerHTML = `
        <span class="macro-icon"><i class="bi ${item.icon}"></i></span>
        <div class="macro-label">${label}</div>
        <div class="macro-value">${currentVal} / ${targetVal}г</div>
        <div class="macro-subtitle">${percent}% ${this.labels.fromGoal}</div>`;
      div.addEventListener('click', () => this.highlightMacro(div, idx));
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.highlightMacro(div, idx);
        }
      });
      this.grid.appendChild(div);
    });
  }

  renderChart() {
    const target = this.targetData;
    const current = this.currentData;
    if (!target || !current || !this.canvas || typeof Chart === 'undefined') return;
    const skeleton = this.shadowRoot.querySelector('.chart-skeleton');
    if (skeleton) skeleton.remove();
    if (this.canvas.hasAttribute('hidden')) this.canvas.removeAttribute('hidden');
    if (this.chart) this.chart.destroy();
    const ctx = this.canvas.getContext('2d');
    const macroColors = [
      this.getCssVar('--macro-protein-color'),
      this.getCssVar('--macro-carbs-color'),
      this.getCssVar('--macro-fat-color')
    ];
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [
          `${this.labels.macros.protein} (${target.protein_percent}%)`,
          `${this.labels.macros.carbs} (${target.carbs_percent}%)`,
          `${this.labels.macros.fat} (${target.fat_percent}%)`
        ],
        datasets: [
          {
            label: this.locale === 'en' ? 'Target (g)' : 'Цел (гр)',
            data: [target.protein_grams, target.carbs_grams, target.fat_grams],
            backgroundColor: macroColors.map((c) => `${c}40`),
            borderWidth: 0,
            cutout: '80%'
          },
          {
            label: this.locale === 'en' ? 'Intake (g)' : 'Прием (гр)',
            data: [current.protein_grams, current.carbs_grams, current.fat_grams],
            backgroundColor: macroColors,
            borderColor: this.getCssVar('--card-bg'),
            borderWidth: 4,
            borderRadius: 8,
            cutout: '65%',
            hoverOffset: 12
          }
        ]
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
