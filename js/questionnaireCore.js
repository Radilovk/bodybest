import { setupRegistration } from './register.js';
import { showMessage, hideMessage } from './messageUtils.js';
import { updateStepProgress } from './stepProgress.js';
import { startPlanGeneration } from './planGeneration.js';

const state = {
  rawQuestions: [],
  flatPages: [],
  currentPageIndex: 0,
  totalPages: 0,
  registrationPageIndex: 0,
  responses: {},
  submitUrl: '',
  questionsUrl: '',
  submitted: false
};

const numericRanges = {
  age: { min: 10, max: 120 },
  height: { min: 100, max: 250 },
  weight: { min: 30, max: 300 },
  lossKg: { min: 1, max: 100 },
  activityDurationDaily: { min: 1, max: 300 },
  activityDurationWeekly: { min: 1, max: 300 },
  activityDurationRare: { min: 1, max: 300 }
};

const requiredFields = [
  'name','gender','age','height','weight','goal','lossKg','motivation','weightChange','weightChangeDetails',
  'dietHistory','dietType','dietResult','sleepHours','sleepInterrupt','chronotype','dailyActivityLevel','stressLevel',
  'physicalActivity','activityTypeDaily','activityDurationDaily','activityTypeWeekly','activityDurationWeekly','activityTypeRare',
  'activityDurationRare','regularActivityTypes','weeklyActivityFrequency','activityDuration','waterIntake','waterReplaceFreq','waterReplacementRare',
  'waterReplacementSometimes','waterReplacementOften','overeatingFrequency','foodCravings','foodCravingsDetails','foodTriggers',
  'foodTriggersOther','nighteat','eatingHabitsOther','compensationmethod','compensationMethodOther','comparisson','eatingOutFrequency',
  'eatingOutType','alcoholFrequency','foodPreference','foodPreferenceOther','foodPreferenceDisliked','mainChallenge','additionalComments',
  'medicalConditions','medicalConditionsOther','medications','medicationsList','supplementsList'
];

function flattenQuestions(questions) {
  let output = [];
  questions.forEach(q => {
    const qCopy = { ...q };
    delete qCopy.children;
    if (qCopy.type !== 'section') output.push(qCopy);
    if (Array.isArray(q.children)) {
      output = output.concat(flattenQuestions(q.children));
    } else if (q.children && typeof q.children === 'object') {
      for (const answer in q.children) {
        const childArray = q.children[answer];
        if (Array.isArray(childArray)) {
          childArray.forEach(child => {
            child.dependency = { question: q.id, value: answer };
          });
          output = output.concat(flattenQuestions(childArray));
        }
      }
    }
  });
  return output;
}

export function buildDynamicPages() {
  const container = document.getElementById('dynamicContainer');
  const instr = document.getElementById('questInstructions');
  if (!container) {
    console.error('Container #dynamicContainer not found!');
    return;
  }
  container.innerHTML = '';
  createStartPage();
  state.flatPages = flattenQuestions(state.rawQuestions).filter(q => q.id !== 'email' && q.type !== 'section');
  state.flatPages.forEach((q, idx) => createQuestionPage(q, idx + 1));
  createRegistrationPage();
  createFinalPage();
  setupFinalPageListener();
  if (instr) container.appendChild(instr);
  state.totalPages = 1 + state.flatPages.length + 2;
  updateStepProgress(
    document.getElementById('questProgressBar'),
    0,
    state.totalPages > 1 ? state.totalPages - 1 : 1,
    document.getElementById('questCurrentStep'),
    document.getElementById('questTotalSteps')
  );
  showPage(0);
}

