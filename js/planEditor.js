export function initPlanEditor(planData = {}) {
  const menuTable = document.getElementById('menuEditTable');
  const allowedInput = document.getElementById('allowedFoodsInput');
  const forbiddenInput = document.getElementById('forbiddenFoodsInput');
  const principlesInput = document.getElementById('principlesInput');

  if (menuTable) {
    menuTable.innerHTML = '';
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      const row = document.createElement('tr');
      const dayCell = document.createElement('th');
      dayCell.textContent = capitalizeDay(day);
      const cell = document.createElement('td');
      const ta = document.createElement('textarea');
      ta.className = 'form-control';
      ta.rows = 2;
      ta.dataset.day = day;
      ta.value = (planData.week1Menu?.[day] || []).map(m => m.meal_name).join('\n');
      cell.appendChild(ta);
      row.appendChild(dayCell);
      row.appendChild(cell);
      menuTable.appendChild(row);
    });
  }

  if (allowedInput) {
    const arr = planData.allowedForbiddenFoods?.main_allowed_foods;
    allowedInput.value = Array.isArray(arr) ? arr.join('\n') : '';
  }
  if (forbiddenInput) {
    const arr = planData.allowedForbiddenFoods?.main_forbidden_foods;
    forbiddenInput.value = Array.isArray(arr) ? arr.join('\n') : '';
  }
  if (principlesInput) {
    const pr = planData.principlesWeek2_4;
    if (Array.isArray(pr)) principlesInput.value = pr.join('\n');
    else if (typeof pr === 'string') principlesInput.value = pr;
  }
}

function parseList(text) {
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

export function gatherPlanFormData() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const week1Menu = {};
  days.forEach(day => {
    const ta = document.querySelector(`#menuEditTable textarea[data-day="${day}"]`);
    if (ta) {
      const meals = parseList(ta.value).map(name => ({ meal_name: name, items: [] }));
      week1Menu[day] = meals;
    }
  });

  const allowed = parseList(document.getElementById('allowedFoodsInput')?.value || '');
  const forbidden = parseList(document.getElementById('forbiddenFoodsInput')?.value || '');
  const principlesLines = parseList(document.getElementById('principlesInput')?.value || '');

  return {
    week1Menu,
    allowedForbiddenFoods: {
      main_allowed_foods: allowed,
      main_forbidden_foods: forbidden
    },
    principlesWeek2_4: principlesLines.join('\n')
  };
}

function capitalizeDay(day) {
  const map = {
    monday: 'Понеделник',
    tuesday: 'Вторник',
    wednesday: 'Сряда',
    thursday: 'Четвъртък',
    friday: 'Петък',
    saturday: 'Събота',
    sunday: 'Неделя'
  };
  return map[day] || day;
}
