import { apiEndpoints } from './config.js';

let macroChart;
let weightChart;


export function calcMacroGrams(calories, percent, calsPerGram) {
  const cal = Number(calories);
  const pct = Number(percent);
  if (!cal || !pct) return 0;
  return Math.round((cal * pct) / 100 / calsPerGram);
}

export function calcMacroPercent(calories, grams, calsPerGram) {
  const cal = Number(calories);
  const g = Number(grams);
  if (!cal || !g) return 0;
  return Math.round((g * calsPerGram) / cal * 100);
}

export function addEditableMealItem(container, item = { name: '', grams: '' }) {
  const itemWrapper = document.createElement('div');
  itemWrapper.className = 'item-entry';
  itemWrapper.innerHTML = `
    <input type="text" class="form-control form-control-sm item-name-input" value="${item.name}" placeholder="Продукт">
    <input type="text" class="form-control form-control-sm item-grams-input" value="${item.grams}" placeholder="Количество">
    <button class="btn btn-outline-danger btn-sm remove-item-btn" type="button"><i class="bi bi-x"></i></button>`;
  container.appendChild(itemWrapper);
  itemWrapper.querySelector('.remove-item-btn').addEventListener('click', () => itemWrapper.remove());
}

export async function initEditClient(userId) {
  let planData = {};
  let dashboardData = null;
  let editingCards = new Set();

  async function loadData() {
    try {
      const [profileResp, dashResp] = await Promise.all([
        fetch(`${apiEndpoints.getProfile}?userId=${userId}`),
        fetch(`${apiEndpoints.dashboard}?userId=${userId}`)
      ]);
      const [profileData, dashData] = await Promise.all([
        profileResp.json().catch(() => ({})),
        dashResp.json().catch(() => ({}))
      ]);
      if (dashResp.ok && dashData.success) {
        planData = dashData.planData || {};
        dashboardData = dashData;
      }
      if (profileResp.ok && profileData.success) {
        const name = profileData.name || 'Клиент';
        const header = document.getElementById('client-name');
        if (header) header.textContent = name;
      }
    } catch (err) {
      console.error('Error loading client data', err);
    }
  }

  function populateUI(data) {
    const summaryView = document.getElementById('profileSummary-view');
    if (!summaryView) return;
    summaryView.textContent = data.profileSummary || '';
    document.getElementById('profileSummary-edit-summary').value = data.profileSummary || '';

    const weightMatch = (data.profileSummary || '').match(/текущо тегло (\d+\.?\d*) кг \(промяна за 7 дни: (-?\d+\.?\d*) кг\)/);
    if (weightMatch) {
      document.getElementById('current-weight-display').textContent = weightMatch[1];
      document.getElementById('weight-change-display').textContent = weightMatch[2];
    }

    document.getElementById('caloriesMacros-calories-view').textContent = `${data.caloriesMacros?.calories || 0} kcal`;
    document.getElementById('caloriesMacros-protein-view').textContent = `${data.caloriesMacros?.protein_percent || 0}% / ${data.caloriesMacros?.protein_grams || 0}г`;
    document.getElementById('caloriesMacros-carbs-view').textContent = `${data.caloriesMacros?.carbs_percent || 0}% / ${data.caloriesMacros?.carbs_grams || 0}г`;
    document.getElementById('caloriesMacros-fat-view').textContent = `${data.caloriesMacros?.fat_percent || 0}% / ${data.caloriesMacros?.fat_grams || 0}г`;

    document.getElementById('caloriesMacros-edit-calories').value = data.caloriesMacros?.calories || 0;
    document.getElementById('caloriesMacros-edit-protein-percent').value = data.caloriesMacros?.protein_percent || 0;
    document.getElementById('caloriesMacros-edit-protein-grams').value = data.caloriesMacros?.protein_grams || 0;
    document.getElementById('caloriesMacros-edit-carbs-percent').value = data.caloriesMacros?.carbs_percent || 0;
    document.getElementById('caloriesMacros-edit-carbs-grams').value = data.caloriesMacros?.carbs_grams || 0;
    document.getElementById('caloriesMacros-edit-fat-percent').value = data.caloriesMacros?.fat_percent || 0;
    document.getElementById('caloriesMacros-edit-fat-grams').value = data.caloriesMacros?.fat_grams || 0;

    populateList('main_allowed_foods', data.allowedForbiddenFoods?.main_allowed_foods || []);
    populateList('main_forbidden_foods', data.allowedForbiddenFoods?.main_forbidden_foods || []);
    populateList('detailed_allowed_suggestions', data.allowedForbiddenFoods?.detailed_allowed_suggestions || []);
    populateList('detailed_limit_suggestions', data.allowedForbiddenFoods?.detailed_limit_suggestions || []);
    populateList('dressing_flavoring_ideas', data.allowedForbiddenFoods?.dressing_flavoring_ideas || []);

    populateWeek1Menu(data.week1Menu || {});
    populatePrinciples(data.principlesWeek2_4 || []);

    const hcs = data.hydrationCookingSupplements || {};
    const hyd = hcs.hydration_recommendations || {};
    document.getElementById('hydration_daily_liters-view').textContent = `Препоръчителен прием: ${hyd.daily_liters || ''}л`;
    document.getElementById('hydration_tips-view').textContent = (hyd.tips || []).join(', ');
    document.getElementById('hydration_suitable_drinks-view').textContent = (hyd.suitable_drinks || []).join(', ');
    document.getElementById('hydration_unsuitable_drinks-view').textContent = (hyd.unsuitable_drinks || []).join(', ');

    document.getElementById('hydration_daily_liters-edit').value = hyd.daily_liters || '';
    document.getElementById('hydration_tips-edit').value = (hyd.tips || []).join(', ');
    document.getElementById('hydration_suitable_drinks-edit').value = (hyd.suitable_drinks || []).join(', ');
    document.getElementById('hydration_unsuitable_drinks-edit').value = (hyd.unsuitable_drinks || []).join(', ');

    const cm = hcs.cooking_methods || {};
    document.getElementById('cooking_recommended-view').textContent = (cm.recommended || []).join(', ');
    document.getElementById('cooking_limit_or_avoid-view').textContent = (cm.limit_or_avoid || []).join(', ');
    document.getElementById('cooking_fat_usage_tip-view').textContent = cm.fat_usage_tip || '';

    document.getElementById('cooking_recommended-edit').value = (cm.recommended || []).join(', ');
    document.getElementById('cooking_limit_or_avoid-edit').value = (cm.limit_or_avoid || []).join(', ');
    document.getElementById('cooking_fat_usage_tip-edit').value = cm.fat_usage_tip || '';

    populateSupplements(hcs.supplement_suggestions || []);

    const pg = data.psychologicalGuidance || {};
    document.getElementById('coping_strategies-view').innerHTML = (pg.coping_strategies || []).map(i => `<li>${i}</li>`).join('');
    document.getElementById('motivational_messages-view').innerHTML = (pg.motivational_messages || []).map(i => `<li>${i}</li>`).join('');
    document.getElementById('habit_building_tip-view').textContent = pg.habit_building_tip || '';
    document.getElementById('self_compassion_reminder-view').textContent = pg.self_compassion_reminder || '';

    document.getElementById('coping_strategies-edit').value = (pg.coping_strategies || []).join(', ');
    document.getElementById('motivational_messages-edit').value = (pg.motivational_messages || []).join(', ');
    document.getElementById('habit_building_tip-edit').value = pg.habit_building_tip || '';
    document.getElementById('self_compassion_reminder-edit').value = pg.self_compassion_reminder || '';

    const dt = data.detailedTargets || {};
    document.getElementById('sleep_quality_target_text-view').textContent = dt.sleep_quality_target_text || '';
    document.getElementById('stress_level_target_text-view').textContent = dt.stress_level_target_text || '';
    document.getElementById('energy_level_target_text-view').textContent = dt.energy_level_target_text || '';
    document.getElementById('hydration_target_text-view').textContent = dt.hydration_target_text || '';
    document.getElementById('bmi_target_numeric-view').textContent = dt.bmi_target_numeric || '';
    document.getElementById('bmi_target_category_text-view').textContent = dt.bmi_target_category_text || '';
    document.getElementById('meal_adherence_target_percent-view').textContent = dt.meal_adherence_target_percent || '';
    document.getElementById('log_consistency_target_percent-view').textContent = dt.log_consistency_target_percent || '';

    document.getElementById('sleep_quality_target_text-edit').value = dt.sleep_quality_target_text || '';
    document.getElementById('stress_level_target_text-edit').value = dt.stress_level_target_text || '';
    document.getElementById('energy_level_target_text-edit').value = dt.energy_level_target_text || '';
    document.getElementById('hydration_target_text-edit').value = dt.hydration_target_text || '';
    document.getElementById('bmi_target_numeric-edit').value = dt.bmi_target_numeric || '';
    document.getElementById('bmi_target_category_text-edit').value = dt.bmi_target_category_text || '';
    document.getElementById('meal_adherence_target_percent-edit').value = dt.meal_adherence_target_percent || '';
    document.getElementById('log_consistency_target_percent-edit').value = dt.log_consistency_target_percent || '';

    const gm = data.generationMetadata || {};
    if (gm.timestamp) document.getElementById('metadata-timestamp').textContent = new Date(gm.timestamp).toLocaleString();
    document.getElementById('metadata-modelUsed').textContent = gm.modelUsed || '';
    document.getElementById('metadata-promptVersion').textContent = gm.promptVersion || '';
    document.getElementById('metadata-errors').textContent = (gm.errors || []).length ? gm.errors.join(', ') : 'Няма';
  }

  function populateList(id, items) {
    const viewList = document.getElementById(`${id}-view`);
    const editContainer = document.getElementById(`${id}-edit`);
    if (!viewList || !editContainer) return;
    viewList.innerHTML = '';
    editContainer.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      viewList.appendChild(li);
      addEditableListItem(editContainer, item);
    });
  }

  function addEditableListItem(container, value = '') {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-group mb-2';
    wrapper.innerHTML = `
      <input type="text" class="form-control" value="${value}">
      <button class="btn btn-outline-danger btn-sm remove-list-item-btn" type="button">
        <i class="bi bi-x-circle"></i>
      </button>`;
    container.appendChild(wrapper);
    wrapper.querySelector('.remove-list-item-btn').addEventListener('click', () => {
      wrapper.remove();
    });
  }

  document.querySelectorAll('.add-list-item-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const listId = e.target.closest('button').dataset.listId;
      addEditableListItem(document.getElementById(listId));
    });
  });

  function populatePrinciples(principles) {
    const viewList = document.getElementById('principlesWeek2_4-view');
    const editContainer = document.getElementById('principlesWeek2_4-edit');
    viewList.innerHTML = '';
    editContainer.innerHTML = '';
    principles.forEach(p => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `<strong><i class="bi bi-${p.icon?.replace('icon-', '')}"></i> ${p.title}:</strong> ${p.content}`;
      viewList.appendChild(li);
      addEditablePrincipleItem(editContainer, p);
    });
  }

  function addEditablePrincipleItem(container, p = { title: '', content: '', icon: '' }) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-3 p-2 border rounded';
    wrap.innerHTML = `
      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Заглавие</span>
        <input type="text" class="form-control principle-title" value="${p.title}">
      </div>
      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Съдържание</span>
        <input type="text" class="form-control principle-content" value="${p.content}">
      </div>
      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Икона (bi-*)</span>
        <input type="text" class="form-control principle-icon" value="${p.icon.replace('icon-', '')}">
      </div>
      <button class="btn btn-outline-danger btn-sm mt-1 remove-principle-btn" type="button">
        <i class="bi bi-x-circle"></i> Изтрий принцип
      </button>`;
    container.appendChild(wrap);
    wrap.querySelector('.remove-principle-btn').addEventListener('click', () => wrap.remove());
  }

  document.querySelector('.add-principle-btn')?.addEventListener('click', () => {
    addEditablePrincipleItem(document.getElementById('principlesWeek2_4-edit'));
  });

  function populateSupplements(list) {
    const viewList = document.getElementById('supplement_suggestions-view');
    const editContainer = document.getElementById('supplement_suggestions-edit');
    viewList.innerHTML = '';
    editContainer.innerHTML = '';
    list.forEach(sup => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${sup.supplement_name}:</strong> ${sup.reasoning} <small class="text-muted">(Внимание: ${sup.caution})</small>`;
      viewList.appendChild(li);
      addEditableSupplementItem(editContainer, sup);
    });
  }

  function addEditableSupplementItem(container, sup = { supplement_name: '', reasoning: '', caution: '' }) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-3 p-2 border rounded';
    wrap.innerHTML = `
      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Име</span>
        <input type="text" class="form-control supplement-name" value="${sup.supplement_name}">
      </div>
      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Обосновка</span>
        <input type="text" class="form-control supplement-reasoning" value="${sup.reasoning}">
      </div>
      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Внимание</span>
        <input type="text" class="form-control supplement-caution" value="${sup.caution}">
      </div>
      <button class="btn btn-outline-danger btn-sm mt-1 remove-supplement-btn" type="button">
        <i class="bi bi-x-circle"></i> Изтрий добавка
      </button>`;
    container.appendChild(wrap);
    wrap.querySelector('.remove-supplement-btn').addEventListener('click', () => wrap.remove());
  }

  document.querySelector('.add-supplement-btn')?.addEventListener('click', () => {
    addEditableSupplementItem(document.getElementById('supplement_suggestions-edit'));
  });

  function populateWeek1Menu(menu) {
    const viewAccordion = document.getElementById('week1Menu-view');
    const editContainer = document.getElementById('week1Menu-edit');
    viewAccordion.innerHTML = '';
    editContainer.querySelectorAll('.week-day-edit-entry').forEach(el => el.remove());

    const dayNames = { monday: 'Понеделник', tuesday: 'Вторник', wednesday: 'Сряда', thursday: 'Четвъртък', friday: 'Петък', saturday: 'Събота', sunday: 'Неделя' };
    let dayIndex = 0;
    for (const dayKey in menu) {
      const meals = menu[dayKey];
      const dayName = dayNames[dayKey] || dayKey;
      const collapseId = `collapse${dayKey}`;
      const isFirst = dayIndex === 0;
      const item = document.createElement('div');
      item.className = 'accordion-item';
      item.innerHTML = `
        <h2 class="accordion-header">
          <button class="accordion-button ${isFirst ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
            ${dayName}
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${isFirst ? 'show' : ''}" data-bs-parent="#week1Menu-view">
          <div class="accordion-body" id="menu-day-view-${dayKey}"></div>
        </div>`;
      viewAccordion.appendChild(item);
      const dayBody = item.querySelector(`#menu-day-view-${dayKey}`);
      meals.forEach(meal => {
        const mealDiv = document.createElement('div');
        mealDiv.innerHTML = `<strong>${meal.meal_name}:</strong> ${meal.items.map(i => `${i.name} (${i.grams})`).join(', ')}`;
        dayBody.appendChild(mealDiv);
      });
      addEditableDayMenu(editContainer, dayKey, dayName, meals);
      dayIndex++;
    }
  }

  function addEditableDayMenu(container, dayKey = '', dayName = '', meals = []) {
    const wrapper = document.createElement('div');
    wrapper.className = 'week-day-edit-entry mb-4 p-3 border rounded bg-light';
    const randomId = Math.random().toString(36).substring(2, 9);
    wrapper.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <input type="text" class="form-control day-name-input me-2" value="${dayName}" placeholder="Име на деня (напр. Понеделник)">
        <input type="text" class="form-control day-key-input me-2" value="${dayKey}" placeholder="Ключ (напр. monday)">
        <button class="btn btn-danger btn-sm remove-day-btn" type="button"><i class="bi bi-trash"></i> Изтрий ден</button>
      </div>
      <div class="meals-container" id="meals-container-${randomId}"></div>
      <button class="btn btn-outline-primary btn-sm mt-2 add-meal-btn" data-target-id="meals-container-${randomId}">
        <i class="bi bi-plus-circle"></i> Добави хранене
      </button>`;
    const anchor = document.getElementById('add-week-day-btn');
    if (anchor) {
      container.insertBefore(wrapper, anchor);
    } else {
      container.appendChild(wrapper);
    }
    meals.forEach(m => addEditableMeal(wrapper.querySelector(`#meals-container-${randomId}`), m));
    wrapper.querySelector('.remove-day-btn').addEventListener('click', () => wrapper.remove());
    wrapper.querySelector('.add-meal-btn').addEventListener('click', e => {
      const targetId = e.target.closest('button').dataset.targetId;
      addEditableMeal(document.getElementById(targetId));
    });
  }

  function addEditableMeal(container, meal = { meal_name: '', items: [] }) {
    const mealWrapper = document.createElement('div');
    mealWrapper.className = 'meal-entry';
    const mealRandomId = Math.random().toString(36).substring(2, 9);
    mealWrapper.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <input type="text" class="form-control meal-name-input me-2" value="${meal.meal_name}" placeholder="Име на хранене (напр. Закуска)">
        <button class="btn btn-danger btn-sm remove-meal-btn" type="button"><i class="bi bi-x-circle"></i></button>
      </div>
      <div class="meal-items-container" id="meal-items-container-${mealRandomId}"></div>
      <button class="btn btn-outline-secondary btn-sm mt-2 add-item-btn" type="button" data-target-id="meal-items-container-${mealRandomId}">
        <i class="bi bi-plus-circle"></i> Добави продукт
      </button>`;
    container.appendChild(mealWrapper);
    meal.items.forEach(i => addEditableMealItem(mealWrapper.querySelector(`#meal-items-container-${mealRandomId}`), i));
    mealWrapper.querySelector('.remove-meal-btn').addEventListener('click', () => mealWrapper.remove());
    mealWrapper.querySelector('.add-item-btn').addEventListener('click', e => {
      const targetId = e.target.closest('button').dataset.targetId;
      addEditableMealItem(document.getElementById(targetId));
    });
  }


  const addDayBtn = document.getElementById('add-week-day-btn');
  if (addDayBtn) {
    addDayBtn.addEventListener('click', () => {
      const dayKeys = Object.keys(planData.week1Menu || {});
      const newDayKey = `day${dayKeys.length + 1}`;
      addEditableDayMenu(document.getElementById('week1Menu-edit'), newDayKey, `Нов Ден ${dayKeys.length + 1}`);
    });
  }

  function toggleEditMode(cardId, isEditing) {
    const cardElement = typeof cardId === 'string' ? document.getElementById(cardId) : cardId;
    if (isEditing) {
      cardElement.classList.add('editing');
      editingCards.add(cardElement.id);
    } else {
      cardElement.classList.remove('editing');
      editingCards.delete(cardElement.id);
    }
    updateGlobalButtonsVisibility();
  }

  document.querySelectorAll('.toggle-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleEditMode(btn.getAttribute('data-target'), true);
    });
  });

  document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.getAttribute('data-target');
      populateUI(planData);
      toggleEditMode(cardId, false);
    });
  });


  function setupMacroAutoCalc() {
    const calInput = document.getElementById("caloriesMacros-edit-calories");
    const pPct = document.getElementById("caloriesMacros-edit-protein-percent");
    const pGram = document.getElementById("caloriesMacros-edit-protein-grams");
    const cPct = document.getElementById("caloriesMacros-edit-carbs-percent");
    const cGram = document.getElementById("caloriesMacros-edit-carbs-grams");
    const fPct = document.getElementById("caloriesMacros-edit-fat-percent");
    const fGram = document.getElementById("caloriesMacros-edit-fat-grams");
  if (!calInput || !pPct || !pGram || !cPct || !cGram || !fPct || !fGram) return;

    function updateGrams() {
      const cal = parseInt(calInput.value);
      pGram.value = calcMacroGrams(cal, pPct.value, 4);
      cGram.value = calcMacroGrams(cal, cPct.value, 4);
      fGram.value = calcMacroGrams(cal, fPct.value, 9);
    }

    function updatePercents() {
      const cal = parseInt(calInput.value);
      if (!cal) return;
      pPct.value = calcMacroPercent(cal, pGram.value, 4);
      cPct.value = calcMacroPercent(cal, cGram.value, 4);
      fPct.value = calcMacroPercent(cal, fGram.value, 9);
    }

    [calInput, pPct, cPct, fPct].forEach(el => {
      el.addEventListener('input', updateGrams);
    });
    [pGram, cGram, fGram].forEach(el => {
      el.addEventListener('input', updatePercents);
    });
  }

  function updateGlobalButtonsVisibility() {
    const saveBtn = document.getElementById('global-save-btn');
    const cancelBtn = document.getElementById('global-cancel-btn');
    if (!saveBtn || !cancelBtn) return;
    if (editingCards.size > 0) {
      saveBtn.classList.remove('d-none');
      cancelBtn.classList.remove('d-none');
    } else {
      saveBtn.classList.add('d-none');
      cancelBtn.classList.add('d-none');
    }
  }

  function collectPlanData() {
    planData.profileSummary = document.getElementById('profileSummary-edit-summary').value;
    planData.caloriesMacros = {
      calories: parseInt(document.getElementById('caloriesMacros-edit-calories').value),
      protein_percent: parseInt(document.getElementById('caloriesMacros-edit-protein-percent').value),
      protein_grams: parseInt(document.getElementById('caloriesMacros-edit-protein-grams').value),
      carbs_percent: parseInt(document.getElementById('caloriesMacros-edit-carbs-percent').value),
      carbs_grams: parseInt(document.getElementById('caloriesMacros-edit-carbs-grams').value),
      fat_percent: parseInt(document.getElementById('caloriesMacros-edit-fat-percent').value),
      fat_grams: parseInt(document.getElementById('caloriesMacros-edit-fat-grams').value)
    };
    planData.allowedForbiddenFoods = {
      main_allowed_foods: Array.from(document.querySelectorAll('#main_allowed_foods-edit input')).map(i => i.value).filter(Boolean),
      main_forbidden_foods: Array.from(document.querySelectorAll('#main_forbidden_foods-edit input')).map(i => i.value).filter(Boolean),
      detailed_allowed_suggestions: Array.from(document.querySelectorAll('#detailed_allowed_suggestions-edit input')).map(i => i.value).filter(Boolean),
      detailed_limit_suggestions: Array.from(document.querySelectorAll('#detailed_limit_suggestions-edit input')).map(i => i.value).filter(Boolean),
      dressing_flavoring_ideas: Array.from(document.querySelectorAll('#dressing_flavoring_ideas-edit input')).map(i => i.value).filter(Boolean)
    };
    planData.principlesWeek2_4 = Array.from(document.querySelectorAll('#principlesWeek2_4-edit .mb-3.p-2.border.rounded')).map(w => ({
      title: w.querySelector('.principle-title').value,
      content: w.querySelector('.principle-content').value,
      icon: `icon-${w.querySelector('.principle-icon').value}`
    })).filter(p => p.title.trim() !== '');
    planData.hydrationCookingSupplements = {
      hydration_recommendations: {
        daily_liters: document.getElementById('hydration_daily_liters-edit').value,
        tips: document.getElementById('hydration_tips-edit').value.split(',').map(s => s.trim()).filter(Boolean),
        suitable_drinks: document.getElementById('hydration_suitable_drinks-edit').value.split(',').map(s => s.trim()).filter(Boolean),
        unsuitable_drinks: document.getElementById('hydration_unsuitable_drinks-edit').value.split(',').map(s => s.trim()).filter(Boolean)
      },
      cooking_methods: {
        recommended: document.getElementById('cooking_recommended-edit').value.split(',').map(s => s.trim()).filter(Boolean),
        limit_or_avoid: document.getElementById('cooking_limit_or_avoid-edit').value.split(',').map(s => s.trim()).filter(Boolean),
        fat_usage_tip: document.getElementById('cooking_fat_usage_tip-edit').value
      },
      supplement_suggestions: Array.from(document.querySelectorAll('#supplement_suggestions-edit .mb-3.p-2.border.rounded')).map(w => ({
        supplement_name: w.querySelector('.supplement-name').value,
        reasoning: w.querySelector('.supplement-reasoning').value,
        caution: w.querySelector('.supplement-caution').value
      })).filter(s => s.supplement_name.trim() !== '')
    };
    planData.psychologicalGuidance = {
      coping_strategies: document.getElementById('coping_strategies-edit').value.split(',').map(s => s.trim()).filter(Boolean),
      motivational_messages: document.getElementById('motivational_messages-edit').value.split(',').map(s => s.trim()).filter(Boolean),
      habit_building_tip: document.getElementById('habit_building_tip-edit').value,
      self_compassion_reminder: document.getElementById('self_compassion_reminder-edit').value
    };
    planData.detailedTargets = {
      sleep_quality_target_text: document.getElementById('sleep_quality_target_text-edit').value,
      stress_level_target_text: document.getElementById('stress_level_target_text-edit').value,
      energy_level_target_text: document.getElementById('energy_level_target_text-edit').value,
      hydration_target_text: document.getElementById('hydration_target_text-edit').value,
      bmi_target_numeric: parseFloat(document.getElementById('bmi_target_numeric-edit').value),
      bmi_target_category_text: document.getElementById('bmi_target_category_text-edit').value,
      meal_adherence_target_percent: parseInt(document.getElementById('meal_adherence_target_percent-edit').value),
      log_consistency_target_percent: parseInt(document.getElementById('log_consistency_target_percent-edit').value)
    };
    const newMenu = {};
    document.querySelectorAll('#week1Menu-edit .week-day-edit-entry').forEach(dayEntry => {
      const dayKey = dayEntry.querySelector('.day-key-input').value;
      const meals = [];
      dayEntry.querySelectorAll('.meal-entry').forEach(mealEntry => {
        const mealName = mealEntry.querySelector('.meal-name-input').value;
        const items = [];
        mealEntry.querySelectorAll('.item-entry').forEach(itemEntry => {
          items.push({ name: itemEntry.querySelector('.item-name-input').value, grams: itemEntry.querySelector('.item-grams-input').value });
        });
        if (mealName.trim()) {
          meals.push({ meal_name: mealName, items: items.filter(i => i.name.trim()) });
        }
      });
      if (dayKey.trim() && meals.length > 0) newMenu[dayKey] = meals;
    });
    planData.week1Menu = newMenu;
  }

  async function savePlan() {
    collectPlanData();
    try {
      const resp = await fetch(apiEndpoints.updatePlanData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, planData })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Save failed');
      }
    } catch (err) {
      console.error('Error saving plan', err);
      alert('Грешка при запис.');
    }
  }

  const globalSaveBtn = document.getElementById('global-save-btn');
  if (globalSaveBtn) {
    globalSaveBtn.addEventListener('click', async () => {
      await savePlan();
      editingCards.forEach(id => toggleEditMode(id, false));
      populateUI(planData);
      initCharts(planData);
    });
  }

  const globalCancelBtn = document.getElementById('global-cancel-btn');
  if (globalCancelBtn) {
    globalCancelBtn.addEventListener('click', () => {
      editingCards.forEach(id => toggleEditMode(id, false));
      populateUI(planData);
      initCharts(planData);
    });
  }

  const regenBtn = document.getElementById('regeneratePlan');
  if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
      await fetch(apiEndpoints.updateStatus, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan_status: 'pending' })
      });
      alert('Заявката за нов план е изпратена.');
    });
  }

  const aiSummaryBtn = document.getElementById('aiSummary');
  if (aiSummaryBtn) {
    aiSummaryBtn.addEventListener('click', async () => {
      const resp = await fetch(apiEndpoints.aiHelper, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await resp.json().catch(() => ({}));
      const summary = data.aiResponse?.result || data.aiResponse;
      alert(summary || 'Няма данни');
    });
  }

  const exportPlanBtn = document.getElementById('exportPlan');
  if (exportPlanBtn) {
    exportPlanBtn.addEventListener('click', () => {
      if (!planData) return;
      const blob = new Blob([JSON.stringify(planData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userId || 'plan'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const exportDataBtn = document.getElementById('exportData');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      if (!dashboardData) return;
      const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userId || 'data'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const exportCsvBtn = document.getElementById('exportCsv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (!dashboardData) return;
      const logs = dashboardData.dailyLogs || [];
      let csv = 'Дата,Тегло,Бележка\n';
      logs.forEach(l => {
        const note = (l.data?.note || '').replace(/\n/g, ' ');
        csv += `${l.date},${l.data?.weight || ''},${note}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userId || 'logs'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const generatePraiseBtn = document.getElementById('generatePraise');
  if (generatePraiseBtn) {
    generatePraiseBtn.addEventListener('click', async () => {
      try {
        const resp = await fetch(apiEndpoints.generatePraise, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          const title = data.title || 'Похвала';
          const msg = data.message || '';
          alert(`${title}\n${msg}`.trim());
        } else {
          alert('Неуспешно генериране на похвала.');
        }
      } catch (err) {
        console.error('Error generating praise:', err);
        alert('Грешка при генериране на похвала.');
      }
    });
  }

  document.querySelectorAll('.save-section-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const card = e.target.closest('.card');
      collectPlanData();
      await savePlan();
      populateUI(planData);
      toggleEditMode(card.id, false);
      if (card.id === 'caloriesMacros-card') initCharts(planData);
    });
  });

  await loadData();
  setupMacroAutoCalc();
  populateUI(planData);
  initCharts(planData);
  updateGlobalButtonsVisibility();
}

export function initCharts(data) {
  if (macroChart) macroChart.destroy();
  if (weightChart) weightChart.destroy();
  const macroCtx = document.getElementById('macro-chart');
  if (macroCtx) {
    macroChart = new Chart(macroCtx, {
      type: 'doughnut',
      data: {
        labels: [`Протеини (${data.caloriesMacros.protein_percent}%)`, `Въглехидрати (${data.caloriesMacros.carbs_percent}%)`, `Мазнини (${data.caloriesMacros.fat_percent}%)`],
        datasets: [{
          label: 'Разпределение на макроси',
          data: [data.caloriesMacros.protein_grams, data.caloriesMacros.carbs_grams, data.caloriesMacros.fat_grams],
          backgroundColor: ['rgb(54,162,235)', 'rgb(255,205,86)', 'rgb(255,99,132)'],
          hoverOffset: 4
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: `Дневен прием (${data.caloriesMacros.calories} kcal)` } } }
    });
  }
  const weightCtx = document.getElementById('weight-chart');
  if (weightCtx) {
    const m = (data.profileSummary || '').match(/Текущо тегло (\d+\.?\d*) кг \(промяна за 7 дни: (-?\d+\.?\d*) кг\)/);
    const currentWeight = m ? parseFloat(m[1]) : 0;
    const weightChange = m ? parseFloat(m[2]) : 0;
    weightChart = new Chart(weightCtx, {
      type: 'line',
      data: {
        labels: ['Седмица -1', 'Седмица 0', 'Седмица 1', 'Седмица 2', 'Седмица 3', 'Седмица 4'],
        datasets: [{ label: 'Тегло (кг)', data: [currentWeight - weightChange, currentWeight, null, null, null, null], fill: false, borderColor: 'rgb(75,192,192)', tension: 0.1 }]
      },
      options: { scales: { y: { beginAtZero: false } } }
    });
  }
}

// Експортиране на вътрешни функции за тестване
export const __testExports = { initCharts, addEditableMealItem, calcMacroGrams, calcMacroPercent };
// Автоматична инициализация, когато файлът се зареди директно в браузъра
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if (userId) void initEditClient(userId);
  });
}