function createStartPage() {
  const container = document.getElementById('dynamicContainer');
  if (!container) return;
  const pageDiv = document.createElement('div');
  pageDiv.className = 'page hero-start-page';
  pageDiv.id = 'page0';
  pageDiv.innerHTML = `
    <div class="hero-content">
      <img class="hero-image" id="heroImage" src="https://radilovk.github.io/bodybest/img/myquest.png" alt="Hero">
      <p class="hero-subtitle">
        Разкажи ни повече за теб и твоите цели.<br>
        Ние ще ти помогнем да ги постигнеш!
      </p>
      <div class="cta-container">
        <button id="startBtn" type="button">Начало</button>
      </div>
      <div class="stats-bar">
        <div class="stat-item">
          <img class="stat-icon" src="https://radilovk.github.io/bodybest/img/aibrain.png" alt="AI Algorithm">
          <div class="stat-label">AI Med Алгоритъм</div>
        </div>
        <div class="stat-item">
          <img class="stat-icon" src="https://radilovk.github.io/bodybest/img/medic.png" alt="Medical Experts">
          <div class="stat-label">Реални специалисти</div>
        </div>
        <div class="stat-item">
          <img class="stat-icon" src="https://radilovk.github.io/bodybest/img/clock.png" alt="24/7 Assistant">
          <div class="stat-label">24/7 Личен асистент</div>
        </div>
      </div>
    </div>`;
  container.appendChild(pageDiv);
  const startBtn = pageDiv.querySelector('#startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      pageDiv.classList.remove('hero-start-page');
      showPage(1);
    });
  }
}

function createQuestionPage(question, pageIndex) {
  const container = document.getElementById('dynamicContainer');
  if (!container || !question || !question.id) {
    console.error('Missing container or question data for page', pageIndex);
    return;
  }
  const pageDiv = document.createElement('div');
  pageDiv.className = 'page';
  pageDiv.id = 'page' + pageIndex;
  let html = '';
  if (question.type === 'section') {
    html += `<div class="section-title">${question.sectionTitle || question.text || ''}</div>`;
  } else {
    html += `<div class="question-text">${question.text || 'Липсва текст на въпроса'}</div>`;
  }
  const isRequired = requiredFields.includes(question.id);
  if (question.type === 'section') {
    // no input for section
  } else if (['text','number','email'].includes(question.type)) {
    const range = numericRanges[question.id];
    const rangeAttrs = (question.type === 'number' && range) ? `min="${range.min}" max="${range.max}"` : '';
    
    // Add helpful placeholders based on question ID
    let placeholder = '';
    if (question.id === 'name') placeholder = 'напр. Иван Петров';
    else if (question.id === 'age') placeholder = 'напр. 35';
    else if (question.id === 'height') placeholder = 'напр. 175';
    else if (question.id === 'weight') placeholder = 'напр. 70';
    else if (question.id === 'lossKg') placeholder = 'напр. 5';
    else if (question.id === 'email') placeholder = 'вашият@email.com';
    else if (question.type === 'number' && range) placeholder = `${range.min}-${range.max}`;
    
    html += `<input id="${question.id}" type="${question.type}" placeholder="${placeholder}" ${rangeAttrs} ${isRequired ? 'required' : ''} ${question.type === 'email' ? 'autocomplete="email"' : ''}>`;
  } else if (question.type === 'textarea') {
    const placeholder = question.id === 'mainChallenge' ? 'Опишете вашето най-голямо предизвикателство...' : 'Въведете вашия отговор...';
    html += `<textarea id="${question.id}" rows="4" placeholder="${placeholder}" ${isRequired ? 'required' : ''}></textarea>`;
  } else if (question.type === 'select') {
    html += `<select id="${question.id}" ${isRequired ? 'required' : ''}><option value="">Изберете</option>`;
    (question.options || []).forEach(opt => {
      html += `<option value="${String(opt)}">${String(opt)}</option>`;
    });
    html += `</select>`;
  } else if (question.type === 'radio') {
    (question.options || []).forEach((opt, index) => {
      const optionValue = String(opt);
      html += `<label class="answer-label"><input name="${question.id}" type="radio" value="${optionValue}" ${isRequired && index === 0 ? 'required' : ''}> ${optionValue}</label>`;
    });
  } else if (question.type === 'checkbox') {
    (question.options || []).forEach(opt => {
      const optionValue = String(opt);
      html += `<label class="answer-label"><input name="${question.id}" type="checkbox" value="${optionValue}"> ${optionValue}</label>`;
    });
  } else if (question.type !== 'section') {
    console.warn(`Unsupported question type: ${question.type} for question ID: ${question.id}`);
    html += `<p style="color: red;">Грешка: Неподдържан тип въпрос.</p>`;
  }
  if (question.dependency) {
    // developer note hidden from user
  }
  html += `<div class="nav-buttons">${pageIndex > 1 ? `<button type="button" id="prevBtn${pageIndex}">◀ Назад</button>` : ''}<button type="button" id="nextBtn${pageIndex}">Напред ▶</button></div>`;
  pageDiv.innerHTML = html;
  container.appendChild(pageDiv);
  const nextBtn = pageDiv.querySelector(`#nextBtn${pageIndex}`);
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (question.type !== 'section' && !validateAnswer(question)) return;
      if (question.type !== 'section') saveAnswer(question);
      showPage(pageIndex + 1);
    });
  }
  const prevBtn = pageDiv.querySelector(`#prevBtn${pageIndex}`);
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (question.type !== 'section') saveAnswer(question);
      showPage(pageIndex - 1);
    });
  }
}

