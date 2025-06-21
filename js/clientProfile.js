import { apiEndpoints } from './config.js';

function $(id) {
  return document.getElementById(id);
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
  $('userName').textContent = data.name || '';
  $('userFullName').textContent = data.fullname || '';
  $('userGender').textContent = data.gender || '';
  if (typeof data.age !== 'undefined') $('userAge').textContent = data.age;
  $('userEmail').textContent = data.email || '';
  if (typeof data.height !== 'undefined') {
    $('userHeight').textContent = `${data.height} см`;
    $('heightValue').textContent = `${data.height} см`;
  }
  $('userGoal').textContent = data.mainGoal || '';
}

function fillDashboard(data) {
  const curW = data.currentStatus?.weight || '';
  $('currentWeight').textContent = curW ? `${curW} кг` : '-- кг';
  $('weightValue').textContent = curW ? `${curW} кг` : '--';
  const bmi = data.currentStatus?.bmi || '';
  $('bmiValue').textContent = bmi || '--';
  $('planJson').value = JSON.stringify(data.planData || {}, null, 2);
  const logs = data.dailyLogs || [];
  const list = logs.map(l => `${l.date}: ${l.data?.weight || ''} кг - ${l.data?.note || ''}`).join('\n');
  $('logsText').value = list;
}

async function savePlan() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const json = JSON.parse($('planJson').value);
    const resp = await fetch(apiEndpoints.updatePlanData, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planData: json })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      alert('Планът е записан.');
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
