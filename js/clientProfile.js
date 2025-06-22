import { apiEndpoints } from './config.js';
import { labelMap } from './labelMap.js';
import { initPlanEditor, gatherPlanFormData } from './planEditor.js';

function $(id) {
  return document.getElementById(id);
}

function setText(id, value, suffix = '') {
  const el = $(id);
  if (!el) return;
  const val = value !== undefined && value !== null && value !== '' ? value : '--';
  el.textContent = suffix && val !== '--' ? `${val}${suffix}` : val;
}

function createInfoItem(label, value) {
  const div = document.createElement('div');
  div.className = 'info-item';
  const l = document.createElement('div');
  l.className = 'info-label';
  l.textContent = label;
  const v = document.createElement('div');
  v.className = 'info-value';
  v.textContent =
    value !== undefined && value !== null && value !== '' ? value : '--';
  div.appendChild(l);
  div.appendChild(v);
  return div;
}

function getUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('userId');
}

async function loadData() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const [profileRes, dashRes] = await Promise.all([
      fetch(`${apiEndpoints.getProfile}?userId=${userId}`),
      fetch(`${apiEndpoints.dashboard}?userId=${userId}`)
    ]);
    const profileData = await profileRes.json();
    const dashData = await dashRes.json();
    if (profileRes.ok && profileData.success) {
      fillProfile(profileData, dashData.initialAnswers);
    }
    if (dashRes.ok && dashData.success) {
      fillDashboard(dashData);
      fillAdminNotes(dashData.currentStatus);
    }
  } catch (err) {
    console.error('Load error', err);
  }
}

function fillProfile(data, initialAnswers = {}) {
  const getVal = key => {
    const v = data?.[key];
    return v !== undefined && v !== null && v !== '' ? v : initialAnswers?.[key];
  };

  setText('userName', getVal('name'));
  setText('userGoalHeader', getVal('mainGoal'));
  setText('userHeightHeader', getVal('height'), ' см');

  const demographics = {
    fullname: getVal('fullname'),
    gender: getVal('gender'),
    age: getVal('age'),
    phone: getVal('phone'),
    email: getVal('email')
  };
  const heightVal = getVal('height');
  const physical = {
    height: heightVal ? `${heightVal} см` : undefined
  };
  const goals = {
    mainGoal: getVal('mainGoal'),
    motivationLevel: getVal('motivationLevel'),
    targetBmi: getVal('targetBmi')
  };
  const sleep = {
    sleepHours: getVal('sleepHours'),
    sleepInterruptions: getVal('sleepInterruptions'),
    chronotype: getVal('chronotype'),
    activityLevel: getVal('activityLevel'),
    physicalActivity: getVal('physicalActivity')
  };
  const mc = getVal('medicalConditions');
  const health = {
    medicalConditions: Array.isArray(mc) ? mc.join(', ') : mc,
    stressLevel: getVal('stressLevel'),
    medications: getVal('medications'),
    waterIntake: getVal('waterIntake')
  };
  const food = {
    foodPreferences: getVal('foodPreferences'),
    overeatingFrequency: getVal('overeatingFrequency'),
    foodCravings: getVal('foodCravings'),
    foodTriggers: getVal('foodTriggers'),
    alcoholFrequency: getVal('alcoholFrequency'),
    eatingHabits: getVal('eatingHabits')
  };
  const sections = {
    demographics: demographics,
    physical: physical,
    goals: goals,
    sleep: sleep,
    health: health,
    food: food
  };
  Object.entries(sections).forEach(([key, obj]) => {
    const el = $(`${key}Info`);
    if (!el) return;
    el.innerHTML = '';
    Object.entries(obj).forEach(([k, v]) => {
      el.appendChild(createInfoItem(labelMap[k] || k, v));
    });
  });

  // Populate edit fields if present
  if ($('nameInput')) $('nameInput').value = getVal('name') || '';
  if ($('fullnameInput')) $('fullnameInput').value = getVal('fullname') || '';
  if ($('ageInput')) $('ageInput').value = getVal('age') ?? '';
  if ($('phoneInput')) $('phoneInput').value = getVal('phone') || '';
  if ($('emailInput')) $('emailInput').value = getVal('email') || '';
  if ($('heightInput')) $('heightInput').value = getVal('height') ?? '';
}