function createRegistrationPage() {
  const container = document.getElementById('dynamicContainer');
  if (!container) return;
  const regIndex = state.flatPages.length + 1;
  state.registrationPageIndex = regIndex;
  const pageDiv = document.createElement('div');
  pageDiv.className = 'page';
  pageDiv.id = 'page' + regIndex;
  pageDiv.innerHTML = `
    <h2>Регистрация</h2>
    <form id="register-form-q" novalidate>
      <div class="form-group"><label for="register-email-q">Имейл:</label><input type="email" id="register-email-q" required autocomplete="email"></div>
      <div class="form-group"><label for="register-password-q">Парола (мин. 8 знака):</label><input type="password" id="register-password-q" required minlength="8"></div>
      <div class="form-group"><label for="confirm-password-q">Потвърди Парола:</label><input type="password" id="confirm-password-q" required minlength="8"></div>
      <div id="register-message-q" class="message" role="alert"></div>
      <div class="nav-buttons"><button type="button" id="regBackBtn">◀ Назад</button><button type="submit" id="regSubmitBtn">Регистрация</button></div>
    </form>`;
  container.appendChild(pageDiv);
  const emailInput = pageDiv.querySelector('#register-email-q');
  if (emailInput && state.responses.email) emailInput.value = state.responses.email;
  pageDiv.querySelector('#regBackBtn').addEventListener('click', () => showPage(regIndex - 1));
  setupRegistration('#register-form-q', '#register-message-q');
  pageDiv.querySelector('#register-form-q').addEventListener('registrationSuccess', (event) => {
    state.responses.email = event.detail.email;
    saveProgress();
    showPage(regIndex + 1);
  });
}

function createFinalPage() {
  const container = document.getElementById('dynamicContainer');
  if (!container) return;
  const finalIndex = state.flatPages.length + 2;
  const pageDiv = document.createElement('div');
  pageDiv.className = 'page';
  pageDiv.id = 'page' + finalIndex;
  pageDiv.innerHTML = `
    <h2>Поздравления! <i class="bi bi-stars"></i><br> Току що направихте най-важната стъпка по пътя към промяната</h2>
    <p>Благодарим ви, че отделихте време да попълните въпросника.</p>
    <div class="nav-buttons">
      <button type="button" id="finalBackBtn">◀ Назад</button>
    </div>
    <div id="submit-message" class="message" role="alert"></div>
    <div id="login-guidance" style="display: none; margin-top: 2rem; text-align: center;">
      <p style="font-size: 1.1rem; margin-bottom: 1rem;">Вашият план се генерира в момента.</p>
      <button type="button" id="goToDashboardBtn" style="padding: 15px 40px; font-size: 1.1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 50px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
        Влез в системата →
      </button>
    </div>`;
  container.appendChild(pageDiv);
}

