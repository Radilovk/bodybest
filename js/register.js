import { showMessage, hideMessage } from "./messageUtils.js";
import { workerBaseUrl } from "./config.js";

export function setupRegistration(formSelector, messageElSelector) {
  const form = document.querySelector(formSelector);
  const messageEl = document.querySelector(messageElSelector);
  if (!form || !messageEl) {
    console.error('setupRegistration: elements not found');
    return;
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(messageEl);
    const emailInput = form.querySelector('input[type="email"]');
    const [passInput, confirmInput] = form.querySelectorAll('input[type="password"]');
    if (!emailInput || !passInput || !confirmInput) {
      console.error('setupRegistration: missing input fields');
      return;
    }
    const email = emailInput.value.trim().toLowerCase();
    const password = passInput.value;
    const confirmPassword = confirmInput.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn ? submitBtn.textContent : '';
    const resetBtn = () => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = btnText;
      }
    };
    const showErr = (msg) => {
      showMessage(messageEl, msg, true);
      resetBtn();
    };
    if (!email || !password || !confirmPassword) return showErr('Моля, попълнете всички полета.');
    if (password.length < 8) return showErr('Паролата трябва да е поне 8 знака.');
    if (password !== confirmPassword) return showErr('Паролите не съвпадат.');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Обработка...';
    }
    try {
      const res = await fetch(`${workerBaseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirm_password: confirmPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Грешка при регистрацията. Моля, опитайте отново.');
      showMessage(messageEl, data.message || 'Регистрацията успешна!', false);
      form.reset();
      form.dispatchEvent(new CustomEvent('registrationSuccess', { detail: data }));
    } catch (err) {
      console.error('Registration failed:', err);
      showMessage(messageEl, err.message, true);
      form.dispatchEvent(new CustomEvent('registrationError', { detail: err }));
    } finally {
      resetBtn();
    }
  });
}
