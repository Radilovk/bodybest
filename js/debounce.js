// Debounce and Throttle Utilities
// Използват се за намаляване на броя извиквания на функции при чести събития

/**
 * Debounce функция - изпълнява функцията след определено време от последното извикване
 * @param {Function} func - Функция за debounce
 * @param {number} delay - Забавяне в милисекунди
 * @returns {Function} - Debounced функция
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  
  const debounced = function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
  
  // Добавяме метод за отказване на чакащото извикване
  debounced.cancel = function () {
    clearTimeout(timeoutId);
  };
  
  return debounced;
}

/**
 * Throttle функция - ограничава изпълнението на функцията до определен интервал
 * @param {Function} func - Функция за throttle
 * @param {number} limit - Минимален интервал между извикванията в милисекунди
 * @returns {Function} - Throttled функция
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  let lastResult;
  
  const throttled = function (...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
  
  return throttled;
}

/**
 * Leading debounce - изпълнява функцията веднага при първото извикване,
 * след това игнорира последващи извиквания за определено време
 * @param {Function} func - Функция за debounce
 * @param {number} delay - Забавяне в милисекунди
 * @returns {Function} - Leading debounced функция
 */
export function debounceLeading(func, delay = 300) {
  let timeoutId;
  let lastExecution = 0;
  
  return function (...args) {
    const now = Date.now();
    const timeSinceLastExec = now - lastExecution;
    
    if (timeSinceLastExec >= delay) {
      lastExecution = now;
      return func.apply(this, args);
    }
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      lastExecution = Date.now();
      func.apply(this, args);
    }, delay);
  };
}