function fillDashboard(data) {
  const curW = data.currentStatus?.weight;
  setText('currentWeightHeader', curW, ' кг');
  setText('planStatus', data.planStatus);
  setText('planStatusBadge', data.planStatus);
  const badge = $('planStatusBadge');
  if (badge) {
    badge.classList.remove('bg-success', 'bg-warning');
    badge.classList.add(data.planStatus === 'ready' ? 'bg-success' : 'bg-warning');
  }

  const macrosContainer = $('macroCards');
  if (macrosContainer) {
    macrosContainer.innerHTML = '';
    const macros = data.planData?.caloriesMacros || {};
    const list = [
      { l: 'Калории', v: macros.calories, s: 'kcal дневно' },
      { l: 'Протеини', v: macros.protein_grams, s: macros.protein_percent ? `${macros.protein_percent}% от калориите` : '' },
      { l: 'Въглехидрати', v: macros.carbs_grams, s: macros.carbs_percent ? `${macros.carbs_percent}% от калориите` : '' },
      { l: 'Мазнини', v: macros.fat_grams, s: macros.fat_percent ? `${macros.fat_percent}% от калориите` : '' }
    ];
    list.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-md-3 mb-3';
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `<div class="metric-title">${item.l}</div><div class="metric-value">${item.v ?? '--'}</div><div class="metric-subtitle">${item.s}</div>`;
      col.appendChild(card);
      macrosContainer.appendChild(col);
    });
  }

  $('planJson').value = JSON.stringify(data.planData || {}, null, 2);
  displayPlanMenu(data.planData?.week1Menu || {}, false);
  fillAllowedFoods(data.planData?.allowedForbiddenFoods);
  fillForbiddenFoods(data.planData?.allowedForbiddenFoods);
  fillPrinciples(data.planData);
  fillHydration(data.planData?.hydrationCookingSupplements?.hydration_recommendations);
  fillCookingMethods(data.planData?.hydrationCookingSupplements?.cooking_methods);
  initPlanEditor(data.planData || {});

  const logs = Array.isArray(data.dailyLogs) ? data.dailyLogs : [];
  const tbody = $('logsTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    logs.forEach(l => {
      const tr = document.createElement('tr');
      const mealsDone = l.data?.completedMealsStatus ? Object.values(l.data.completedMealsStatus).filter(Boolean).length : 0;
      tr.innerHTML = `
        <td>${l.date}</td>
        <td>${l.data?.weight ?? ''}</td>
        <td>${l.data?.mood ?? ''}</td>
        <td>${l.data?.energy ?? ''}</td>
        <td>${l.data?.calmness ?? ''}</td>
        <td>${l.data?.hydration ?? ''}</td>
        <td>${l.data?.sleep ?? ''}</td>
        <td>${mealsDone}</td>`;
      tbody.appendChild(tr);
    });
  }

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const weightVals = logs.map(l => parseFloat(l.data?.weight)).filter(v => !isNaN(v));
  const energyVals = logs.map(l => parseFloat(l.data?.energy)).filter(v => !isNaN(v));
  const sleepVals = logs.map(l => parseFloat(l.data?.sleep)).filter(v => !isNaN(v));
  const infoContainer = $('analyticsInfo');
  if (infoContainer) {
    infoContainer.innerHTML = '';
    const fields = {
      currentWeight: curW ? `${curW} кг` : undefined,
      bmiValue: data.currentStatus?.bmi,
      avgWeight: weightVals.length ? `${avg(weightVals).toFixed(1)} кг` : undefined,
      avgEnergy: energyVals.length ? avg(energyVals).toFixed(1) : undefined,
      avgSleep: sleepVals.length ? avg(sleepVals).toFixed(1) : undefined,
      weightPeriod: weightVals.length ? `от ${logs.length} дни` : undefined,
      currentStreak: `${data.analytics?.streak?.currentCount || 0} дни`
    };
    Object.entries(fields).forEach(([k, v]) => {
      infoContainer.appendChild(createInfoItem(labelMap[k] || k, v));
    });
  }

  const cur = data.analytics?.current || {};
  setText('goalProgress', `${cur.goalProgress || 0}%`);
  setText('engagementScore', `${cur.engagementScore || 0}%`);
  setText('healthScore', `${cur.overallHealthScore || 0}%`);
  if ($('goalProgressBar')) $('goalProgressBar').style.width = `${cur.goalProgress || 0}%`;
  if ($('engagementBar')) $('engagementBar').style.width = `${cur.engagementScore || 0}%`;
  if ($('healthBar')) $('healthBar').style.width = `${cur.overallHealthScore || 0}%`;

  const streak = data.analytics?.streak || { currentCount: 0, dailyStatusArray: [] };
  const streakCal = $('streakCalendar');
  if (streakCal) {
    streakCal.innerHTML = '';
    streak.dailyStatusArray.forEach(day => {
      const d = document.createElement('div');
      d.className = day.logged ? 'streak-day logged' : 'streak-day';
      streakCal.appendChild(d);
    });
  }
}

