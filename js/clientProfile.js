import { apiEndpoints } from './config.js';
import { jsonrepair } from 'jsonrepair';

function $(id) {
  return document.getElementById(id);
}

function setText(id, value, suffix = '') {
  const el = $(id);
  if (!el) return;
  const val = value !== undefined && value !== null && value !== '' ? value : '--';
  el.textContent = suffix && val !== '--' ? `${val}${suffix}` : val;
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
    if (dashRes.ok && dashData.success) fillDashboard(dashData);
  } catch (err) {
    console.error('Load error', err);
  }
}

function fillProfile(data) {
  setText('userName', data.name);
  setText('userFullName', data.fullname);
  setText('userGender', data.gender);
  if ('age' in data) setText('userAge', data.age);
  setText('userEmail', data.email);
  if ('height' in data) {
    setText('userHeight', data.height, ' см');
    setText('heightValue', data.height, ' см');
  }
  setText('userGoal', data.mainGoal);
  setText('mainGoal', data.mainGoal);
  setText('motivationLevel', data.motivationLevel);
  setText('targetBmi', data.targetBmi);
  setText('sleepHours', data.sleepHours);
  setText('sleepInterruptions', data.sleepInterruptions);
  setText('chronotype', data.chronotype);
  setText('activityLevel', data.activityLevel);
  setText('physicalActivity', data.physicalActivity);
  setText('medicalConditions', Array.isArray(data.medicalConditions) ? data.medicalConditions.join(', ') : data.medicalConditions);
  setText('stressLevel', data.stressLevel);
  setText('medications', data.medications);
  setText('waterIntake', data.waterIntake);
  setText('foodPreferences', data.foodPreferences);
  setText('overeatingFrequency', data.overeatingFrequency);
  setText('foodCravings', data.foodCravings);
  setText('foodTriggers', data.foodTriggers);
  setText('alcoholFrequency', data.alcoholFrequency);
  setText('eatingHabits', data.eatingHabits);
}

function fillDashboard(data) {
  const curW = data.currentStatus?.weight;
  setText('currentWeight', curW, ' кг');
  setText('weightValue', curW, ' кг');
  setText('bmiValue', data.currentStatus?.bmi);
  setText('planStatus', data.planStatus);

  const macros = data.planData?.caloriesMacros || {};
  setText('caloriesValue', macros.calories);
  setText('proteinValue', macros.protein_grams);
  setText('carbsValue', macros.carbs_grams);
  setText('fatValue', macros.fat_grams);
  if (macros.protein_percent) setText('proteinPercent', `${macros.protein_percent}%`);
  if (macros.carbs_percent) setText('carbsPercent', `${macros.carbs_percent}%`);
  if (macros.fat_percent) setText('fatPercent', `${macros.fat_percent}%`);

  $('planJson').value = JSON.stringify(data.planData || {}, null, 2);

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
  setText('avgWeight', weightVals.length ? avg(weightVals).toFixed(1) + ' кг' : null);
  setText('avgEnergy', energyVals.length ? avg(energyVals).toFixed(1) : null);
  setText('avgSleep', sleepVals.length ? avg(sleepVals).toFixed(1) : null);
  setText('weightPeriod', weightVals.length ? `от ${logs.length} дни` : '--');

  const cur = data.analytics?.current || {};
  setText('goalProgress', `${cur.goalProgress || 0}%`);
  setText('engagementScore', `${cur.engagementScore || 0}%`);
  setText('healthScore', `${cur.overallHealthScore || 0}%`);
  if ($('goalProgressBar')) $('goalProgressBar').style.width = `${cur.goalProgress || 0}%`;
  if ($('engagementBar')) $('engagementBar').style.width = `${cur.engagementScore || 0}%`;
  if ($('healthBar')) $('healthBar').style.width = `${cur.overallHealthScore || 0}%`;

  const streak = data.analytics?.streak || { currentCount: 0, dailyStatusArray: [] };
  setText('currentStreak', `${streak.currentCount} дни`);
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
