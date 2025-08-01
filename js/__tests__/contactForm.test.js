/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let setupContactForm;
let showMessage;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <form id="contact-form">
      <input type="text" id="name">
      <input type="email" id="email">
      <textarea id="message"></textarea>
      <button type="submit">Send</button>
    </form>
    <div id="contact-msg"></div>`;
  jest.unstable_mockModule('../messageUtils.js', () => ({
    showMessage: jest.fn(),
    hideMessage: jest.fn()
  }));
  ({ setupContactForm } = await import('../contactForm.js'));
  ({ showMessage } = await import('../messageUtils.js'));
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

test('sends request and clears fields on success', async () => {
  const form = document.getElementById('contact-form');
  form.querySelector('#name').value = 'User';
  form.querySelector('#email').value = 'user@test.com';
  form.querySelector('#message').value = 'Hi';
  setupContactForm('#contact-form', '#contact-msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledWith('/api/contact', expect.any(Object));
  expect(form.querySelector('#name').value).toBe('');
  expect(form.querySelector('#email').value).toBe('');
  expect(form.querySelector('#message').value).toBe('');
});

test('shows message on invalid email', async () => {
  const form = document.getElementById('contact-form');
  form.querySelector('#name').value = 'User';
  form.querySelector('#email').value = 'bad';
  form.querySelector('#message').value = 'Hi';
  setupContactForm('#contact-form', '#contact-msg');
  form.dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(fetch).not.toHaveBeenCalled();
  expect(showMessage).toHaveBeenCalledWith(
    document.getElementById('contact-msg'),
    'Невалиден e-mail адрес.',
    true
  );
});