function renderValue(val) {
  if (Array.isArray(val)) {
    const ul = document.createElement('ul');
    val.forEach(item => {
      const li = document.createElement('li');
      li.appendChild(renderValue(item));
      ul.appendChild(li);
    });
    return ul;
  }
  if (val && typeof val === 'object') {
    return renderObjectAsList(val);
  }
  const span = document.createElement('span');
  span.textContent = val;
  return span;
}

function renderObjectAsList(obj) {
  const dl = document.createElement('dl');
  Object.entries(obj || {}).forEach(([key, val]) => {
    const dt = document.createElement('dt');
    dt.textContent = labelMap[key] || key;
    const dd = document.createElement('dd');
    dd.appendChild(renderValue(val));
    dl.appendChild(dt);
    dl.appendChild(dd);
  });
  return dl;
}

function capitalizeDay(day) {
  const days = {
    monday: 'Понеделник',
    tuesday: 'Вторник',
    wednesday: 'Сряда',
    thursday: 'Четвъртък',
    friday: 'Петък',
    saturday: 'Събота',
    sunday: 'Неделя'
  };
  return days[day] || day;
}

function displayPlanMenu(menu, isError = false) {
  const container = $('planMenu');
  if (!container) return;
  container.innerHTML = '';
  if (isError) {
    container.textContent = 'Грешка при зареждане';
    return;
  }
  if (!menu || Object.keys(menu).length === 0) {
    container.textContent = 'Няма меню';
    return;
  }
  const row = document.createElement('div');
  row.className = 'row';
  Object.entries(menu).forEach(([day, meals]) => {
    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4';
    const box = document.createElement('div');
    box.className = 'day-menu';
    const dayTitle = document.createElement('h5');
    dayTitle.className = 'meal-title';
    dayTitle.textContent = capitalizeDay(day);
    box.appendChild(dayTitle);
    (meals || []).forEach(meal => {
      const mealTitle = document.createElement('div');
      mealTitle.className = 'meal-title mt-3';
      let icon = 'fa-utensils';
      const name = (meal.meal_name || '').toLowerCase();
      if (name.includes('закуска')) icon = 'fa-sun';
      else if (name.includes('вечеря')) icon = 'fa-moon';
      mealTitle.innerHTML = `<i class="fas ${icon} me-2"></i>${meal.meal_name || ''}`;
      box.appendChild(mealTitle);
      (meal.items || []).forEach(i => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'meal-item';
        itemDiv.textContent = `${i.name}${i.grams ? ` - ${i.grams}` : ''}`;
        box.appendChild(itemDiv);
      });
    });
    col.appendChild(box);
    row.appendChild(col);
  });
  container.appendChild(row);
}

