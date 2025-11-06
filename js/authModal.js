import { showMessage, hideMessage } from './messageUtils.js';
import { apiEndpoints } from './config.js';
import { setupRegistration } from './register.js';

const dashboardUrl = 'code.html';
const questionnaireUrl = 'quest.html';
let initialized = false;

export async function openAuthModal() {
    const modalContainer = document.getElementById('auth-modal');
    if (!modalContainer) return;
    if (!initialized) {
        initialized = true;
        initModal(modalContainer);
    }
    modalContainer.classList.add('active');
}

function initModal(modalContainer) {
    const closeModalBtn = modalContainer.querySelector('.close-modal');
    const loginSection = modalContainer.querySelector('#login-section');
    const registerSection = modalContainer.querySelector('#register-section');
    const showRegisterLink = modalContainer.querySelector('#show-register');
    const showLoginLink = modalContainer.querySelector('#show-login');
    const loginForm = modalContainer.querySelector('#login-form');
    const registerForm = modalContainer.querySelector('#register-form');
    const loginMessage = modalContainer.querySelector('#login-message');
    const registerMessage = modalContainer.querySelector('#register-message');
    const registerPasswordInput = modalContainer.querySelector('#register-password');
    const strengthEl = modalContainer.querySelector('#register-strength');
    const regProgressBar = modalContainer.querySelector('#registerProgressBar');
    const regInputs = registerForm ? Array.from(registerForm.querySelectorAll('input')) : [];
    const totalRegSteps = regInputs.length;

    const closeModal = () => modalContainer.classList.remove('active');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    const switchForms = (show, hide) => {
        hide.classList.add('hidden');
        show.classList.remove('hidden');
        show.classList.add('fade-in');
        hide.classList.remove('fade-in');
        [loginMessage, registerMessage].forEach(m => m && hideMessage(m));
    };
    if (showRegisterLink && registerSection && loginSection) {
        showRegisterLink.addEventListener('click', () => {
            switchForms(registerSection, loginSection);
            if (registerForm) {
                registerForm.reset();
                updateRegProgress();
            }
        });
    }
    if (showLoginLink && loginSection && registerSection) {
        showLoginLink.addEventListener('click', () => {
            switchForms(loginSection, registerSection);
            if (loginForm) loginForm.reset();
        });
    }

    modalContainer.querySelectorAll('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.password-group')?.querySelector('input');
            if (!input) return;
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            btn.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
    });

    if (registerPasswordInput && strengthEl) {
        registerPasswordInput.addEventListener('input', () => {
            const val = registerPasswordInput.value;
            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;
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

    function updateRegProgress() {
        const filled = regInputs.filter(el => el.value.trim() !== '').length;
        if (regProgressBar) {
            const percent = Math.round((Math.max(0, filled) / totalRegSteps) * 100);
            regProgressBar.style.width = `${percent}%`;
        }
    }
    if (registerForm && regProgressBar) {
        regInputs.forEach(inp => inp.addEventListener('input', updateRegProgress));
        registerForm.addEventListener('reset', () => { if (regProgressBar) regProgressBar.style.width = '0%'; });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessage(loginMessage);
            const loginButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = loginButton.textContent;
            loginButton.disabled = true;
            loginButton.textContent = 'Обработка...';
            const email = loginForm.querySelector('#login-email').value.trim().toLowerCase();
            const password = loginForm.querySelector('#login-password').value;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showMessage(loginMessage, 'Моля, въведете валиден имейл адрес.', true);
                loginButton.disabled = false;
                loginButton.textContent = originalButtonText;
                return;
            }
            try {
                const response = await fetch(apiEndpoints.login, {
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
                
                // Determine redirect target based on server response
                let redirectTarget = dashboardUrl;
                if (data.redirectTo === 'questionnaire') {
                    redirectTarget = `${questionnaireUrl}?userId=${data.userId}`;
                }
                
                showMessage(loginMessage, 'Успешен вход! Пренасочване...', false);
                setTimeout(() => { window.location.href = redirectTarget; }, 1500);
            } catch (error) {
                const msg = error instanceof TypeError ? 'Неуспешна връзка със сървъра. Проверете интернет връзката.' : error.message;
                showMessage(loginMessage, msg, true);
                loginButton.disabled = false;
                loginButton.textContent = originalButtonText;
            }
        });
    }

    if (registerForm) {
        setupRegistration('#register-form', '#register-message');
        registerForm.addEventListener('registrationSuccess', () => {
            setTimeout(() => {
                if (showLoginLink) showLoginLink.click();
                hideMessage(registerMessage);
            }, 2500);
        });
    }
}
