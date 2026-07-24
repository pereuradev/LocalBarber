(() => {
  const modal = document.getElementById('modal');
  const box = modal?.querySelector('.login-modal');
  const aside = modal?.querySelector('.login-aside');
  const panel = modal?.querySelector('.login-panel');
  const closeButton = modal?.querySelector('.modal-close');
  const emailInput = document.getElementById('login-email');

  if (!modal || !box || !aside || !panel || !closeButton) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const asideItems = Array.from(aside.querySelectorAll(
    '.login-aside-top, .login-aside-copy > *, .login-mini-list span',
  ));
  const panelItems = Array.from(panel.querySelectorAll(
    '.login-mobile-brand, .login-heading > *, .google-auth-button, .social-auth-buttons, .login-auth-divider, .login-field, .form-check-container, .btnentrar, .login-footer',
  ));

  let timeline = null;
  let lastFocusedElement = null;

  function finishClose() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('login-modal-open');

    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    lastFocusedElement = null;
  }

  function buildTimeline() {
    if (reduceMotion || !window.gsap) return null;

    return window.gsap.timeline({
      paused: true,
      defaults: { ease: 'power3.out' },
      onComplete: () => emailInput?.focus(),
      onReverseComplete: finishClose,
    })
      .fromTo(modal, {
        autoAlpha: 0,
      }, {
        autoAlpha: 1,
        duration: .28,
      }, 0)
      .fromTo(box, {
        autoAlpha: 0,
        y: 46,
        scale: .945,
        rotationX: 3,
        transformPerspective: 1000,
      }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        rotationX: 0,
        duration: .62,
        ease: 'back.out(1.08)',
      }, .03)
      .fromTo(aside, {
        autoAlpha: 0,
        xPercent: -14,
        clipPath: 'inset(0 100% 0 0)',
      }, {
        autoAlpha: 1,
        xPercent: 0,
        clipPath: 'inset(0 0% 0 0)',
        duration: .58,
      }, .1)
      .fromTo(asideItems, {
        autoAlpha: 0,
        x: -28,
      }, {
        autoAlpha: 1,
        x: 0,
        duration: .42,
        stagger: .055,
      }, .24)
      .fromTo(panel, {
        autoAlpha: 0,
        x: 34,
      }, {
        autoAlpha: 1,
        x: 0,
        duration: .5,
      }, .14)
      .fromTo(panelItems, {
        autoAlpha: 0,
        y: 18,
      }, {
        autoAlpha: 1,
        y: 0,
        duration: .4,
        stagger: .045,
      }, .28)
      .fromTo(closeButton, {
        autoAlpha: 0,
        scale: .7,
        rotation: -42,
      }, {
        autoAlpha: 1,
        scale: 1,
        rotation: 0,
        duration: .34,
        ease: 'back.out(1.7)',
      }, .44);
  }

  function openModal() {
    if (modal.getAttribute('aria-hidden') === 'false') return;

    lastFocusedElement = document.activeElement;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('login-modal-open');

    if (reduceMotion || !window.gsap) {
      emailInput?.focus();
      return;
    }

    if (!timeline) timeline = buildTimeline();
    timeline.timeScale(1).restart();
  }

  function closeModal() {
    if (modal.getAttribute('aria-hidden') === 'true') return;

    if (reduceMotion || !window.gsap || !timeline) {
      finishClose();
      return;
    }

    timeline.timeScale(1.35).reverse();
  }

  function togglePassword(button) {
    const field = document.getElementById('login-password');
    if (!field) return;

    const showPassword = field.type === 'password';
    field.type = showPassword ? 'text' : 'password';
    button.classList.toggle('is-visible', showPassword);
    button.setAttribute('aria-label', showPassword ? 'Ocultar senha' : 'Mostrar senha');
    button.setAttribute('aria-pressed', String(showPassword));
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || modal.getAttribute('aria-hidden') === 'true') return;

    const focusable = Array.from(modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  window.abrirModal = openModal;
  window.fecharModal = closeModal;
  window.alternarSenhaLogin = togglePassword;

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
    trapFocus(event);
  });
})();
