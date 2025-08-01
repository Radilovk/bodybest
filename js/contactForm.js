import { showMessage, hideMessage } from './messageUtils.js';

/**
 * Инициализира обработката на контактната форма.
 * @param {string} formSelector - Селектор за формата.
 * @param {string} messageSelector - Селектор за елемента за съобщения.
 */
export function setupContactForm(formSelector, messageSelector) {
  const form = document.querySelector(formSelector);
  const messageEl = document.querySelector(messageSelector);
  if (!form || !messageEl) {
    console.error('setupContactForm: elements not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(messageEl);

    const nameInput = form.querySelector('#name');
    const emailInput = form.querySelector('#email');
    const messageInput = form.querySelector('#message');
    if (!nameInput || !emailInput || !messageInput) {
      console.error('setupContactForm: missing input fields');
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !email || !message)
      return showMessage(messageEl, 'Моля, попълнете всички полета.', true);
    if (!emailInput.validity.valid)
      return showMessage(messageEl, 'Невалиден e-mail адрес.', true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      });
      if (!res.ok) throw new Error('Грешка при изпращането. Моля, опитайте отново.');
      showMessage(messageEl, 'Съобщението е изпратено успешно!', false);
      form.reset();
    } catch (err) {
      console.error('Contact form error:', err);
      showMessage(messageEl, err.message || 'Нещо се обърка. Опитайте пак.', true);
    }
  });
}

// TODO: Добави reCAPTCHA или друга защита от спам при публичен достъп до API.

document.addEventListener('DOMContentLoaded', () => {
  setupContactForm('#contact-form', '#contact-msg');
});
