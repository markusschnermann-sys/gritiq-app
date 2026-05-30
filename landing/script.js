/* ═══════════════════════════════════════════════════════════
   GritIQ Landing Page — script.js
   Handles: theme toggle, burger menu, pricing period toggle,
            scroll-reveal animations, smooth scroll
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── 1. Theme Toggle ─── */
(function initTheme() {
  const HTML = document.documentElement;
  const STORAGE_KEY = 'gritiq-theme';

  // Honour OS preference (no localStorage in sandboxed iframe)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = prefersDark ? 'dark' : 'light';
  HTML.setAttribute('data-theme', initial);

  function applyTheme(theme) {
    HTML.setAttribute('data-theme', theme);
    // Update all toggle-button icons
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Helles Theme aktivieren' : 'Dunkles Theme aktivieren');
      btn.innerHTML = theme === 'dark'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
             <circle cx="12" cy="12" r="5"/>
             <line x1="12" y1="1" x2="12" y2="3"/>
             <line x1="12" y1="21" x2="12" y2="23"/>
             <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
             <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
             <line x1="1" y1="12" x2="3" y2="12"/>
             <line x1="21" y1="12" x2="23" y2="12"/>
             <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
             <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
           </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
             <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
           </svg>`;
    });
  }

  // Apply icon on page load
  applyTheme(initial);

  document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    const current = HTML.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
})();


/* ─── 2. Burger / Mobile Menu ─── */
(function initBurger() {
  const burger = document.getElementById('burger');
  const menu   = document.getElementById('mobile-menu');
  if (!burger || !menu) return;

  function openMenu() {
    menu.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    burger.classList.add('open');
    // Animate in
    requestAnimationFrame(() => menu.classList.add('visible'));
  }

  function closeMenu() {
    menu.classList.remove('visible');
    burger.setAttribute('aria-expanded', 'false');
    burger.classList.remove('open');
    // Wait for CSS transition before hiding from accessibility tree
    menu.addEventListener('transitionend', () => { menu.hidden = true; }, { once: true });
  }

  burger.addEventListener('click', () => {
    const isOpen = burger.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMenu() : openMenu();
  });

  // Close menu on nav link click
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') closeMenu();
  });
})();


/* ─── 3. Pricing Period Toggle ─── */
(function initPricingToggle() {
  const btnMonthly = document.getElementById('toggle-monthly');
  const btnYearly  = document.getElementById('toggle-yearly');
  const priceVal   = document.getElementById('price-val');
  const pricePer   = document.getElementById('price-period');
  const planDesc   = document.getElementById('plan-desc-pro');
  if (!btnMonthly || !btnYearly) return;

  const prices = {
    monthly: {
      amount:  '9,99&nbsp;€',
      period:  '/ Monat',
      desc:    '14 Tage kostenlos testen · Jederzeit kündbar',
    },
    yearly: {
      amount:  '6,66&nbsp;€',
      period:  '/ Mo. · 79,99&nbsp;€/Jahr',
      desc:    'Jährlich abgerechnet · 14 Tage kostenlos testen',
    },
  };

  function setPeriod(period) {
    const data = prices[period];

    // Fade-swap animation
    if (priceVal) {
      priceVal.style.opacity = '0';
      priceVal.style.transform = 'translateY(-4px)';
      setTimeout(() => {
        priceVal.innerHTML = data.amount;
        priceVal.style.opacity = '1';
        priceVal.style.transform = 'translateY(0)';
      }, 140);
    }
    if (pricePer) {
      pricePer.style.opacity = '0';
      setTimeout(() => {
        pricePer.textContent = data.period;
        pricePer.style.opacity = '1';
      }, 140);
    }
    if (planDesc) {
      planDesc.style.opacity = '0';
      setTimeout(() => {
        planDesc.innerHTML = data.desc;
        planDesc.style.opacity = '1';
      }, 140);
    }

    // Toggle button active state
    btnMonthly.classList.toggle('active', period === 'monthly');
    btnYearly.classList.toggle('active',  period === 'yearly');
  }

  btnMonthly.addEventListener('click', () => setPeriod('monthly'));
  btnYearly.addEventListener('click',  () => setPeriod('yearly'));

  // CSS transition support for the price elements
  [priceVal, pricePer, planDesc].forEach(el => {
    if (el) el.style.transition = 'opacity 140ms ease, transform 140ms ease';
  });
})();


/* ─── 4. Scroll Reveal (IntersectionObserver) ─── */
(function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Add reveal class to target elements
  const SELECTORS = [
    '.section-header',
    '.feature-row',
    '.feature-card-demo',
    '.compare-table-wrap',
    '.compare-callout',
    '.pricing-card',
    '.testimonial-card',
    '.faq-item',
    '.cta-section-inner',
    '.trust-item',
  ];

  const targets = document.querySelectorAll(SELECTORS.join(', '));

  targets.forEach((el, i) => {
    el.classList.add('reveal');
    // Stagger sibling elements (cards in a grid)
    const siblings = el.parentElement
      ? Array.from(el.parentElement.children).filter(c => c.classList.contains(el.classList[0]))
      : [];
    const sibIdx = siblings.indexOf(el);
    if (sibIdx > 0) el.style.transitionDelay = `${sibIdx * 80}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -32px 0px' }
  );

  // Observe all targets (IntersectionObserver will fire immediately for in-view elements)
  targets.forEach(el => observer.observe(el));

  // Safety fallback: after first paint, force-reveal anything still in viewport
  requestAnimationFrame(() => requestAnimationFrame(() => {
    targets.forEach(el => {
      if (el.classList.contains('visible')) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 100 && rect.bottom > 0) {
        el.classList.add('visible');
      }
    });
  }));
})();


