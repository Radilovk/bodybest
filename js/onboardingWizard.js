// onboardingWizard.js - Onboarding wizard за нови потребители
// Показва welcome wizard при първо посещение

/**
 * Onboarding Wizard
 * Multi-step wizard за първоначална настройка
 */
export class OnboardingWizard {
  constructor(options = {}) {
    this.onComplete = options.onComplete || (() => {});
    this.storageKey = 'bodybest_onboarding_complete';
    this.currentStep = 0;
    
    this.steps = [
      {
        id: 'welcome',
        title: 'Добре дошли в BodyBest!',
        content: this.renderWelcomeStep()
      },
      {
        id: 'theme',
        title: 'Изберете тема',
        content: this.renderThemeStep()
      },
      {
        id: 'goal',
        title: 'Изберете вашата цел',
        content: this.renderGoalStep()
      },
      {
        id: 'offline',
        title: 'Offline-first функционалност',
        content: this.renderOfflineStep()
      },
      {
        id: 'complete',
        title: 'Готови сте!',
        content: this.renderCompleteStep()
      }
    ];
    
    this.selectedTheme = null;
    this.selectedGoal = null;
    
    this.overlay = null;
    this.modal = null;
  }

  /**
   * Проверява дали onboarding е завършен
   * @returns {boolean}
   */
  static isComplete() {
    try {
      return localStorage.getItem('bodybest_onboarding_complete') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Маркира onboarding като завършен
   */
  static markComplete() {
    try {
      localStorage.setItem('bodybest_onboarding_complete', 'true');
    } catch (error) {
      console.warn('Could not mark onboarding as complete:', error);
    }
  }

  /**
   * Ресетва onboarding (за testing)
   */
  static reset() {
    try {
      localStorage.removeItem('bodybest_onboarding_complete');
    } catch (error) {
      console.warn('Could not reset onboarding:', error);
    }
  }

  /**
   * Показва wizard-а
   */
  show() {
    if (OnboardingWizard.isComplete()) {
      console.log('Onboarding already complete, skipping');
      return;
    }

    this.createModal();
    this.renderCurrentStep();
  }

  /**
   * Създава modal структурата
   */
  createModal() {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    
    // Modal
    this.modal = document.createElement('div');
    this.modal.className = 'onboarding-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-labelledby', 'onboarding-title');
    
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
    
    // Fade in
    setTimeout(() => {
      this.overlay.classList.add('show');
    }, 10);
  }

  /**
   * Рендва текущата стъпка
   */
  renderCurrentStep() {
    const step = this.steps[this.currentStep];
    
    this.modal.innerHTML = `
      <div class="onboarding-header">
        <h2 id="onboarding-title">${step.title}</h2>
        <div class="onboarding-progress">
          ${this.renderProgressIndicator()}
        </div>
      </div>
      
      <div class="onboarding-body">
        ${step.content}
      </div>
      
      <div class="onboarding-footer">
        ${this.currentStep > 0 ? '<button class="btn btn-secondary" id="onboarding-prev">Назад</button>' : ''}
        <button class="btn btn-primary" id="onboarding-next">
          ${this.currentStep === this.steps.length - 1 ? 'Завърши' : 'Напред'}
        </button>
      </div>
    `;
    
    this.attachEventListeners();
  }

  /**
   * Рендва progress indicator
   * @returns {string}
   */
  renderProgressIndicator() {
    return this.steps.map((step, index) => `
      <span class="progress-dot ${index === this.currentStep ? 'active' : ''} ${index < this.currentStep ? 'completed' : ''}" 
            aria-label="Стъпка ${index + 1}"></span>
    `).join('');
  }

  /**
   * Рендва welcome стъпка
   * @returns {string}
   */
  renderWelcomeStep() {
    return `
      <div class="onboarding-welcome">
        <div class="welcome-icon">
          <i class="bi bi-emoji-smile" style="font-size: 4rem; color: var(--primary-color);"></i>
        </div>
        <p class="welcome-text">
          Благодарим ви, че избрахте BodyBest! Ще ви отнеме само минутка 
          да настроите приложението според вашите предпочитания.
        </p>
        <p class="welcome-subtext">
          Нека започнем с няколко бързи въпроса.
        </p>
      </div>
    `;
  }

  /**
   * Рендва theme selection стъпка
   * @returns {string}
   */
  renderThemeStep() {
    return `
      <div class="onboarding-theme-selection">
        <p class="step-description">Изберете визуална тема за интерфейса:</p>
        <div class="theme-options">
          <div class="theme-option" data-theme="light">
            <div class="theme-preview theme-preview-light">
              <div class="preview-header"></div>
              <div class="preview-body">
                <div class="preview-card"></div>
                <div class="preview-card"></div>
              </div>
            </div>
            <div class="theme-label">
              <i class="bi bi-sun"></i>
              <span>Светла</span>
            </div>
            <div class="theme-description">Идеална за дневна употреба</div>
          </div>
          
          <div class="theme-option" data-theme="dark">
            <div class="theme-preview theme-preview-dark">
              <div class="preview-header"></div>
              <div class="preview-body">
                <div class="preview-card"></div>
                <div class="preview-card"></div>
              </div>
            </div>
            <div class="theme-label">
              <i class="bi bi-moon"></i>
              <span>Тъмна</span>
            </div>
            <div class="theme-description">По-меки цветове за работа вечер</div>
          </div>
          
          <div class="theme-option" data-theme="vivid">
            <div class="theme-preview theme-preview-vivid">
              <div class="preview-header"></div>
              <div class="preview-body">
                <div class="preview-card"></div>
                <div class="preview-card"></div>
              </div>
            </div>
            <div class="theme-label">
              <i class="bi bi-palette"></i>
              <span>Ярка</span>
            </div>
            <div class="theme-description">Контрастни и наситени цветове</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Рендва goal selection стъпка
   * @returns {string}
   */
  renderGoalStep() {
    return `
      <div class="onboarding-goal-selection">
        <p class="step-description">Каква е вашата основна цел?</p>
        <div class="goal-options">
          <div class="goal-option" data-goal="cutting">
            <div class="goal-icon">
              <i class="bi bi-graph-down-arrow"></i>
            </div>
            <h3>Отслабване (Cutting)</h3>
            <p>Намаляване на телесното тегло и мазнини при запазване на мускулна маса</p>
            <ul class="goal-features">
              <li>Калориен дефицит</li>
              <li>Високо съдържание на протеини</li>
              <li>Умерени въглехидрати</li>
            </ul>
          </div>
          
          <div class="goal-option" data-goal="bulking">
            <div class="goal-icon">
              <i class="bi bi-graph-up-arrow"></i>
            </div>
            <h3>Натрупване (Bulking)</h3>
            <p>Увеличаване на мускулна маса с контролирано калорийно излишък</p>
            <ul class="goal-features">
              <li>Калориен излишък</li>
              <li>Балансирани макронутриенти</li>
              <li>Акцент върху силовите тренировки</li>
            </ul>
          </div>
          
          <div class="goal-option" data-goal="maintenance">
            <div class="goal-icon">
              <i class="bi bi-arrow-left-right"></i>
            </div>
            <h3>Поддръжка (Maintenance)</h3>
            <p>Запазване на текущото тегло и форма с балансирано хранене</p>
            <ul class="goal-features">
              <li>Балансиран калориен прием</li>
              <li>Стабилни макронутриенти</li>
              <li>Фокус върху здравето</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Рендва offline explanation стъпка
   * @returns {string}
   */
  renderOfflineStep() {
    return `
      <div class="onboarding-offline-info">
        <div class="offline-icon">
          <i class="bi bi-wifi-off" style="font-size: 3rem; color: var(--secondary-color);"></i>
        </div>
        <h3>Работи и без интернет!</h3>
        <p class="offline-description">
          BodyBest използва offline-first подход за най-добро потребителско изживяване:
        </p>
        <div class="offline-features">
          <div class="feature-item">
            <i class="bi bi-lightning-charge text-success"></i>
            <div>
              <strong>Мигновено логване</strong>
              <p>Данните се записват локално без чакане на сървъра</p>
            </div>
          </div>
          <div class="feature-item">
            <i class="bi bi-arrow-repeat text-info"></i>
            <div>
              <strong>Автоматична синхронизация</strong>
              <p>Приложението автоматично синхронизира данните, когато се свърже отново</p>
            </div>
          </div>
          <div class="feature-item">
            <i class="bi bi-database text-primary"></i>
            <div>
              <strong>Локално кеширане</strong>
              <p>Вашите dashboard и profile данни са винаги достъпни</p>
            </div>
          </div>
          <div class="feature-item">
            <i class="bi bi-check-circle text-success"></i>
            <div>
              <strong>Пълна функционалност</strong>
              <p>Работите нормално дори без интернет връзка</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Рендва completion стъпка
   * @returns {string}
   */
  renderCompleteStep() {
    return `
      <div class="onboarding-complete">
        <div class="complete-icon">
          <i class="bi bi-check-circle" style="font-size: 4rem; color: var(--color-success);"></i>
        </div>
        <h3>Всичко е готово!</h3>
        <p class="complete-text">
          Вашите настройки са запазени. Можете да ги промените по всяко време от менюто.
        </p>
        <div class="complete-summary">
          <div class="summary-item">
            <i class="bi bi-palette"></i>
            <span>Тема: <strong>${this.getThemeLabel(this.selectedTheme)}</strong></span>
          </div>
          <div class="summary-item">
            <i class="bi bi-bullseye"></i>
            <span>Цел: <strong>${this.getGoalLabel(this.selectedGoal)}</strong></span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners към текущата стъпка
   */
  attachEventListeners() {
    const nextBtn = this.modal.querySelector('#onboarding-next');
    const prevBtn = this.modal.querySelector('#onboarding-prev');
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.handleNext());
    }
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.handlePrevious());
    }
    