function fillAllowedFoods(aff) {
  const el = $('allowedFoodsContainer');
  if (!el) return;
  el.innerHTML = '';
  if (!aff) {
    el.textContent = 'Няма данни';
    return;
  }

  const createList = items => {
    const ul = document.createElement('ul');
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    return ul;
  };

  const frag = document.createDocumentFragment();
  const main = aff.main_allowed_foods;
  if (Array.isArray(main) && main.length > 0) {
    frag.appendChild(createList(main));
  } else if (main && typeof main === 'object') {
    Object.entries(main).forEach(([cat, foods]) => {
      if (Array.isArray(foods) && foods.length > 0) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = cat.replace(/_/g, ' ');
        p.appendChild(strong);
        frag.appendChild(p);
        frag.appendChild(createList(foods));
      }
    });
  }
  if (Array.isArray(aff.detailed_allowed_suggestions) && aff.detailed_allowed_suggestions.length > 0) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Допълнителни предложения:';
    p.appendChild(strong);
    frag.appendChild(p);
    frag.appendChild(createList(aff.detailed_allowed_suggestions));
  }

  if (frag.childNodes.length === 0) {
    el.textContent = 'Няма данни';
  } else {
    el.appendChild(frag);
  }
}

function fillForbiddenFoods(aff) {
  const el = $('forbiddenFoodsContainer');
  if (!el) return;
  el.innerHTML = '';
  if (!aff) {
    el.textContent = 'Няма данни';
    return;
  }

  const createList = items => {
    const ul = document.createElement('ul');
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    return ul;
  };

  const frag = document.createDocumentFragment();
  if (Array.isArray(aff.main_forbidden_foods) && aff.main_forbidden_foods.length > 0) {
    frag.appendChild(createList(aff.main_forbidden_foods));
  }
  if (Array.isArray(aff.detailed_limit_suggestions) && aff.detailed_limit_suggestions.length > 0) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'За ограничаване:';
    p.appendChild(strong);
    frag.appendChild(p);
    frag.appendChild(createList(aff.detailed_limit_suggestions));
  }
  if (Array.isArray(aff.dressing_flavoring_ideas) && aff.dressing_flavoring_ideas.length > 0) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Идеи за овкусяване:';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(` ${aff.dressing_flavoring_ideas.join(', ')}`));
    frag.appendChild(p);
  }

  if (frag.childNodes.length === 0) {
    el.textContent = 'Няма данни';
  } else {
    el.appendChild(frag);
  }
}

function fillPrinciples(plan) {
  const el = $('principlesSection');
  if (!el) return;
  el.innerHTML = '';
  let data = plan?.principlesWeek2_4;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    el.textContent = 'Няма данни';
    return;
  }
  if (typeof data === 'string') {
    data = data.split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(data)) data = [data];
  data.forEach(item => {
    const div = document.createElement('div');
    div.className = 'principle-item';
    if (typeof item === 'string') {
      div.textContent = item;
    } else if (item && typeof item === 'object') {
      const title = document.createElement('strong');
      title.textContent = item.title || '';
      const p = document.createElement('p');
      p.innerHTML = (item.content || '').replace(/\n/g, '<br>');
      div.appendChild(title);
      div.appendChild(document.createElement('br'));
      div.appendChild(p);
    }
    el.appendChild(div);
  });
}

