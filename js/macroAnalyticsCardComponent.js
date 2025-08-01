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
    <h5>Калории и Макронутриенти</h5>
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
    this.chart = null;
    this.activeMacroIndex = null;
    this.targetData = null;
    this.currentData = null;
    this.observer = null;
  }

  static get observedAttributes() {
    return ['target-data', 'current-data'];
  }

  connectedCallback() {
    this.classList.add('loaded');
    this.lazyLoadChart(); // зарежда Chart.js само при видим компонент
  }

  attributeChangedCallback(name, _oldVal, newVal) {
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

  async ensureChartJs() {
    if (window.Chart) return; // библиотеката е налична
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
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
      <div class="total-calories-label">от ${target.calories} kcal</div>`;
    const list = [
      { l: 'Белтъчини', v: `${current.protein_grams} / ${target.protein_grams}г`, s: `${target.protein_percent}%`, c: 'protein', icon: 'bi-egg-fried', a: `Белтъчини: ${current.protein_grams} от ${target.protein_grams} грама` },
      { l: 'Въглехидрати', v: `${current.carbs_grams} / ${target.carbs_grams}г`, s: `${target.carbs_percent}%`, c: 'carbs', icon: 'bi-basket', a: `Въглехидрати: ${current.carbs_grams} от ${target.carbs_grams} грама` },
      { l: 'Мазнини', v: `${current.fat_grams} / ${target.fat_grams}г`, s: `${target.fat_percent}%`, c: 'fat', icon: 'bi-droplet-half', a: `Мазнини: ${current.fat_grams} от ${target.fat_grams} грама` }
    ];
    const calDiv = document.createElement('div');
    calDiv.className = 'macro-metric calories';
    calDiv.setAttribute('role', 'listitem');
    calDiv.setAttribute('aria-label', `Приети Калории: ${current.calories} от ${target.calories} килокалории`);
    calDiv.innerHTML = `
      <span class="macro-icon"><i class="bi bi-fire"></i></span>
      <div class="macro-label">Приети Калории</div>
      <div class="macro-value">${current.calories} / ${target.calories} kcal</div>`;
    this.grid.appendChild(calDiv);
    list.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = `macro-metric ${item.c}`;
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.setAttribute('aria-label', `${item.a} (${item.s} от целта)`);
      div.setAttribute('aria-pressed', 'false');
      div.innerHTML = `
        <span class="macro-icon"><i class="bi ${item.icon}"></i></span>
        <div class="macro-label">${item.l}</div>
        <div class="macro-value">${item.v}</div>
        <div class="macro-subtitle">${item.s} от целта</div>`;
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
          `Белтъчини (${target.protein_percent}%)`,
          `Въглехидрати (${target.carbs_percent}%)`,
          `Мазнини (${target.fat_percent}%)`
        ],
        datasets: [
          {
            label: 'Цел (гр)',
            data: [target.protein_grams, target.carbs_grams, target.fat_grams],
            backgroundColor: macroColors.map((c) => `${c}40`),
            borderWidth: 0,
            cutout: '80%'
          },
          {
            label: 'Прием (гр)',
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
