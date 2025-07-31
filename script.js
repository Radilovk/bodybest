// ==========================================================================
// 🚀 MyBody.Best - ОБЕДИНЕН JAVASCRIPT ФАЙЛ V1.0
// ==========================================================================
// Този файл комбинира оригиналната логика на лендинг страницата
// с новата, модулна логика за вход/регистрация, като запазва
// цялата съществуваща интерактивност.
// ==========================================================================

// --- ЧАСТ 1: ИНТЕГРИРАНИ МОДУЛИ (от отделните JS файлове) ---

import { toggleTheme, initializeTheme } from './js/uiHandlers.js';

/**
 * @description Конфигурация и глобални променливи (от config.js)
 */
const Config = {
    isLocalDevelopment: window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('replit') ||
                        window.location.hostname.includes('preview'),
    
    get workerBaseUrl() {
        return this.isLocalDevelopment ? '' : 'https://openapichatbot.radilov-k.workers.dev';
    },

    get apiEndpoints() {
        return {
            login: `${this.workerBaseUrl}/api/login`,
            register: `${this.workerBaseUrl}/api/register`,
            requestPasswordReset: `${this.workerBaseUrl}/api/requestPasswordReset`,
            // ... добавете други endpoints при нужда
        };
    }
};

// URL на таблото след успешен вход
const dashboardUrl = 'code.html';

/**
 * @description Универсални функции за съобщения (от messageUtils.js)
 */
const MessageUtils = {
    showMessage(element, text, isError = true) {
        if (!element) return;
        element.textContent = text;
        element.className = `message ${isError ? 'error' : 'success'}`;
        element.style.display = 'block';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    hideMessage(element) {
        if (!element) return;
        element.textContent = '';
        element.style.display = 'none';
        element.className = 'message';
    }
};

/**
 * @description Логика за прогрес бар (от stepProgress.js)
 * Анимацията е вградена директно за простота.
 */
const StepProgress = {
    update(barEl, currentStep, totalSteps) {
        if (barEl && totalSteps > 0) {
            const percent = Math.round((Math.max(0, currentStep) / totalSteps) * 100);
            barEl.style.width = `${percent}%`;
        }
    }
};


/**
 * @description Логика за регистрация (от register.js)
 */
function setupRegistration(formSelector, messageElSelector) {
    const form = document.querySelector(formSelector);
    const messageEl = document.querySelector(messageElSelector);
    if (!form || !messageEl) {
        console.error('setupRegistration: elements not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        MessageUtils.hideMessage(messageEl);
        
        const emailInput = form.querySelector('input[type="email"]');
        const [passInput, confirmInput] = form.querySelectorAll('input[type="password"]');
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!emailInput || !passInput || !confirmInput || !submitBtn) {
            console.error('setupRegistration: missing form fields');
            return;
        }

        const email = emailInput.value.trim().toLowerCase();
        const password = passInput.value;
        const confirmPassword = confirmInput.value;
        const btnText = submitBtn.textContent;

        const resetBtn = () => {
            submitBtn.disabled = false;
            submitBtn.textContent = btnText;
        };
        
        const showErr = (msg) => {
            MessageUtils.showMessage(messageEl, msg, true);
            resetBtn();
        };

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Моля, въведете валиден имейл адрес.');
        if (password.length < 8) return showErr('Паролата трябва да е поне 8 знака.');
        if (password !== confirmPassword) return showErr('Паролите не съвпадат.');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Обработка...';

        try {
            const res = await fetch(Config.apiEndpoints.register, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, confirm_password: confirmPassword })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Грешка при регистрацията. Моля, опитайте отново.');
            
            MessageUtils.showMessage(messageEl, data.message || 'Регистрацията успешна! Моля, влезте в профила си.', false);
            form.dispatchEvent(new CustomEvent('registrationSuccess', { detail: { ...data, email } }));
            form.reset();

        } catch (err) {
            console.error('Registration failed:', err);
            const msg = err instanceof TypeError ? 'Неуспешна връзка със сървъра. Проверете интернет връзката.' : err.message;
            showErr(msg);
            form.dispatchEvent(new CustomEvent('registrationError', { detail: err }));
        } finally {
            resetBtn();
        }
    });
}


// --- ЧАСТ 2: ОСНОВНА ЛОГИКА НА СТРАНИЦАТА ---

