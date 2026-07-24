(() => {
  const stage = document.querySelector('[data-mascot-stage]');
  const hero = document.getElementById('home');
  const image = stage?.querySelector('.hero-mascot-image');
  const aura = stage?.querySelector('.hero-mascot-aura');
  const scan = stage?.querySelector('.hero-mascot-scan');

  if (!stage || !hero || !image || !aura || !scan || !window.gsap) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let played = false;
  let auraTween = null;

  function setAmbientState(active) {
    if (!auraTween) return;
    if (active) auraTween.resume();
    else auraTween.pause();
  }

  function startAmbientMotion() {
    if (reduceMotion || auraTween) return;

    auraTween = window.gsap.to(aura, {
      scale: 1.08,
      autoAlpha: .88,
      duration: 2.4,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      overwrite: 'auto',
    });
  }

  function revealMascot() {
    if (played) {
      setAmbientState(true);
      return;
    }

    played = true;

    if (reduceMotion) {
      window.gsap.set([image, aura], { autoAlpha: 1, clearProps: 'transform,clipPath' });
      return;
    }

    const timeline = window.gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: startAmbientMotion,
    });

    timeline
      .fromTo(aura, {
        autoAlpha: 0,
        scale: .58,
      }, {
        autoAlpha: .72,
        scale: 1,
        duration: 1.05,
      }, 0)
      .fromTo(image, {
        autoAlpha: 0,
        x: 126,
        y: 24,
        scale: .93,
        clipPath: 'inset(0 0 0 100%)',
      }, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        clipPath: 'inset(0 0 0 0%)',
        duration: 1.18,
        ease: 'power4.out',
        clearProps: 'transform,clipPath,opacity,visibility',
      }, .12)
      .fromTo(scan, {
        autoAlpha: 0,
        xPercent: -112,
      }, {
        autoAlpha: .72,
        xPercent: 112,
        duration: .92,
        ease: 'power2.inOut',
      }, .58)
      .to(scan, {
        autoAlpha: 0,
        duration: .22,
        clearProps: 'transform,opacity,visibility',
      }, '>-0.2');
  }

  document.addEventListener('localbarber:panel-active', (event) => {
    const isHeroActive = event.detail?.panel === hero;
    if (isHeroActive) revealMascot();
    else setAmbientState(false);
  });

  document.addEventListener('visibilitychange', () => {
    setAmbientState(!document.hidden && hero.classList.contains('is-active'));
  });

  window.requestAnimationFrame(revealMascot);
})();
