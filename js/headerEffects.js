/**
 * @fileoverview Header and Tab Effects Module
 * Добавя subtle animations и interactions за header и tabs
 * @module headerEffects
 */

/**
 * Добавя scroll effects на header
 */
function initHeaderScrollEffects() {
  const header = document.querySelector('header');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeaderOnScroll() {
    const scrollY = window.scrollY;

    // Добавяме scrolled class при скролиране
    if (scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Optional: Compact mode при много скролиране (disabled by default)
    // if (scrollY > 100) {
    //   header.classList.add('compact');
    // } else {
    //   header.classList.remove('compact');
    // }

    lastScrollY = scrollY;
    ticking = false;
  }

  function requestHeaderUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(updateHeaderOnScroll);
      ticking = true;
    }
  }

  // Throttled scroll listener
  window.addEventListener('scroll', requestHeaderUpdate, { passive: true });

  // Initial check
  updateHeaderOnScroll();
}

/**
 * Симулира haptic feedback при tab click (за браузъри с Vibration API)
 */
function simulateHapticFeedback() {
  if ('vibrate' in navigator) {
    // Кратка вибрация (10ms) за subtle feedback
    navigator.vibrate(10);
  }
}

/**
 * Добавя enhanced interactions за tabs
 */
function initTabInteractions() {
  const tabs = document.querySelectorAll('nav.tabs.styled-tabs .tab-btn');
  
  tabs.forEach(tab => {
    // Haptic feedback при click
    tab.addEventListener('click', () => {
      simulateHapticFeedback();
    }, { passive: true });

    // Ripple effect при touchstart (за по-бърз feedback)
    tab.addEventListener('touchstart', (e) => {
      // Вече имаме CSS ripple effect с :active, 
      // но можем да добавим допълнителна логика тук ако е нужно
    }, { passive: true });
  });
}

/**
 * Добавя menu button interaction effects
 */
function initMenuButtonEffects() {
  const menuToggle = document.getElementById('menu-toggle');
  if (!menuToggle) return;

  menuToggle.addEventListener('click', () => {
    simulateHapticFeedback();
  });
}

/**
 * Инициализира всички header и tab effects
 */
export function initHeaderAndTabEffects() {
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initHeaderScrollEffects();
      initTabInteractions();
      initMenuButtonEffects();
    });
  } else {
    initHeaderScrollEffects();
    initTabInteractions();
    initMenuButtonEffects();
  }
}

// Auto-initialize ако модулът е импортиран
if (typeof window !== 'undefined') {
  initHeaderAndTabEffects();
}
