(() => {
  if (!window.gsap) return;

  function initMagneticButtons() {
    const magneticMedia = window.gsap.matchMedia();

    magneticMedia.add(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      () => {
        const buttons = window.gsap.utils.toArray('.btn, .btnentrar');
        const cleanups = [];

        buttons.forEach((button) => {
          let restingRect = null;

          const rememberPosition = () => {
            restingRect = button.getBoundingClientRect();
            window.gsap.set(button, { willChange: 'transform' });
          };

          const followPointer = (event) => {
            if (!restingRect) rememberPosition();

            const centerX = restingRect.left + restingRect.width / 2;
            const centerY = restingRect.top + restingRect.height / 2;
            const maxDistance = button.classList.contains('btn-hero') ? 18 : 13;
            const strength = button.classList.contains('btn-hero') ? 0.28 : 0.22;
            const x = window.gsap.utils.clamp(
              -maxDistance,
              maxDistance,
              (event.clientX - centerX) * strength,
            );
            const y = window.gsap.utils.clamp(
              -maxDistance,
              maxDistance,
              (event.clientY - centerY) * strength,
            );

            window.gsap.to(button, {
              x,
              y,
              duration: 0.34,
              ease: 'power3.out',
              overwrite: 'auto',
            });
          };

          const returnToCenter = () => {
            restingRect = null;

            window.gsap.to(button, {
              x: 0,
              y: 0,
              duration: 0.68,
              ease: 'elastic.out(1, 0.42)',
              overwrite: 'auto',
              onComplete: () => window.gsap.set(button, { willChange: 'auto' }),
            });
          };

          button.classList.add('magnetic-button');
          button.addEventListener('pointerenter', rememberPosition);
          button.addEventListener('pointermove', followPointer);
          button.addEventListener('pointerleave', returnToCenter);

          cleanups.push(() => {
            button.classList.remove('magnetic-button');
            button.removeEventListener('pointerenter', rememberPosition);
            button.removeEventListener('pointermove', followPointer);
            button.removeEventListener('pointerleave', returnToCenter);
            window.gsap.killTweensOf(button);
            window.gsap.set(button, { clearProps: 'transform,willChange' });
          });
        });

        return () => cleanups.forEach((cleanup) => cleanup());
      },
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMagneticButtons, { once: true });
  } else {
    initMagneticButtons();
  }
})();