    // Step-specific event listeners
    const stepId = this.steps[this.currentStep].id;
    
    if (stepId === 'theme') {
      this.attachThemeListeners();
    } else if (stepId === 'goal') {
      this.attachGoalListeners();
    }
  }

  /**
   * Attach theme selection listeners
   */
  attachThemeListeners() {
    const themeOptions = this.modal.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        themeOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedTheme = option.dataset.theme;
      });
    });
    
    // Auto-select current theme ако има
    const currentTheme = localStorage.getItem('theme') || 'light';
    const currentOption = this.modal.querySelector(`[data-theme="${currentTheme}"]`);
    if (currentOption) {
      currentOption.click();
    }
  }

  /**
   * Attach goal selection listeners
   */
  attachGoalListeners() {
    const goalOptions = this.modal.querySelectorAll('.goal-option');
    
    goalOptions.forEach(option => {
      option.addEventListener('click', () => {
        goalOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedGoal = option.dataset.goal;
      });
    });
  }

  /**
   * Handle next button
   */
  handleNext() {
    const stepId = this.steps[this.currentStep].id;
    
    // Validation
    if (stepId === 'theme' && !this.selectedTheme) {
      this.showValidationError('Моля, изберете тема');
      return;
    }
    
    if (stepId === 'goal' && !this.selectedGoal) {
      this.showValidationError('Моля, изберете цел');
      return;
    }
    
    // Last step - complete
    if (this.currentStep === this.steps.length - 1) {
      this.complete();
      return;
    }
    
    // Move to next step
    this.currentStep++;
    this.renderCurrentStep();
  }

  /**
   * Handle previous button
   */
  handlePrevious() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderCurrentStep();
    }
  }

  /**
   * Показва validation error
   * @param {string} message
   */
  showValidationError(message) {
    const footer = this.modal.querySelector('.onboarding-footer');
    
    // Remove existing error
    const existingError = footer.querySelector('.validation-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Add error message
    const error = document.createElement('div');
    error.className = 'validation-error';
    error.textContent = message;
    footer.insertBefore(error, footer.firstChild);
    
    // Remove after 3 seconds
    setTimeout(() => error.remove(), 3000);
  }

  /**
   * Завършва onboarding
   */
  complete() {
    // Запазваме избраните настройки
    if (this.selectedTheme) {
      localStorage.setItem('theme', this.selectedTheme);
      // Прилагаме темата
      if (typeof window.applyTheme === 'function') {
        window.applyTheme(this.selectedTheme);
      }
    }
    
    if (this.selectedGoal) {
      localStorage.setItem('bodybest_user_goal', this.selectedGoal);
      // Тук може да се приложат sensible defaults според целта
      this.applyGoalDefaults(this.selectedGoal);
    }
    
    // Маркираме като завършен
    OnboardingWizard.markComplete();
    
    // Callback
    this.onComplete({
      theme: this.selectedTheme,
      goal: this.selectedGoal
    });
    
    // Затваряме modal
    this.close();
  }

  /**
   * Прилага default настройки според целта
   * @param {string} goal
   */
  applyGoalDefaults(goal) {
    // Тук може да се задават default стойности според целта
    const defaults = {
      cutting: {
        calorieAdjustment: -0.15, // 15% дефицит
        proteinMultiplier: 2.2, // г/кг
        preferredMacroSplit: { protein: 35, carbs: 35, fat: 30 }
      },
      bulking: {
        calorieAdjustment: 0.10, // 10% излишък
        proteinMultiplier: 2.0,
        preferredMacroSplit: { protein: 30, carbs: 45, fat: 25 }
      },
      maintenance: {
        calorieAdjustment: 0,
        proteinMultiplier: 1.8,
        preferredMacroSplit: { protein: 30, carbs: 40, fat: 30 }
      }
    };
    
    const config = defaults[goal];
    if (config) {
      localStorage.setItem('bodybest_goal_config', JSON.stringify(config));
    }
  }

  /**
   * Затваря wizard-а
   */
  close() {
    if (this.overlay) {
      this.overlay.classList.remove('show');
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.modal = null;
      }, 300);
    }
  }

  /**
   * Helper: Връща label за тема
   * @param {string} theme
   * @returns {string}
   */
  getThemeLabel(theme) {
    const labels = { light: 'Светла', dark: 'Тъмна', vivid: 'Ярка' };
    return labels[theme] || theme;
  }

  /**
   * Helper: Връща label за цел
   * @param {string} goal
   * @returns {string}
   */
  getGoalLabel(goal) {
    const labels = {
      cutting: 'Отслабване',
      bulking: 'Натрупване',
      maintenance: 'Поддръжка'
    };
    return labels[goal] || goal;
  }
}

/**
 * Показва onboarding wizard ако не е завършен
 * @param {Object} options
 * @returns {OnboardingWizard|null}
 */
export function showOnboardingIfNeeded(options = {}) {
  if (!OnboardingWizard.isComplete()) {
    const wizard = new OnboardingWizard(options);
    wizard.show();
    return wizard;
  }
  return null;
}
