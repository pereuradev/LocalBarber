(() => {
  const titles = Array.from(document.querySelectorAll('[data-split-title]'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!titles.length || reduceMotion || !window.gsap || !window.SplitText) return;

  gsap.registerPlugin(SplitText);

  const titleAnimations = new Map();

  titles.forEach((title) => {
    const split = SplitText.create(title, {
      type: 'words, chars',
      wordsClass: 'split-word',
      charsClass: 'split-char',
      aria: 'auto',
    });

    gsap.set(split.chars, {
      autoAlpha: 0,
      xPercent: () => gsap.utils.random(-18, 18),
      yPercent: (index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        return gsap.utils.random(95, 180) * direction;
      },
      rotation: () => gsap.utils.random(-16, 16),
      scale: .92,
      transformOrigin: '50% 50%',
    });

    titleAnimations.set(title, { split, played: false });
  });

  function animateTitle(title) {
    const entry = titleAnimations.get(title);
    if (!entry || entry.played) return;

    entry.played = true;
    title.dataset.splitAnimated = 'true';

    gsap.to(entry.split.chars, {
      autoAlpha: 1,
      xPercent: 0,
      yPercent: 0,
      rotation: 0,
      scale: 1,
      duration: .84,
      ease: 'back.out(1.2)',
      stagger: {
        each: .015,
        from: 'start',
      },
      clearProps: 'transform,opacity,visibility',
    });
  }

  function animatePanel(panel) {
    if (!(panel instanceof Element)) return;
    const title = panel.querySelector('[data-split-title]');
    if (title) animateTitle(title);
  }

  document.addEventListener('localbarber:panel-active', (event) => {
    animatePanel(event.detail?.panel);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animatePanel(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    threshold: .35,
    rootMargin: '0px 0px -8% 0px',
  });

  document.querySelectorAll('[data-scroll-panel]').forEach((panel) => observer.observe(panel));

  requestAnimationFrame(() => {
    const activePanel = document.querySelector('[data-scroll-panel].is-active');
    animatePanel(activePanel || document.querySelector('[data-scroll-panel]'));
  });
})();