function setupFinalPageListener() {
  const finalIndex = state.flatPages.length + 2;
  const pageDiv = document.getElementById('page' + finalIndex);
  if (!pageDiv) return;
  const backBtn = pageDiv.querySelector('#finalBackBtn');
  const submitMessage = pageDiv.querySelector('#submit-message');
  if (backBtn) backBtn.addEventListener('click', () => showPage(finalIndex - 1));
  if (submitMessage) hideMessage(submitMessage);
}

export function showPage(index) {
  const pages = document.querySelectorAll('.page');
  if (!pages || pages.length === 0) {
    console.error('Не са намерени страници за показване.');
    return;
  }
  if (index > state.currentPageIndex) {
    let targetIndex = index;
    while (targetIndex < pages.length - 1) {
      const question = state.flatPages[targetIndex - 1];
      if (question && question.dependency) {
        const parentAnswer = state.responses[question.dependency.question];
        const dependencyValue = question.dependency.value;
        const shouldShow = Array.isArray(parentAnswer) ? parentAnswer.includes(dependencyValue) : parentAnswer === dependencyValue;
        if (!shouldShow) { targetIndex++; continue; }
      }
      break;
    }
    index = targetIndex;
  } else if (index < state.currentPageIndex) {
    let targetIndex = index;
    while (targetIndex > 0) {
      const question = state.flatPages[targetIndex - 1];
      if (question && question.dependency) {
        const parentAnswer = state.responses[question.dependency.question];
        const dependencyValue = question.dependency.value;
        const shouldShow = Array.isArray(parentAnswer) ? parentAnswer.includes(dependencyValue) : parentAnswer === dependencyValue;
        if (!shouldShow) { targetIndex--; continue; }
      }
      break;
    }
    index = targetIndex;
  }
  if (index < 0) index = 0;
  if (index >= pages.length) index = pages.length - 1;
  if (state.currentPageIndex > 0 && state.currentPageIndex < pages.length - 1) {
    const previousQuestion = state.flatPages[state.currentPageIndex - 1];
    if (previousQuestion) saveAnswer(previousQuestion);
  }
  state.currentPageIndex = index;
  pages.forEach((pg, idx) => { pg.classList.toggle('active', idx === state.currentPageIndex); });
  const activePage = pages[state.currentPageIndex];
  if (activePage) {
    const firstInput = activePage.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => { try { firstInput.focus(); } catch (e) { } }, 50);
  }
  updateProgress();
  const instr = document.getElementById('questInstructions');
  const stats = document.getElementById('persistentStats');
  if (instr && stats) {
    if (state.currentPageIndex === 0) {
      instr.style.display = 'none';
      stats.style.display = 'none';
    } else {
      instr.style.display = 'block';
      stats.style.display = 'flex';
    }
  }
  if (state.currentPageIndex === pages.length - 1 && !state.submitted) {
    const submitMessage = document.getElementById('submit-message');
    if (submitMessage) hideMessage(submitMessage);
    state.submitted = true;
    submitResponses()
      .then(result => {
        if (submitMessage) {
          showMessage(
            submitMessage,
            result.message || 'Отговорите са изпратени успешно за обработка!',
            false
          );
        }
        // Handle successful submission with automatic login setup
        handleSuccessfulSubmission(result);
      })
      .catch(error => {
        state.submitted = false;
        console.error('Auto submit error:', error);
        if (submitMessage) {
          showMessage(
            submitMessage,
            `Грешка: ${error.message || 'Неуспешно изпращане.'}`,
            true
          );
        }
      });
  }
}

