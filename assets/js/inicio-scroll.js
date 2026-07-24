(() => {
  const home = document.getElementById('horizontalHome');
  const track = document.getElementById('horizontalTrack');

  if (!home || !track) return;

  const stage = home.querySelector('.horizontal-stage');
  const panels = Array.from(track.querySelectorAll('[data-scroll-panel]'));
  const galleryPanel = panels.find((panel) => panel.id === 'galeria');
  const nav = document.querySelector('nav');
  const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
  const horizontalMedia = window.matchMedia(
    '(min-width: 981px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)'
  );

  let enabled = false;
  let frame = 0;
  let start = 0;
  let distance = 0;
  let scrollDistance = 0;
  let galleryOffset = 0;
  let galleryHoldDistance = 0;
  let stageHeight = 0;
  let activeIndex = -1;
  let snapTimer = 0;
  let snapTween = null;
  let isSnapping = false;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function clearSnapTimer() {
    window.clearTimeout(snapTimer);
    snapTimer = 0;
  }

  function cancelSnap() {
    clearSnapTimer();

    if (snapTween) {
      snapTween.kill();
      snapTween = null;
    }

    isSnapping = false;
  }

  function resetNativeHorizontalScroll() {
    if (stage?.scrollLeft) stage.scrollLeft = 0;

    const scrollingElement = document.scrollingElement;
    if (scrollingElement?.scrollLeft) scrollingElement.scrollLeft = 0;
  }

  function setActivePanel(index) {
    if (index === activeIndex) return;

    activeIndex = index;
    panels.forEach((panel, panelIndex) => {
      panel.classList.toggle('is-active', panelIndex === index);
    });

    document.dispatchEvent(new CustomEvent('localbarber:panel-active', {
      detail: { panel: panels[index], index },
    }));

    const navSection = panels[index]?.dataset.navSection || 'home';
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      const linkSection = href === '#' ? 'home' : href.slice(1);
      const isCurrent = linkSection === navSection;

      link.classList.toggle('is-current', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function render() {
    frame = 0;
    if (!enabled || distance <= 0) return;

    resetNativeHorizontalScroll();

    const scrollPosition = clamp(window.scrollY - start, 0, scrollDistance);
    const holdStart = galleryOffset;
    const holdEnd = holdStart + galleryHoldDistance;
    let translate = scrollPosition;
    let galleryHoldProgress = 0;

    if (galleryHoldDistance > 0 && scrollPosition >= holdStart) {
      if (scrollPosition <= holdEnd) {
        translate = holdStart;
        galleryHoldProgress = (scrollPosition - holdStart) / galleryHoldDistance;
      } else {
        translate = scrollPosition - galleryHoldDistance;
        galleryHoldProgress = 1;
      }
    }

    const progress = clamp(translate / distance, 0, 1);
    const panelPosition = progress * (panels.length - 1);
    const nextActiveIndex = clamp(Math.round(panelPosition), 0, panels.length - 1);

    track.style.transform = `translate3d(${-translate}px, 0, 0)`;

    home.classList.toggle('has-progress', progress > 0.035);
    setActivePanel(nextActiveIndex);

    document.dispatchEvent(new CustomEvent('localbarber:scroll-progress', {
      detail: {
        progress,
        panelPosition,
        activeIndex: nextActiveIndex,
        galleryHoldProgress: clamp(galleryHoldProgress, 0, 1),
      },
    }));
  }

  function requestRender() {
    if (frame) return;
    frame = window.requestAnimationFrame(render);
  }

  function disableHorizontalScroll() {
    cancelSnap();
    enabled = false;
    activeIndex = -1;
    scrollDistance = 0;
    galleryOffset = 0;
    galleryHoldDistance = 0;
    home.classList.remove('is-horizontal', 'has-progress');
    document.documentElement.classList.remove('horizontal-scroll-enabled');
    document.body.classList.remove('horizontal-scroll-enabled');
    home.style.removeProperty('height');
    track.style.removeProperty('transform');
    panels.forEach((panel) => panel.classList.remove('is-active'));
  }

  function measure() {
    cancelSnap();

    if (!horizontalMedia.matches) {
      disableHorizontalScroll();
      return;
    }

    enabled = true;
    home.classList.add('is-horizontal');
    document.documentElement.classList.add('horizontal-scroll-enabled');
    document.body.classList.add('horizontal-scroll-enabled');

    const navHeight = nav?.offsetHeight || 72;
    stageHeight = Math.max(window.innerHeight - navHeight, 548);
    distance = Math.max(track.scrollWidth - window.innerWidth, 0);
    galleryOffset = galleryPanel ? clamp(galleryPanel.offsetLeft, 0, distance) : 0;
    galleryHoldDistance = galleryPanel
      ? clamp(window.innerWidth * 0.82, 900, 1500)
      : 0;
    scrollDistance = distance + galleryHoldDistance;
    home.style.height = `${stageHeight + scrollDistance}px`;
    start = home.offsetTop - navHeight;

    resetNativeHorizontalScroll();
    requestRender();
  }

  function panelScrollPosition(panel) {
    if (!enabled || distance <= 0) return null;

    const panelOffset = clamp(panel.offsetLeft, 0, distance);
    const holdAdjustment = panelOffset > galleryOffset ? galleryHoldDistance : 0;
    return start + panelOffset + holdAdjustment;
  }

  function snapToNearestPanel() {
    snapTimer = 0;

    if (
      !enabled
      || isSnapping
      || !window.gsap
      || document.body.classList.contains('login-modal-open')
    ) return;

    const current = window.scrollY;
    const homeStart = start;
    const homeEnd = start + scrollDistance;

    if (current < homeStart - 12 || current > homeEnd + 12) return;

    const holdStart = start + galleryOffset;
    const holdEnd = holdStart + galleryHoldDistance;
    const isExploringGallery = galleryHoldDistance > 0
      && current > holdStart + 18
      && current < holdEnd - 18;

    if (isExploringGallery) return;

    const targets = panels
      .map(panelScrollPosition)
      .filter((value) => Number.isFinite(value));

    if (galleryHoldDistance > 0) targets.push(holdEnd);
    if (!targets.length) return;

    const target = targets.reduce((nearest, value) => (
      Math.abs(value - current) < Math.abs(nearest - current) ? value : nearest
    ));
    const delta = Math.abs(target - current);

    if (delta < 4) return;

    const position = { value: current };
    isSnapping = true;

    snapTween = window.gsap.to(position, {
      value: target,
      duration: clamp(delta / 1400, .42, .82),
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => {
        window.scrollTo(0, position.value);
        requestRender();
      },
      onComplete: () => {
        snapTween = null;
        isSnapping = false;
        requestRender();
      },
      onInterrupt: () => {
        snapTween = null;
        isSnapping = false;
      },
    });
  }

  function scheduleSnap() {
    if (!enabled || isSnapping) return;
    clearSnapTimer();
    snapTimer = window.setTimeout(snapToNearestPanel, 190);
  }

  function navigateToPanel(event) {
    const href = event.currentTarget.getAttribute('href');
    if (!href?.startsWith('#')) return;

    const id = href === '#' ? 'home' : href.slice(1);
    const panel = panels.find((item) => item.id === id);
    if (!panel || !enabled) return;

    const target = panelScrollPosition(panel);
    if (target === null) return;

    event.preventDefault();
    cancelSnap();
    resetNativeHorizontalScroll();
    window.scrollTo({ left: 0, top: target, behavior: 'smooth' });
  }

  function navigateToLocationHash(behavior = 'auto') {
    if (!enabled || !window.location.hash) return;

    const panel = panels.find((item) => `#${item.id}` === window.location.hash);
    const target = panel ? panelScrollPosition(panel) : null;
    if (target === null) return;

    cancelSnap();
    resetNativeHorizontalScroll();
    window.scrollTo({ left: 0, top: target, behavior });

    window.requestAnimationFrame(() => {
      resetNativeHorizontalScroll();
      requestRender();
    });
  }

  document
    .querySelectorAll('.nav-logo, .nav-links a, .hero-actions a[href^="#"]')
    .forEach((link) => link.addEventListener('click', navigateToPanel));

  window.addEventListener('scroll', () => {
    requestRender();
    scheduleSnap();
  }, { passive: true });
  window.addEventListener('wheel', cancelSnap, { passive: true });
  window.addEventListener('touchstart', cancelSnap, { passive: true });
  window.addEventListener('pointerdown', cancelSnap, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', () => {
    measure();
    navigateToLocationHash('auto');
  });

  window.addEventListener('hashchange', () => navigateToLocationHash('smooth'));

  horizontalMedia.addEventListener('change', measure);
  measure();
})();
