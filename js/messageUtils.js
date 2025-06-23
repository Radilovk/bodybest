// messageUtils.js - Универсални функции за съобщения

/**
 * Показва съобщение в DOM елемент.
 * @param {HTMLElement} element - Елементът, в който да се покаже съобщението.
 * @param {string} text - Текстът на съобщението.
 * @param {boolean} [isError=true] - Дали съобщението е за грешка.
 */
export function showMessage(element, text, isError = true) {
    element.textContent = text;
    element.className = isError ? 'message error' : 'message success animate-success';
    element.style.display = 'block';
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

/**
 * Скрива съобщението в дадения елемент.
 * @param {HTMLElement} element - Елементът, който да се скрие.
 */
export function hideMessage(element) {
    element.textContent = '';
    element.style.display = 'none';
    element.className = 'message';
}