/* ─── 5. Smooth Scroll for Anchor Links ─── */
(function initSmoothScroll() {
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (hash === '#' || hash === '#top') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Update URL without triggering scroll
    history.pushState(null, '', hash);
  });
})();


/* ─── 6. Nav: scroll-shadow + active section highlight ─── */
(function initNav() {
  const nav = document.querySelector('.nav-wrapper');
  if (!nav) return;

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('nav-scrolled', window.scrollY > 32);
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight active section in nav
  if (!('IntersectionObserver' in window)) return;

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const sectionObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.toggle(
              'nav-link-active',
              link.getAttribute('href') === '#' + entry.target.id
            );
          });
        }
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach(s => sectionObserver.observe(s));
})();


/* ─── 7. Hero: typing / animated tagline (optional polish) ─── */
(function initHeroAnimation() {
  const badge = document.querySelector('.hero-badge');
  if (!badge) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Fade-in badge after a short delay for polish
  badge.style.opacity = '0';
  badge.style.transform = 'translateY(8px)';
  badge.style.transition = 'opacity 500ms ease 300ms, transform 500ms ease 300ms';
  requestAnimationFrame(() => {
    badge.style.opacity = '1';
    badge.style.transform = 'translateY(0)';
  });
})();


/* ─── 8. Stat bar counter animation in mockup ─── */
(function initMockupStats() {
  const fill = document.querySelector('.stat-fill');
  if (!fill) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        fill.style.transition = 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
        fill.style.width = fill.style.width || '18%';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  observer.observe(fill);
})();