function fillHydration(hydr) {
  const el = $('hydrationContainer');
  if (!el) return;
  el.innerHTML = '';
  if (!hydr) {
    el.textContent = 'Няма данни';
    return;
  }
  const parts = [];
  if (hydr.daily_liters) parts.push(`<p><strong>Дневно количество:</strong> ${hydr.daily_liters}</p>`);
  if (Array.isArray(hydr.tips) && hydr.tips.length > 0) parts.push('<ul>' + hydr.tips.map(t => `<li>${t}</li>`).join('') + '</ul>');
  if (Array.isArray(hydr.suitable_drinks) && hydr.suitable_drinks.length > 0) parts.push(`<p><strong>Подходящи:</strong> ${hydr.suitable_drinks.join(', ')}</p>`);
  if (Array.isArray(hydr.unsuitable_drinks) && hydr.unsuitable_drinks.length > 0) parts.push(`<p><strong>Неподходящи:</strong> ${hydr.unsuitable_drinks.join(', ')}</p>`);
  el.innerHTML = parts.join('') || 'Няма данни';
}

function fillCookingMethods(cook) {
  const el = $('cookingMethodsContainer');
  if (!el) return;
  el.innerHTML = '';
  if (!cook) {
    el.textContent = 'Няма данни';
    return;
  }
  const parts = [];
  if (Array.isArray(cook.recommended) && cook.recommended.length > 0) parts.push(`<p><strong>Препоръчителни:</strong> ${cook.recommended.join(', ')}</p>`);
  if (Array.isArray(cook.limit_or_avoid) && cook.limit_or_avoid.length > 0) parts.push(`<p><strong>Избягвайте:</strong> ${cook.limit_or_avoid.join(', ')}</p>`);
  if (cook.fat_usage_tip) parts.push(`<p><strong>Мазнина:</strong> ${cook.fat_usage_tip}</p>`);
  el.innerHTML = parts.join('') || 'Няма данни';
}

function fillAdminNotes(status) {
  if (!status) return;
  const notesEl = $('adminNotes');
  if (notesEl) notesEl.textContent = status.adminNotes || '--';
    const tagsEl = $('adminTags');
    if (tagsEl) {
      tagsEl.innerHTML = '';
      const uniqueTags = new Set(Array.isArray(status.adminTags) ? status.adminTags : []);
      if (uniqueTags.size === 0) {
        const li = document.createElement('li');
        li.textContent = '--';
        tagsEl.appendChild(li);
      } else {
        uniqueTags.forEach(t => {
          const li = document.createElement('li');
          li.textContent = t;
          tagsEl.appendChild(li);
        });
      }
    }
}


async function savePlan() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const json = gatherPlanFormData();
    const resp = await fetch(apiEndpoints.updatePlanData, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planData: json })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert('Планът е записан.');
      $('planJson').value = JSON.stringify(json, null, 2);
      setText('planStatus', 'ready');
      setText('planStatusBadge', 'ready');
      const badge = $('planStatusBadge');
      if (badge) {
        badge.classList.remove('bg-warning');
        badge.classList.add('bg-success');
      }
      displayPlanMenu(json.week1Menu || {}, false);
      fillAllowedFoods(json.allowedForbiddenFoods);
      fillForbiddenFoods(json.allowedForbiddenFoods);
      fillPrinciples(json);
    } else {
      alert(data.message || 'Грешка при запис.');
    }
  } catch (err) {
    alert('Грешка при запис.');
  }
}

async function saveProfile() {
  const userId = getUserId();
  if (!userId) return;
  const payload = {
    userId,
    name: $('nameInput').value.trim(),
    fullname: $('fullnameInput').value.trim(),
    age: Number($('ageInput').value) || null,
    phone: $('phoneInput').value.trim(),
    email: $('emailInput').value.trim(),
    height: Number($('heightInput').value) || null
  };
  const resp = await fetch(apiEndpoints.updateProfile, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (resp.ok && data.success) {
    alert('Профилът е записан.');
  } else {
    alert(data.message || 'Грешка при запис.');
  }
}

export function initClientProfile() {
  loadData();
  $('savePlanBtn').addEventListener('click', savePlan);
  $('saveProfileBtn').addEventListener('click', saveProfile);
}

export {
  fillAllowedFoods,
  fillForbiddenFoods,
  fillPrinciples,
  fillHydration,
  fillCookingMethods
};
