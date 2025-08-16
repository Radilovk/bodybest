import { toggleTheme, initializeTheme } from './js/uiHandlers.js';

document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const body = document.body;
    const nav = document.getElementById('nav');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const openModalBtns = document.querySelectorAll('.open-modal-btn');
    let authModule;

    // Динамично зареждане на логиката за вход/регистрация
    openModalBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!authModule) authModule = import('./js/authModal.js');
            const { openAuthModal } = await authModule;
            openAuthModal();
        });
    });

    // Мобилно меню
    if (mobileMenuBtn && nav) {
        const applyHeaderColor = () => {
            const bg = getComputedStyle(document.documentElement)
                .getPropertyValue('--header-bg-solid')
                .trim();
            if (bg) nav.style.background = bg;
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
    } else {
        console.warn('script.js: липсва елемент за мобилно меню', {
            btnExists: !!mobileMenuBtn,
            navExists: !!nav
        });
    }

    // Плавно превъртане
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
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

    // Анимация при скрол
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });
        revealElements.forEach(el => revealObserver.observe(el));
    }

    // Identity slider
    const sliderItems = document.querySelectorAll('.slider-item');
    if (sliderItems.length > 0) {
        let currentSlide = 0;
        const showSlide = (index) => {
            sliderItems.forEach(item => item.classList.remove('active'));
            sliderItems[index].classList.add('active');
        };
        const nextSlide = () => {
            currentSlide = (currentSlide + 1) % sliderItems.length;
            showSlide(currentSlide);
        };
        setInterval(nextSlide, 3000);
    }

    // Сгъваеми елементи
    const collapsibleItems = document.querySelectorAll('.collapsible-item');
    collapsibleItems.forEach(item => {
        const trigger = item.querySelector('.collapsible-trigger');
        if (trigger) {
            trigger.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        }
    });

    // Табове
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

    // Активна навигация при скрол
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    if (sections.length > 0 && navLinks.length > 0) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + id) link.classList.add('active');
                    });
                }
            });
        }, { rootMargin: '-30% 0px -70% 0px' });
        sections.forEach(section => navObserver.observe(section));
    }

    // Превключвател за тема
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
});