function handleSuccessfulSubmission(result) {
  // Store userId and email for automatic login
  if (result.userId) {
    sessionStorage.setItem('userId', result.userId);
    const userEmail = state.responses.email || '';
    if (userEmail) {
      sessionStorage.setItem('userEmail', userEmail);
    }
    sessionStorage.setItem('planStatus', 'pending');
    
    // Show login guidance button
    const loginGuidance = document.getElementById('login-guidance');
    if (loginGuidance) {
      loginGuidance.style.display = 'block';
      const dashboardBtn = document.getElementById('goToDashboardBtn');
      if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
          window.location.href = 'code.html';
        });
      }
    }
  }
}

function updateProgress() {
  const progressBar = document.getElementById('questProgressBar');
  const currentLabel = document.getElementById('questCurrentStep');
  const totalLabel = document.getElementById('questTotalSteps');
  if (!progressBar || state.totalPages <= 1) return;
  const currentStep = state.currentPageIndex;
  const totalSteps = state.totalPages > 1 ? state.totalPages - 1 : 1;
  updateStepProgress(progressBar, currentStep, totalSteps, currentLabel, totalLabel);
}

function saveProgress() {
  try {
    localStorage.setItem('questResponses', JSON.stringify(state.responses));
    localStorage.setItem('questCurrentPage', String(state.currentPageIndex));
  } catch (e) { console.warn('Неуспешно записване в localStorage:', e); }
}

function loadProgress() {
  try {
    const savedResponses = localStorage.getItem('questResponses');
    const savedPage = localStorage.getItem('questCurrentPage');
    if (savedResponses) Object.assign(state.responses, JSON.parse(savedResponses));
    if (savedPage !== null) {
      const idx = parseInt(savedPage, 10);
      if (!Number.isNaN(idx)) state.currentPageIndex = idx;
    }
  } catch (e) { console.warn('Неуспешно зареждане от localStorage:', e); }
}

function applySavedResponses() {
  for (const [qId, answer] of Object.entries(state.responses)) {
    const question = state.flatPages.find(q => q.id === qId);
    if (!question) continue;
    const el = document.getElementById(qId);
    if (['text', 'number', 'email', 'textarea', 'select'].includes(question.type)) {
      if (el) el.value = answer;
    } else if (question.type === 'radio') {
      const radio = document.querySelector(`input[name="${qId}"][value="${answer}"]`);
      if (radio) radio.checked = true;
    } else if (question.type === 'checkbox' && Array.isArray(answer)) {
      answer.forEach(val => {
        const chk = document.querySelector(`input[name="${qId}"][value="${val}"]`);
        if (chk) chk.checked = true;
      });
    }
  }
}

function clearProgress() {
  localStorage.removeItem('questResponses');
  localStorage.removeItem('questCurrentPage');
  for (const key in state.responses) delete state.responses[key];
  state.currentPageIndex = 0;
}

export function saveAnswer(question) {
  if (!question || !question.id) return;
  const qId = question.id;
  let answer;
  const element = document.getElementById(qId);
  if (['text', 'number', 'email', 'textarea'].includes(question.type)) {
    if (element) answer = element.value.trim();
  } else if (question.type === 'select') {
    if (element) answer = element.value;
  } else if (question.type === 'radio') {
    const checkedRadio = document.querySelector(`input[name="${qId}"]:checked`);
    answer = checkedRadio ? checkedRadio.value : null;
  } else if (question.type === 'checkbox') {
    const checked = document.querySelectorAll(`input[name="${qId}"]:checked`);
    answer = Array.from(checked).map(ch => ch.value);
  }
  if (answer !== undefined) {
    state.responses[qId] = answer;
    saveProgress();
  } else {
    console.warn(`Не е намерен контрол за въпрос с ID: ${qId}`);
  }
}