document.addEventListener('DOMContentLoaded', () => {

    // --- ⚙️ СЕЛЕКТОРИ НА ЕЛЕМЕНТИ ---
    const header = document.getElementById('header');
    const body = document.body;
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (!mobileMenuBtn || !nav) {
        console.warn('script.js: липсва елемент за мобилно меню', {
            btnExists: !!mobileMenuBtn,
            navExists: !!nav
        });
    }
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Модален прозорец
    const modalContainer = document.getElementById('auth-modal');
    const openModalBtns = document.querySelectorAll('.open-modal-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    
    // Форми в модала
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');
    const registerPasswordInput = document.getElementById('register-password');
    const strengthEl = document.getElementById('register-strength');
    const regProgressBar = document.getElementById('registerProgressBar');
    const regInputs = Array.from(registerForm.querySelectorAll('input'));
    const totalRegSteps = regInputs.length;


    // --- 📜 ЛОГИКА ОТ ОРИГИНАЛНИЯ ЛЕНДИНГ (ai_studio_code.js) ---

    // 1. Премахнат скрол слушател, добавяме класа директно в HTML

    // 2. Мобилно меню
    if (mobileMenuBtn && nav) {
        const applyHeaderColor = () => {
            const bg = header ? getComputedStyle(header).backgroundColor : '';
            if (bg) nav.style.backgroundColor = bg;
        };
        const closeNav = () => {
            body.classList.remove('nav-open');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        };
        const toggleNav = () => {
            applyHeaderColor();
            const open = body.classList.toggle('nav-open');
            mobileMenuBtn.setAttribute('aria-expanded', open);
        };
        mobileMenuBtn.addEventListener('click', toggleNav);
        document.addEventListener('click', (e) => {
            if (
                body.classList.contains('nav-open') &&
                !nav.contains(e.target) &&
                !mobileMenuBtn.contains(e.target)
            ) {
                closeNav();
            }
        });
        nav.addEventListener('click', (e) => { if (e.target === nav) closeNav(); });
        nav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeNav);
        });
    }

    // 3. Плавно превъртане
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId.length > 1) {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const offset = header ? header.offsetHeight : 70;
                    const offsetTop = targetElement.offsetTop - offset;
                    window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                }
            }
        });
    });

    // 4. Анимация при скрол
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });
        revealElements.forEach(el => revealObserver.observe(el));
    }
    
    // 5. IDENTITY SLIDER ЛОГИКА
    const sliderItems = document.querySelectorAll('.slider-item');
    if (sliderItems.length > 0) {
        let currentSlide = 0;
        const showSlide = (index) => {
            sliderItems.forEach(item => item.classList.remove('active'));
            sliderItems[index].classList.add('active');
        }
        const nextSlide = () => {
            currentSlide = (currentSlide + 1) % sliderItems.length;
            showSlide(currentSlide);
        }
        setInterval(nextSlide, 3000);
    }
    
    // 6. ЛОГИКА ЗА СГЪВАЕМИ ЕЛЕМЕНТИ (FEATURES/PROGRAMS)
    const collapsibleItems = document.querySelectorAll('.collapsible-item');
    collapsibleItems.forEach(item => {
        const trigger = item.querySelector('.collapsible-trigger');
        if(trigger) {
            trigger.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        }
    });
    
    // 7. ЛОГИКА ЗА ТАБОВЕ (PROGRAMS)
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                const activeContent = document.getElementById('tab-' + tabId);
                if (activeContent) activeContent.classList.add('active');
            });
        });
    }

    // 8. Активна навигация при скрол
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    if (sections.length > 0 && navLinks.length > 0) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if(entry.isIntersecting){
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if(link.getAttribute('href') === '#' + id) link.classList.add('active');
                    });
                }
            });
        }, { rootMargin: '-30% 0px -70% 0px' });
        sections.forEach(section => navObserver.observe(section));
    }

    // --- 💡 НОВА ЛОГИКА ЗА МОДАЛ И ФОРМИ ---

    // 9. Превключвател за тема с унифицирана логика
    if (themeToggleBtn) {
        const icons = {
            light: '<i class="bi bi-moon-stars-fill"></i>',
            dark: '<i class="bi bi-palette-fill"></i>',
            vivid: '<i class="bi bi-brightness-high-fill"></i>'
        };

        const themeOrder = ['light', 'dark', 'vivid'];
        const getCurrent = () =>
            document.body.classList.contains('dark-theme')
                ? 'dark'
                : document.body.classList.contains('vivid-theme')
                ? 'vivid'
                : 'light';

        const updateIcon = () => {
            const current = getCurrent();
            const next = themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
            themeToggleBtn.innerHTML = icons[next];
        };

        themeToggleBtn.addEventListener('click', () => {
            toggleTheme();
            updateIcon();
        });

        initializeTheme();
        updateIcon();
    }

    // 10. Логика за модален прозорец
    if (modalContainer) {
        const openModal = () => modalContainer.classList.add('active');
        const closeModal = () => modalContainer.classList.remove('active');
        
        openModalBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        }));
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === "Escape" && modalContainer.classList.contains('active')) closeModal(); });
        
        const switchForms = (show, hide) => {
            hide.classList.add('hidden');
            show.classList.remove('hidden');
            show.classList.add('fade-in');
            hide.classList.remove('fade-in');
            document.querySelectorAll('.message').forEach(m => MessageUtils.hideMessage(m));
        };

        if (showRegisterLink && registerSection && loginSection) {
            showRegisterLink.addEventListener('click', () => {
                switchForms(registerSection, loginSection);
                registerForm.reset();
                StepProgress.update(regProgressBar, 0, totalRegSteps);
            });
        }
        if (showLoginLink && loginSection && registerSection) {
            showLoginLink.addEventListener('click', () => {
                switchForms(loginSection, registerSection);
                loginForm.reset();
            });
        }
    }
    
    // 11. Логика за формите в модала
    document.querySelectorAll('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = btn.closest('.password-group').querySelector('input');
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            btn.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
    });

    // 12. Логика за сила на паролата и прогрес бар
    if (registerPasswordInput && strengthEl) {
        registerPasswordInput.addEventListener('input', () => {
            const val = registerPasswordInput.value;
            let score = 0;
            if (val.length >= 8) score++; if (/[A-Z]/.test(val)) score++; if (/[0-9]/.test(val)) score++; if (/[^A-Za-z0-9]/.test(val)) score++;
            let text = '', cls = '';
            if (val.length > 0) {
                if (score <= 1) { text = 'Слаба'; cls = 'strength-weak'; }
                else if (score <= 3) { text = 'Средна'; cls = 'strength-medium'; }
                else { text = 'Силна'; cls = 'strength-strong'; }
            }
            strengthEl.textContent = text;
            strengthEl.className = 'password-strength ' + cls;
        });
    }

    if(regProgressBar) {
        const refreshRegProgress = () => {
            const filled = regInputs.filter(el => el.value.trim() !== '').length;
            StepProgress.update(regProgressBar, filled, totalRegSteps);
        };
        regInputs.forEach(inp => inp.addEventListener('input', refreshRegProgress));
        registerForm.addEventListener('reset', () => StepProgress.update(regProgressBar, 0, totalRegSteps));
        refreshRegProgress(); // Initial check
    }

    // 13. Обработка на събития на формите (Login & Register)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            MessageUtils.hideMessage(loginMessage);

            const loginButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = loginButton.textContent;
            loginButton.disabled = true;
            loginButton.textContent = 'Обработка...';

            const email = loginForm.querySelector('#login-email').value.trim().toLowerCase();
            const password = loginForm.querySelector('#login-password').value;

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                 MessageUtils.showMessage(loginMessage, 'Моля, въведете валиден имейл адрес.', true);
                 loginButton.disabled = false;
                 loginButton.textContent = originalButtonText;
                 return;
            }

            try {
                const response = await fetch(Config.apiEndpoints.login, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || `Грешка ${response.status}. Моля, опитайте отново.`);
                }
                
                sessionStorage.setItem('userId', data.userId);
                sessionStorage.setItem('userEmail', email);
                sessionStorage.setItem('planStatus', data.planStatus || 'unknown');
                
                // Пренасочваме към таблото (dashboard), което може да бъде друга страница.
                // В този случай, за целите на демото, просто показваме успех.
                MessageUtils.showMessage(loginMessage, "Успешен вход! Пренасочване...", false);
                setTimeout(() => {
                    window.location.href = dashboardUrl;
                }, 1500);

            } catch (error) {
                console.error('Login failed:', error);
                const msg = error instanceof TypeError ? 'Неуспешна връзка със сървъра. Проверете интернет връзката.' : error.message;
                MessageUtils.showMessage(loginMessage, msg, true);
                loginButton.disabled = false;
                loginButton.textContent = originalButtonText;
            }
        });
    }

    if (registerForm) {
        // Инициализираме логиката за регистрация
        setupRegistration("#register-form", "#register-message");

        // При успешна регистрация, превключваме към формата за вход
        registerForm.addEventListener("registrationSuccess", () => {
            setTimeout(() => {
                if (showLoginLink) showLoginLink.click();
                MessageUtils.hideMessage(registerMessage);
            }, 2500);
        });
    }
});