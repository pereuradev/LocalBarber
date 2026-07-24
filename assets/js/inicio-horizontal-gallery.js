(() => {
  const gallery = document.querySelector('[data-horizontal-gallery]');
  const section = document.getElementById('galeria');
  const viewport = gallery?.querySelector('.scroll-gallery-viewport');
  const track = gallery?.querySelector('.scroll-gallery-track');
  const cards = Array.from(gallery?.querySelectorAll('.scroll-gallery-card') || []);

  if (!gallery || !section || !viewport || !track || !cards.length || !window.gsap) return;

  const horizontalMedia = window.matchMedia(
    '(min-width: 981px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)',
  );
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let travel = 0;
  let revealed = false;
  let floatTweens = [];

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function startFloating() {
    if (reduceMotion || floatTweens.length) return;

    floatTweens = cards.map((card, index) => window.gsap.to(card, {
      y: index % 2 === 0 ? -9 : -13,
      rotation: index === 1 ? .45 : -.35,
      duration: 2.7 + (index * .35),
      delay: index * .16,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      overwrite: 'auto',
    }));
  }

  function revealGallery() {
    if (revealed) return;
    revealed = true;
    gallery.classList.add('is-revealed');

    if (reduceMotion) return;

    window.gsap.to(cards, {
      autoAlpha: 1,
      y: 0,
      rotation: 0,
      scale: 1,
      duration: .88,
      ease: 'back.out(1.18)',
      stagger: .12,
      overwrite: 'auto',
      onComplete: startFloating,
    });
  }

  function measure() {
    travel = Math.max(track.scrollWidth - viewport.clientWidth, 0);

    if (horizontalMedia.matches) viewport.scrollLeft = 0;
  }

  function moveGallery(progress) {
    if (!horizontalMedia.matches) return;

    const localProgress = clamp(progress, 0, 1);

    window.gsap.to(track, {
      x: -travel * localProgress,
      duration: 0.34,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  document.addEventListener('localbarber:scroll-progress', (event) => {
    moveGallery(event.detail.galleryHoldProgress);
  });

  document.addEventListener('localbarber:panel-active', (event) => {
    if (event.detail?.panel === section) revealGallery();
  });

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    revealGallery();
    observer.disconnect();
  }, {
    threshold: .32,
    rootMargin: '0px 0px -8% 0px',
  });

  observer.observe(section);
  window.addEventListener('resize', measure);
  horizontalMedia.addEventListener('change', () => {
    measure();

    if (!horizontalMedia.matches) {
      window.gsap.killTweensOf(track);
      window.gsap.set(track, { clearProps: 'transform' });
    }
  });

  if (!reduceMotion) {
    window.gsap.set(cards, {
      autoAlpha: 0,
      y: (index) => 58 + (index * 14),
      rotation: (index) => index % 2 === 0 ? -2.2 : 2.2,
      scale: .94,
    });
  }

  measure();
})();
