(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gsapApi = window.gsap;

  if (reduceMotion || !gsapApi) return;

  document.body.classList.add("motion-ready");

  const preparedPages = new WeakSet();
  const revealedElements = new WeakSet();
  const introTimelines = new WeakMap();
  const revealSelector = [
    ".divider",
    ".section-title",
    ".body-text",
    ".about-origin",
    ".about-section-heading",
    ".about-flow-step",
    ".about-audience",
    ".value-card",
    ".legal-section",
    ".contact-grid > *",
    ".faq-item"
  ].join(",");

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || revealedElements.has(entry.target)) return;

      revealedElements.add(entry.target);
      revealObserver.unobserve(entry.target);

      gsapApi.to(entry.target, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: .72,
        ease: "power3.out",
        overwrite: "auto",
        clearProps: "transform,opacity,visibility",
        onComplete: () => entry.target.classList.add("is-revealed")
      });
    });
  }, {
    threshold: .12,
    rootMargin: "0px 0px -8% 0px"
  });

  function preparePage(page) {
    if (!(page instanceof Element) || preparedPages.has(page)) return;

    preparedPages.add(page);

    page.querySelectorAll(revealSelector).forEach((element, index) => {
      element.classList.add("motion-reveal");
      gsapApi.set(element, {
        autoAlpha: 0,
        y: 44 + Math.min(index % 3, 2) * 8,
        scale: .985
      });
      revealObserver.observe(element);
    });
  }

  function animatePageIntro(page) {
    if (!(page instanceof Element)) return;

    preparePage(page);

    const sidebar = page.querySelector(".sidebar-nav");
    const sidebarTitle = sidebar?.querySelector("h3");
    const links = sidebar ? Array.from(sidebar.querySelectorAll("a")) : [];
    const content = page.querySelector(".sidebar-content");
    const badge = page.querySelector(".page-badge");
    const subtitle = page.querySelector(".page-subtitle");
    const previousTimeline = introTimelines.get(page);

    previousTimeline?.kill();
    gsapApi.killTweensOf([sidebarTitle, ...links, badge, subtitle, content].filter(Boolean));

    if (content) gsapApi.set(content, { "--intro-line": 0 });

    const timeline = gsapApi.timeline({ defaults: { overwrite: "auto" } });

    if (sidebarTitle) {
      timeline.fromTo(sidebarTitle, {
        autoAlpha: 0,
        x: -28
      }, {
        autoAlpha: 1,
        x: 0,
        duration: .58,
        ease: "power3.out"
      }, 0);
    }

    if (links.length) {
      timeline.fromTo(links, {
        autoAlpha: 0,
        x: -22
      }, {
        autoAlpha: 1,
        x: 0,
        duration: .48,
        stagger: .055,
        ease: "power3.out"
      }, .08);
    }

    if (badge) {
      timeline.fromTo(badge, {
        autoAlpha: 0,
        y: 18
      }, {
        autoAlpha: 1,
        y: 0,
        duration: .52,
        ease: "power3.out"
      }, .13);
    }

    if (content) {
      timeline.to(content, {
        "--intro-line": 1,
        duration: .72,
        ease: "power3.inOut"
      }, .08);
    }

    if (subtitle) {
      timeline.fromTo(subtitle, {
        autoAlpha: 0,
        y: 28
      }, {
        autoAlpha: 1,
        y: 0,
        duration: .62,
        ease: "power3.out"
      }, .34);
    }

    introTimelines.set(page, timeline);
  }

  function initMagneticControls() {
    const media = gsapApi.matchMedia();

    media.add(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const controls = gsapApi.utils.toArray(".theme-toggle, .btn-send, .about-button");
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
            const x = gsapApi.utils.clamp(-13, 13, (event.clientX - centerX) * .22);
            const y = gsapApi.utils.clamp(-13, 13, (event.clientY - centerY) * .22);

            gsapApi.to(control, {
              x,
              y,
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
      }
    );
  }

  document.querySelectorAll(".page").forEach(preparePage);
  document.addEventListener("localbarber:panel-active", (event) => {
    animatePageIntro(event.detail?.panel);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initMagneticControls();
    }, { once: true });
  } else {
    animatePageIntro(document.querySelector(".page.active"));
    initMagneticControls();
  }
})();