/* ─── 9. Interactive Feature Tour ─── */
(function initTour() {
  const TOTAL_STEPS = 4;
  const AUTO_ADVANCE_MS = 6000;

  const steps   = Array.from(document.querySelectorAll('.tour-step'));
  const screens = Array.from(document.querySelectorAll('.tour-screen'));
  const dotBtns = Array.from(document.querySelectorAll('.tour-dot-btn'));
  const ctaFloat = document.getElementById('tour-cta-float');

  if (!steps.length || !screens.length) return;

  let current   = 0;
  let autoTimer = null;
  let direction = 1; // 1 = forward, -1 = backward

  // ── Activate a step ──
  function goToStep(idx, dir) {
    if (idx === current && steps[idx].classList.contains('active')) return;
    direction = dir ?? (idx > current ? 1 : -1);

    const prev = current;
    current = idx;

    // Step buttons
    steps.forEach((s, i) => {
      s.classList.toggle('active', i === idx);
      s.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      // Reset & restart progress fill animation by cloning the fill element
      const fill = s.querySelector('.step-progress-fill');
      if (fill) {
        const clone = fill.cloneNode(true);
        fill.parentNode.replaceChild(clone, fill);
      }
    });

    // Screens: exit current, enter next
    screens.forEach((sc, i) => {
      sc.classList.remove('active', 'exit');
      sc.style.transform = '';
      if (i === prev && prev !== idx) {
        // Slide out to opposite of direction
        sc.style.transform = direction > 0 ? 'translateX(-32px)' : 'translateX(32px)';
        sc.style.opacity = '0';
        sc.style.pointerEvents = 'none';
        sc.style.position = 'absolute';
        // Clean up after transition
        setTimeout(() => {
          sc.style.transform = '';
          sc.style.opacity = '';
          sc.style.pointerEvents = '';
          sc.style.position = '';
        }, 420);
      }
      if (i === idx) {
        // Prepare: come from direction
        sc.style.transform = direction > 0 ? 'translateX(32px)' : 'translateX(-32px)';
        sc.style.opacity = '0';
        sc.style.position = 'relative';
        // Force reflow
        sc.offsetHeight;
        sc.classList.add('active');
        sc.style.transform = '';
        sc.style.opacity = '';
      }
    });

    // Dot buttons
    dotBtns.forEach((d, i) => d.classList.toggle('active', i === idx));

    // Floating CTA: show only after reaching last step
    if (ctaFloat) {
      ctaFloat.classList.toggle('show', idx === TOTAL_STEPS - 1);
      ctaFloat.setAttribute('aria-hidden', idx === TOTAL_STEPS - 1 ? 'false' : 'true');
    }

    // Run entrance micro-animations for the incoming screen
    runScreenEntrance(screens[idx], idx);

    // Restart auto-advance
    scheduleAutoAdvance();
  }

  // ── Screen-specific entrance micro-animations ──
  function runScreenEntrance(screen, idx) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (idx === 0) {
      // Workout: animate sets staggered in
      const sets = screen.querySelectorAll('.tscreen-set');
      sets.forEach((s, i) => {
        s.style.opacity = '0';
        s.style.transform = 'translateY(6px)';
        s.style.transition = 'none';
        setTimeout(() => {
          s.style.transition = 'opacity 280ms ease, transform 280ms ease';
          s.style.opacity = '1';
          s.style.transform = 'translateY(0)';
        }, 200 + i * 80);
      });
    }

    if (idx === 1) {
      // ATLAS: animate messages staggered in
      const msgs = screen.querySelectorAll('.tscreen-msg');
      msgs.forEach((m, i) => {
        m.style.opacity = '0';
        m.style.transform = 'translateY(8px)';
        m.style.transition = 'none';
        setTimeout(() => {
          m.style.transition = 'opacity 300ms ease, transform 300ms ease';
          m.style.opacity = '1';
          m.style.transform = 'translateY(0)';
        }, 180 + i * 120);
      });
    }

    if (idx === 2) {
      // Nutrition: macro cards count up
      const macroVals = screen.querySelectorAll('.macro-val');
      const targets = [2800, 192, 320, 72];
      macroVals.forEach((el, i) => {
        const label = el.textContent.replace(/[^0-9]/g, '');
        const target = targets[i] ?? parseInt(label, 10);
        const suffix = el.textContent.replace(/[0-9]/g, '');
        let start = null;
        const duration = 600;
        function tick(ts) {
          if (!start) start = ts;
          const progress = Math.min((ts - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(eased * target) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        setTimeout(() => requestAnimationFrame(tick), 200 + i * 60);
      });

      // Stagger meals in
      const meals = screen.querySelectorAll('.tscreen-meal');
      meals.forEach((m, i) => {
        m.style.opacity = '0';
        m.style.transform = 'translateX(-8px)';
        m.style.transition = 'none';
        setTimeout(() => {
          m.style.transition = 'opacity 300ms ease, transform 300ms ease';
          m.style.opacity = '1';
          m.style.transform = 'translateX(0)';
        }, 300 + i * 80);
      });
    }

    if (idx === 3) {
      // Analytics: PR deltas animate in + sparkline draws
      const prs = screen.querySelectorAll('.tscreen-pr');
      prs.forEach((p, i) => {
        p.style.opacity = '0';
        p.style.transform = 'translateY(10px)';
        p.style.transition = 'none';
        setTimeout(() => {
          p.style.transition = 'opacity 320ms ease, transform 320ms ease';
          p.style.opacity = '1';
          p.style.transform = 'translateY(0)';
        }, 150 + i * 100);
      });

      // Animate sparkline path drawing
      const line = screen.querySelector('.spark-line');
      if (line) {
        const len = line.getTotalLength?.() || 400;
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        line.style.transition = 'none';
        setTimeout(() => {
          line.style.transition = 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)';
          line.style.strokeDashoffset = '0';
        }, 300);
      }
      const area = screen.querySelector('.spark-area');
      if (area) {
        area.style.opacity = '0';
        setTimeout(() => {
          area.style.transition = 'opacity 600ms ease 400ms';
          area.style.opacity = '1';
        }, 300);
      }
    }
  }

  // ── Auto-advance timer ──
  function scheduleAutoAdvance() {
    clearTimeout(autoTimer);
    // Pause auto-advance when section is not in view
    const tourSection = document.getElementById('tour');
    if (!tourSection) return;
    const rect = tourSection.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;

    autoTimer = setTimeout(() => {
      const next = (current + 1) % TOTAL_STEPS;
      goToStep(next, 1);
    }, AUTO_ADVANCE_MS);
  }

  // ── Click handlers ──
  steps.forEach((btn, i) => {
    btn.addEventListener('click', () => goToStep(i, i > current ? 1 : -1));
  });
  dotBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => goToStep(i, i > current ? 1 : -1));
  });

  // ── Keyboard navigation (←→ when tour is focused) ──
  const tourShell = document.querySelector('.tour-shell');
  if (tourShell) {
    tourShell.setAttribute('tabindex', '-1');
    tourShell.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToStep((current + 1) % TOTAL_STEPS, 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToStep((current - 1 + TOTAL_STEPS) % TOTAL_STEPS, -1);
      }
    });
  }

  // ── Touch/swipe support for phone mockup ──
  const phoneScreen = document.getElementById('tour-screen-root');
  if (phoneScreen) {
    let touchStartX = 0;
    let touchStartY = 0;
    phoneScreen.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    phoneScreen.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
      if (Math.abs(dx) > 40 && dy < 60) {
        if (dx < 0) goToStep((current + 1) % TOTAL_STEPS, 1);
        else         goToStep((current - 1 + TOTAL_STEPS) % TOTAL_STEPS, -1);
      }
    }, { passive: true });
  }

  // ── Scroll-triggered auto-advance (pause when off-screen) ──
  let scrollPaused = false;
  window.addEventListener('scroll', () => {
    const tourSection = document.getElementById('tour');
    if (!tourSection) return;
    const rect = tourSection.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.8 && rect.bottom > 100;
    if (inView && scrollPaused) {
      scrollPaused = false;
      scheduleAutoAdvance();
    } else if (!inView && !scrollPaused) {
      scrollPaused = true;
      clearTimeout(autoTimer);
    }
  }, { passive: true });

  // ── Pause on hover ──
  const tourDisplay = document.querySelector('.tour-display');
  if (tourDisplay) {
    tourDisplay.addEventListener('mouseenter', () => clearTimeout(autoTimer));
    tourDisplay.addEventListener('mouseleave', scheduleAutoAdvance);
  }

  // ── Init: activate step 0 screens, start entrance animation ──
  screens.forEach((sc, i) => {
    if (i !== 0) {
      sc.style.position = 'absolute';
      sc.style.opacity = '0';
      sc.style.transform = 'translateX(32px)';
      sc.style.pointerEvents = 'none';
    }
  });

  // Run entrance for screen 0 after a short delay (fonts/layout settle)
  setTimeout(() => runScreenEntrance(screens[0], 0), 400);

  // Start auto-advance once tour is in viewport
  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      scheduleAutoAdvance();
    } else {
      clearTimeout(autoTimer);
    }
  }, { threshold: 0.2 });
  const tourSection = document.getElementById('tour');
  if (tourSection) io.observe(tourSection);
})();