export function validateAnswer(question) {
  if (!question || !question.id) return true;
  const qId = question.id;
  let isValid = true;
  let errorMessage = '';
  const element = document.getElementById(qId);
  const isRequired = requiredFields.includes(qId);
  let value = '';
  if (['text', 'number', 'email', 'textarea'].includes(question.type)) {
    if (element) value = element.value.trim();
    if (isRequired && !value) { isValid = false; errorMessage = 'Моля, попълнете това поле.'; }
    else if (question.type === 'number') {
      const num = Number(value);
      if (value && Number.isNaN(num)) { isValid = false; errorMessage = 'Моля, въведете число.'; }
      else {
        const range = numericRanges[qId];
        if (range && (num < range.min || num > range.max)) {
          isValid = false; errorMessage = `Стойността трябва да е между ${range.min} и ${range.max}.`;
        }
      }
    }
  } else if (question.type === 'select') {
    if (element) value = element.value;
    if (isRequired && !value) { isValid = false; errorMessage = 'Моля, направете избор.'; }
  } else if (question.type === 'radio') {
    if (isRequired && !document.querySelector(`input[name="${qId}"]:checked`)) {
      isValid = false; errorMessage = 'Моля, изберете една от опциите.';
    }
  } else if (question.type === 'checkbox') {
    if (isRequired && document.querySelectorAll(`input[name="${qId}"]:checked`).length === 0) {
      isValid = false; errorMessage = 'Моля, изберете поне една опция.';
    }
  }
  const errorElementId = `error-${qId}`;
  let errorElement = document.getElementById(errorElementId);
  const pageElement = document.getElementById('page' + (state.flatPages.findIndex(p => p.id === qId) + 1));
  if (!isValid) {
    if (!errorElement && pageElement) {
      errorElement = document.createElement('div');
      errorElement.id = errorElementId;
      errorElement.className = 'validation-error';
      errorElement.style.color = '#e74c3c';
      errorElement.style.fontSize = '0.9em';
      errorElement.style.marginTop = '5px';
      errorElement.setAttribute('role', 'alert');
      const navButtons = pageElement.querySelector('.nav-buttons');
      if (navButtons) pageElement.insertBefore(errorElement, navButtons); else pageElement.appendChild(errorElement);
    }
    if (errorElement) errorElement.textContent = errorMessage;
  } else if (errorElement) {
    errorElement.remove();
  }
  return isValid;
}

export async function submitResponses() {
  state.responses.submissionDate = new Date().toISOString();
  const userEmail = String(state.responses.email || (document.getElementById('register-email-q') ? document.getElementById('register-email-q').value : '')).trim().toLowerCase();
  state.responses.email = userEmail;
  try {
    const workerResponse = await fetch(state.submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.responses)
    });
    const responseData = await workerResponse.json();
    if (!workerResponse.ok) throw new Error(responseData.message || `Worker отговори със статус ${workerResponse.status}`);
    delete state.responses.submissionDate;
    return responseData;
  } catch (error) {
    delete state.responses.submissionDate;
    throw new Error(`Грешка при комуникация със сървъра: ${error.message}`);
  }
}

export function getResponses() {
  return state.responses;
}

export function regeneratePlan({ userId }) {
  return startPlanGeneration({ userId });
}

export async function initQuestionnaire({ questionsUrl, submitUrl }) {
  state.questionsUrl = questionsUrl;
  state.submitUrl = submitUrl;
  const secretArea = document.getElementById('secretTapArea');
  const adminLink = document.getElementById('adminLink');
  if (secretArea && adminLink) {
    secretArea.addEventListener('click', () => {
      adminLink.style.display = 'block';
      setTimeout(() => { adminLink.style.display = 'none'; }, 10000);
    });
  }
  const res = await fetch(questionsUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} при зареждане на ${questionsUrl}`);
  const contentType = res.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) throw new TypeError(`Очакван JSON, но получен ${contentType}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${questionsUrl} е празен или невалиден масив.`);
  state.rawQuestions = data;
  buildDynamicPages();
  loadProgress();
  applySavedResponses();
  showPage(state.currentPageIndex);
}

