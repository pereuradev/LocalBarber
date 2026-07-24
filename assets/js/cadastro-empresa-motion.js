(() => {
  const gsapApi = window.gsap;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!gsapApi || reduceMotion) return;

  const container = document.querySelector(".form-container");
  const badge = document.querySelector(".form-badge");
  const subtitle = document.querySelector(".form-subtitle");
  const sections = Array.from(document.querySelectorAll(".form-section"));
  const submit = document.querySelector(".btn-cadastrar");
  const mascots = Array.from(document.querySelectorAll(".cadastro-mascote"));

  if (!container) return;

  document.body.classList.add("cadastro-motion-ready");

  gsapApi.set(container, { autoAlpha: 0, y: 28, scale: .985 });
  gsapApi.set([badge, subtitle].filter(Boolean), { autoAlpha: 0, y: 18 });
  gsapApi.set(sections, { autoAlpha: 0, y: 34, scale: .985 });
  gsapApi.set(submit, { autoAlpha: 0, y: 18 });
  gsapApi.set(mascots, { autoAlpha: 0, x: 90, scale: .96, transformOrigin: "50% 70%" });

  function initEntrance() {
    const timeline = gsapApi.timeline({ defaults: { overwrite: "auto" } });

    timeline
      .to(container, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: .72,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility"
      }, 0)
      .to(mascots, {
        autoAlpha: 1,
        x: 0,
        scale: 1,
        duration: .9,
        stagger: .025,
        ease: "back.out(1.12)",
        clearProps: "transform,opacity,visibility"
      }, .13)
      .to([badge, subtitle].filter(Boolean), {
        autoAlpha: 1,
        y: 0,
        duration: .5,
        stagger: .08,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility"
      }, .18)
      .to(sections, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: .62,
        stagger: .085,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility"
      }, .28)
      .to(submit, {
        autoAlpha: 1,
        y: 0,
        duration: .52,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility"
      }, .56);
  }

  function initMagneticControls() {
    const media = gsapApi.matchMedia();

    media.add("(hover: hover) and (pointer: fine)", () => {
      const controls = gsapApi.utils.toArray(".theme-toggle, .btn-consultar-cnpj, .btn-cadastrar");
      const cleanups = [];

      controls.forEach((control) => {
        let restingRect = null;

        const rememberPosition = () => {
          restingRect = control.getBoundingClientRect();
          gsapApi.set(control, { willChange: "transform" });
        };

        const followPointer = (event) => {
          if (!restingRect) rememberPosition();
          const centerX = restingRect.left + restingRect.width / 2;
          const centerY = restingRect.top + restingRect.height / 2;

          gsapApi.to(control, {
            x: gsapApi.utils.clamp(-13, 13, (event.clientX - centerX) * .22),
            y: gsapApi.utils.clamp(-13, 13, (event.clientY - centerY) * .22),
            duration: .34,
            ease: "power3.out",
            overwrite: "auto"
          });
        };

        const returnToCenter = () => {
          restingRect = null;
          gsapApi.to(control, {
            x: 0,
            y: 0,
            duration: .68,
            ease: "elastic.out(1, .42)",
            overwrite: "auto",
            onComplete: () => gsapApi.set(control, { willChange: "auto" })
          });
        };

        control.addEventListener("pointerenter", rememberPosition);
        control.addEventListener("pointermove", followPointer);
        control.addEventListener("pointerleave", returnToCenter);

        cleanups.push(() => {
          control.removeEventListener("pointerenter", rememberPosition);
          control.removeEventListener("pointermove", followPointer);
          control.removeEventListener("pointerleave", returnToCenter);
          gsapApi.killTweensOf(control);
          gsapApi.set(control, { clearProps: "transform,willChange" });
        });
      });

      return () => cleanups.forEach((cleanup) => cleanup());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initEntrance();
      initMagneticControls();
    }, { once: true });
  } else {
    initEntrance();
    initMagneticControls();
  }
})();
