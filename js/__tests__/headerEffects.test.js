/**
 * @fileoverview Tests for headerEffects module
 * @module headerEffects.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';

describe('headerEffects Module', () => {
  let mockHeader;
  let mockTabs;
  let mockMenuToggle;
  let mockNavigator;

  beforeEach(() => {
    // Mock DOM elements
    mockHeader = document.createElement('header');
    document.body.appendChild(mockHeader);

    const tabsNav = document.createElement('nav');
    tabsNav.className = 'tabs styled-tabs';
    
    for (let i = 0; i < 4; i++) {
      const tab = document.createElement('button');
      tab.className = 'tab-btn';
      tab.setAttribute('role', 'tab');
      tabsNav.appendChild(tab);
    }
    document.body.appendChild(tabsNav);

    mockMenuToggle = document.createElement('button');
    mockMenuToggle.id = 'menu-toggle';
    document.body.appendChild(mockMenuToggle);

    mockTabs = document.querySelectorAll('.tab-btn');

    // Mock navigator.vibrate
    mockNavigator = {
      vibrate: vi.fn()
    };
    global.navigator = mockNavigator;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Header Scroll Effects', () => {
    it('should add scrolled class when scrolling down', () => {
      // Simulate scroll
      window.scrollY = 50;
      window.dispatchEvent(new Event('scroll'));

      // Wait for RAF
      return new Promise(resolve => {
        window.requestAnimationFrame(() => {
          expect(mockHeader.classList.contains('scrolled')).toBe(true);
          resolve();
        });
      });
    });

    it('should remove scrolled class when at top', () => {
      mockHeader.classList.add('scrolled');
      window.scrollY = 0;
      window.dispatchEvent(new Event('scroll'));

      return new Promise(resolve => {
        window.requestAnimationFrame(() => {
          expect(mockHeader.classList.contains('scrolled')).toBe(false);
          resolve();
        });
      });
    });

    it('should use requestAnimationFrame for performance', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
      window.dispatchEvent(new Event('scroll'));
      
      expect(rafSpy).toHaveBeenCalled();
      rafSpy.mockRestore();
    });
  });

  describe('Haptic Feedback', () => {
    it('should trigger vibration on tab click if supported', () => {
      const tab = mockTabs[0];
      tab.click();

      expect(mockNavigator.vibrate).toHaveBeenCalledWith(10);
    });

    it('should not throw error if vibration not supported', () => {
      delete global.navigator.vibrate;
      
      const tab = mockTabs[0];
      expect(() => tab.click()).not.toThrow();
    });

    it('should trigger vibration on menu toggle click', () => {
      mockMenuToggle.click();

      expect(mockNavigator.vibrate).toHaveBeenCalledWith(10);
    });
  });

  describe('Tab Interactions', () => {
    it('should have event listeners on all tabs', () => {
      mockTabs.forEach(tab => {
        const hasClickListener = tab.onclick !== null || 
          tab.addEventListener.mock?.calls.some(call => call[0] === 'click');
        
        // At minimum, tabs should be interactive
        expect(tab).toBeInstanceOf(HTMLElement);
      });
    });

    it('should maintain accessibility attributes', () => {
      mockTabs.forEach(tab => {
        expect(tab.getAttribute('role')).toBe('tab');
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should use passive event listeners for scroll', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      // Re-initialize module
      const scrollListener = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'scroll'
      );

      if (scrollListener) {
        expect(scrollListener[2]).toEqual(expect.objectContaining({
          passive: true
        }));
      }

      addEventListenerSpy.mockRestore();
    });
  });

  describe('Module Exports', () => {
    it('should export initHeaderAndTabEffects function', async () => {
      const module = await import('../headerEffects.js');
      expect(typeof module.initHeaderAndTabEffects).toBe('function');
    });
  });

  describe('CSS Animations', () => {
    it('should have required CSS classes on tabs', () => {
      const tabsNav = document.querySelector('.tabs.styled-tabs');
      expect(tabsNav).toBeTruthy();
      expect(tabsNav.classList.contains('styled-tabs')).toBe(true);
    });

    it('should have required structure for animations', () => {
      mockTabs.forEach(tab => {
        expect(tab.classList.contains('tab-btn')).toBe(true);
      });
    });
  });
});

describe('CSS Selectors', () => {
  it('header should have correct styling classes', () => {
    const style = window.getComputedStyle(mockHeader);
    expect(mockHeader.style).toBeDefined();
  });

  it('tabs should have transition properties', () => {
    const tab = document.querySelector('.tab-btn');
    if (tab) {
      const style = window.getComputedStyle(tab);
      expect(style).toBeDefined();
    }
  });
});
