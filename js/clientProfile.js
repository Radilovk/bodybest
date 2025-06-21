import { apiEndpoints } from './config.js';
import { jsonrepair } from 'https://cdn.jsdelivr.net/npm/jsonrepair/+esm';
import { labelMap } from './labelMap.js';

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
  v.textContent = value ?? '--';
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
    if (profileRes.ok && profileData.success) fillProfile(profileData);
    if (dashRes.ok && dashData.success) {
      fillDashboard(dashData);
      fillAdminNotes(dashData.currentStatus);
      fillInitialAnswers(dashData.initialAnswers);
    }
  } catch (err) {
    console.error('Load error', err);
  }
}

function fillProfile(data) {
  setText('userName', data.name);
  setText('userGoalHeader', data.mainGoal);
  setText('userHeightHeader', data.height, ' см');

  const demographics = {
    fullname: data.fullname,
    gender: data.gender,
    age: data.age,
    email: data.email
  };
  const physical = {
    height: data.height ? `${data.height} см` : undefined
  };
  const goals = {
    mainGoal: data.mainGoal,
    motivationLevel: data.motivationLevel,
    targetBmi: data.targetBmi
  };
  const sleep = {
    sleepHours: data.sleepHours,
    sleepInterruptions: data.sleepInterruptions,
    chronotype: data.chronotype,
    activityLevel: data.activityLevel,
    physicalActivity: data.physicalActivity
  };
  const health = {
    medicalConditions: Array.isArray(data.medicalConditions) ? data.medicalConditions.join(', ') : data.medicalConditions,
    stressLevel: data.stressLevel,
    medications: data.medications,
    waterIntake: data.waterIntake
  };
  const food = {
    foodPreferences: data.foodPreferences,
    overeatingFrequency: data.overeatingFrequency,
    foodCravings: data.foodCravings,
    foodTriggers: data.foodTriggers,
    alcoholFrequency: data.alcoholFrequency,
    eatingHabits: data.eatingHabits
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

function fillAdminNotes(status) {
  if (!status) return;
  const notesEl = $('adminNotes');
  if (notesEl) notesEl.textContent = status.adminNotes || '--';
  const tagsEl = $('adminTags');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    const tags = Array.isArray(status.adminTags) ? status.adminTags : [];
    if (tags.length === 0) {
      const li = document.createElement('li');
      li.textContent = '--';
      tagsEl.appendChild(li);
    } else {
      tags.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        tagsEl.appendChild(li);
      });
    }
  }
}

function fillInitialAnswers(ans) {
  const container = $('initialAnswersContainer');
  if (!container) return;
  container.innerHTML = '';
  if (!ans || Object.keys(ans).length === 0) {
    container.textContent = 'Няма данни';
    return;
  }
  container.appendChild(renderObjectAsList(ans));
}

async function savePlan() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const text = $('planJson').value;
    if (text.length > 20000) {
      alert('Планът е твърде голям (максимум 20 000 символа).');
      return;
    }
    const repaired = jsonrepair(text);
    const json = JSON.parse(repaired);
    const resp = await fetch(apiEndpoints.updatePlanData, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planData: json })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert('Планът е записан.');
      setText('planStatus', 'ready');
      setText('planStatusBadge', 'ready');
      const badge = $('planStatusBadge');
      if (badge) {
        badge.classList.remove('bg-warning');
        badge.classList.add('bg-success');
      }
    } else {
      alert(data.message || 'Грешка при запис.');
    }
  } catch (err) {
    alert('Невалиден JSON.');
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

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  $('savePlanBtn').addEventListener('click', savePlan);
  $('saveProfileBtn').addEventListener('click', saveProfile);
});
