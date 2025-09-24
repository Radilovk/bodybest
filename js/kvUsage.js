const form = document.getElementById('kvUsageForm');
const fromInput = document.getElementById('kvFromDate');
const toInput = document.getElementById('kvToDate');
const statusEl = document.getElementById('kvStatus');
const totalsContainer = document.getElementById('kvSummaryTotals');
const namespaceList = document.getElementById('kvNamespaceList');
const methodList = document.getElementById('kvMethodList');
const extraMetricsList = document.getElementById('kvExtraMetrics');
const tableBody = document.querySelector('#kvUsageTable tbody');

const intFormatter = new Intl.NumberFormat('bg-BG');
const floatFormatter = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

init();

function init() {
  clearSummary();
  setDefaultRange();
  form?.addEventListener('submit', event => {
    event.preventDefault();
    void loadKvUsage();
  });
  void loadKvUsage();
}

function setDefaultRange() {
  const today = new Date();
  const to = formatDate(today);
  const fromDate = new Date(today.getTime());
  fromDate.setDate(fromDate.getDate() - 6);
  fromInput.value = formatDate(fromDate);
  toInput.value = to;
}

async function loadKvUsage() {
  const from = fromInput.value;
  const to = toInput.value;
  if (!from || !to) {
    statusEl.textContent = 'Моля изберете валиден период.';
    return;
  }
  if (from > to) {
    statusEl.textContent = 'Началната дата трябва да е преди крайната.';
    return;
  }

  const params = new URLSearchParams({ from, to });
  statusEl.textContent = 'Зареждане на KV статистика...';
  try {
    const response = await fetch(`/api/kvUsage?${params.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || `Сървърът върна ${response.status}`);
    }

    const handlers = Array.isArray(payload.handlers) ? payload.handlers : [];
    const summary = payload.summary || {};
    const datesCovered = Array.isArray(payload.dates) ? payload.dates : [];
    const datesWithData = Array.isArray(payload.datesWithData) ? payload.datesWithData : [];

    updateSummary(summary, payload.range, datesCovered, datesWithData, handlers);
    renderTable(handlers);

    const generatedAt = formatDateTime(summary.generatedAt);
    const rangeText = payload.range
      ? `${payload.range.from} – ${payload.range.to}`
      : `${from} – ${to}`;
    const coverageNote = datesWithData.length
      ? `данни за ${datesWithData.length} от ${datesCovered.length || '-'} дни`
      : 'няма данни за избрания период';
    statusEl.textContent = `Период ${rangeText}; ${coverageNote}${generatedAt ? ` • обновено: ${generatedAt}` : ''}.`;
  } catch (error) {
    console.error('KV usage load failed:', error);
    statusEl.textContent = `Грешка при зареждане: ${error.message}`;
    clearSummary();
    renderTable([]);
  }
}

function updateSummary(summary, range, datesCovered, datesWithData, handlers) {
  totalsContainer.innerHTML = '';

  const totalRequests = Number(summary.totalRequests || 0);
  const totalOperations = Number(summary.totalOperations || 0);
  const avgPerRequest = totalRequests > 0 ? totalOperations / totalRequests : 0;
  const daysInRange = Array.isArray(datesCovered) && datesCovered.length
    ? datesCovered.length
    : calculateRangeLength(range?.from, range?.to);
  const extraMetrics = summary.extraMetrics || {};
  const aiCalls = Number(extraMetrics['AI заявки'] || 0);
  const aiTokens = Number(extraMetrics['AI токени - общо'] || 0);
  const busiestRoute = handlers
    .slice()
    .sort((a, b) => Number(b.totalOperations || 0) - Number(a.totalOperations || 0))[0];

  const summaryCards = [
    createSummaryCard('Общо заявки', formatInt(totalRequests)),
    createSummaryCard('KV операции', formatInt(totalOperations)),
    createSummaryCard('Средно KV/заявка', formatFloat(avgPerRequest)),
    createSummaryCard('Покрити дни', formatInt(daysInRange))
  ];

  if (busiestRoute?.handler) {
    summaryCards.push(createSummaryCard('Най-натоварен маршрут', `${busiestRoute.handler} (${formatInt(busiestRoute.totalOperations || 0)} операции)`));
  }
  if (aiCalls > 0) {
    summaryCards.push(createSummaryCard('AI заявки', formatInt(aiCalls)));
  }
  if (aiTokens > 0) {
    summaryCards.push(createSummaryCard('AI токени (общо)', formatInt(aiTokens)));
    if (aiCalls > 0) {
      summaryCards.push(createSummaryCard('Средно токени/AI заявка', formatFloat(aiTokens / aiCalls)));
    }
  }

  totalsContainer.innerHTML = summaryCards.join('');

  renderNamespaceSummary(summary.namespaceTotals);
  renderMethodSummary(summary.methodTotals);
  renderExtraMetrics(summary.extraMetrics);
}

function renderNamespaceSummary(namespaceTotals) {
  namespaceList.innerHTML = '';
  const entries = Object.entries(namespaceTotals || {})
    .sort((a, b) => Number(b[1]?.total || 0) - Number(a[1]?.total || 0));
  if (!entries.length) {
    namespaceList.innerHTML = '<li>Няма налични данни.</li>';
    return;
  }
  for (const [name, metrics] of entries) {
    const li = document.createElement('li');
    li.textContent = `${name}: ${formatInt(metrics.total || 0)} (get ${formatInt(metrics.get || 0)}, put ${formatInt(metrics.put || 0)}, list ${formatInt(metrics.list || 0)}, delete ${formatInt(metrics.delete || 0)})`;
    namespaceList.appendChild(li);
  }
}

function renderMethodSummary(methodTotals) {
  methodList.innerHTML = '';
  const totals = methodTotals || {};
  const entries = [
    ['get', totals.get || 0],
    ['put', totals.put || 0],
    ['list', totals.list || 0],
    ['delete', totals.delete || 0]
  ].filter(([, value]) => value > 0);

  if (!entries.length) {
    methodList.innerHTML = '<li>Няма отчетени операции.</li>';
    return;
  }
  for (const [method, value] of entries) {
    const li = document.createElement('li');
    li.textContent = `${method.toUpperCase()}: ${formatInt(value)}`;
    methodList.appendChild(li);
  }
}

function renderExtraMetrics(extraMetrics) {
  extraMetricsList.innerHTML = '';
  const entries = Object.entries(extraMetrics || {})
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value !== 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!entries.length) {
    extraMetricsList.innerHTML = '<li>Все още няма други измерители.</li>';
    return;
  }
  for (const [metric, value] of entries) {
    const li = document.createElement('li');
    li.textContent = `${metric}: ${formatInt(value)}`;
    extraMetricsList.appendChild(li);
  }
}

function renderTable(handlers) {
  tableBody.innerHTML = '';
  if (!handlers.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'Няма данни за избрания период.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  for (const handler of handlers) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(handler.handler)}</td>
      <td>${formatInt(handler.requests || 0)}</td>
      <td>${formatInt(handler.totalOperations || 0)}</td>
      <td>${formatFloat(handler.averagePerRequest || 0)}</td>
      <td>${renderNamespaceCell(handler.byNamespace)}</td>
      <td>${renderMethodCell(handler.byMethod)}</td>
    `;
    tableBody.appendChild(row);
  }
}

function renderNamespaceCell(byNamespace) {
  const entries = Object.entries(byNamespace || {})
    .sort((a, b) => Number(b[1]?.total || 0) - Number(a[1]?.total || 0));
  if (!entries.length) return '—';
  return entries
    .map(([name, metrics]) => `<div><span class="kv-tag">${escapeHtml(name)}</span> ${formatInt(metrics.total || 0)} (g:${formatInt(metrics.get || 0)} p:${formatInt(metrics.put || 0)} l:${formatInt(metrics.list || 0)} d:${formatInt(metrics.delete || 0)})</div>`)
    .join('');
}

function renderMethodCell(byMethod = {}) {
  const parts = [];
  for (const method of ['get', 'put', 'list', 'delete']) {
    const count = Number(byMethod[method] || 0);
    if (count > 0) {
      parts.push(`<span class="kv-tag">${escapeHtml(method.toUpperCase())}</span> ${formatInt(count)}`);
    }
  }
  return parts.length ? parts.map(p => `<div>${p}</div>`).join('') : '—';
}

function clearSummary() {
  totalsContainer.innerHTML = '';
  namespaceList.innerHTML = '<li>Няма налични данни.</li>';
  methodList.innerHTML = '<li>Няма отчетени операции.</li>';
  extraMetricsList.innerHTML = '<li>Все още няма други измерители.</li>';
}

function createSummaryCard(title, value) {
  return `
    <div class="kv-summary-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="kv-summary-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function formatInt(value) {
  return intFormatter.format(Math.round(Number(value) || 0));
}

function formatFloat(value) {
  return floatFormatter.format(Number(value) || 0);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('bg-BG');
}

function calculateRangeLength(from, to) {
  if (!from || !to) return 0;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  const diff = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
  return diff;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
