(function () {
  "use strict";

  const storageKey = "localbarber-theme";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const themeLabels = { light: "Claro", dark: "Escuro", system: "Sistema" };
  const themeIcons = {
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M20.7 13.1A8 8 0 1 1 10.9 3.3a6.5 6.5 0 0 0 9.8 9.8Z"/></svg>',
    system: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  };
  let transitionTimer;
  let selectedTheme = "system";
  let themeControl;

  function enableThemeTransition() {
    window.clearTimeout(transitionTimer);
    document.documentElement.classList.add("theme-transition");
    transitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 460);
  }

  function normalizeTheme(theme) {
    return ["light", "dark", "system"].includes(theme) ? theme : "system";
  }

  function resolveTheme(theme) {
    return theme === "system" ? (systemTheme.matches ? "dark" : "light") : theme;
  }

  function createSimpleThemeButton() {
    let button = document.getElementById("themeToggle");
    if (button) return button;

    button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.id = "themeToggle";
    button.setAttribute("aria-label", "Ativar modo escuro");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">&#9790;</span><span class="theme-toggle-text">Tema</span>';

    const navActions = document.querySelector(".nav-cta, .nav-actions");
    if (navActions) {
      navActions.appendChild(button);
      return button;
    }

    const nav = document.querySelector("nav");
    if (nav) {
      const actions = document.createElement("div");
      actions.className = "nav-cta";
      actions.appendChild(button);
      nav.appendChild(actions);
    }

    return button;
  }

  function createThemeSelector() {
    const topbarActions = document.querySelector(".topbar-right");
    if (!topbarActions) {
      return { type: "simple", button: createSimpleThemeButton() };
    }

    let selector = document.getElementById("themeSelector");
    if (!selector) {
      selector = document.createElement("div");
      selector.className = "theme-selector";
      selector.id = "themeSelector";
      selector.innerHTML = `
        <button type="button" class="theme-selector-trigger" id="themeToggle"
                aria-haspopup="menu" aria-expanded="false" aria-controls="themeMenu"
                aria-label="Tema atual: Sistema. Alterar tema">
          <span class="theme-selector-current-icon" data-theme-icon aria-hidden="true">
            ${themeIcons.system}
          </span>
          <span class="theme-selector-label" data-theme-label>Sistema</span>
          <svg class="theme-selector-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
        <div class="theme-selector-menu" id="themeMenu" role="menu" aria-label="Escolher tema" hidden>
          ${Object.entries(themeLabels).map(([theme, label]) => `
            <button type="button" class="theme-selector-option" role="menuitemradio"
                    aria-checked="${theme === "system"}" data-theme-option="${theme}">
              ${themeIcons[theme]}
              <span>${label}</span>
              <svg class="theme-selector-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
            </button>`).join("")}
        </div>`;
      topbarActions.insertBefore(selector, topbarActions.firstChild);
    }

    return {
      type: "selector",
      selector,
      button: selector.querySelector("#themeToggle"),
      menu: selector.querySelector("#themeMenu"),
      text: selector.querySelector("[data-theme-label]"),
      icon: selector.querySelector("[data-theme-icon]"),
      options: Array.from(selector.querySelectorAll("[data-theme-option]")),
    };
  }

  function updateThemeControl(theme, resolvedTheme) {
    if (!themeControl?.button) return;

    if (themeControl.type === "selector") {
      themeControl.text.textContent = themeLabels[theme];
      themeControl.icon.innerHTML = themeIcons[theme];
      themeControl.button.setAttribute("aria-label", `Tema atual: ${themeLabels[theme]}. Alterar tema`);
      themeControl.options.forEach((option) => {
        const isSelected = option.dataset.themeOption === theme;
        option.classList.toggle("is-active", isSelected);
        option.setAttribute("aria-checked", String(isSelected));
      });
      return;
    }

    const isDark = resolvedTheme === "dark";
    const themeText = themeControl.button.querySelector(".theme-toggle-text");
    const themeIcon = themeControl.button.querySelector(".theme-toggle-icon");
    themeControl.button.setAttribute("aria-pressed", String(isDark));
    themeControl.button.setAttribute(
      "aria-label",
      theme === "system" ? "Tema do sistema ativo" : (isDark ? "Ativar modo claro" : "Ativar modo escuro")
    );
    if (themeText) themeText.textContent = theme === "system" ? "Sistema" : (isDark ? "Claro" : "Escuro");
    if (themeIcon) themeIcon.innerHTML = theme === "system" ? "&#9635;" : (isDark ? "&#9728;" : "&#9790;");
  }

  function setTheme(theme, animate, persist = true) {
    const preference = normalizeTheme(theme);
    const resolvedTheme = resolveTheme(preference);
    if (animate) enableThemeTransition();
    selectedTheme = preference;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.body.dataset.theme = resolvedTheme;
    if (persist) localStorage.setItem(storageKey, preference);
    updateThemeControl(preference, resolvedTheme);
  }

  function closeThemeMenu(returnFocus = false) {
    if (themeControl.type !== "selector") return;
    themeControl.menu.hidden = true;
    themeControl.button.setAttribute("aria-expanded", "false");
    themeControl.selector.classList.remove("is-open");
    if (returnFocus) themeControl.button.focus();
  }

  function openThemeMenu(focusSelected = false) {
    if (themeControl.type !== "selector") return;
    themeControl.menu.hidden = false;
    themeControl.button.setAttribute("aria-expanded", "true");
    themeControl.selector.classList.add("is-open");
    if (focusSelected) {
      const selectedOption = themeControl.menu.querySelector(".is-active") || themeControl.options[0];
      window.requestAnimationFrame(() => selectedOption.focus());
    }
  }

  function configureThemeSelector() {
    const { button, menu, options, selector } = themeControl;
    button.addEventListener("click", () => {
      if (menu.hidden) openThemeMenu();
      else closeThemeMenu();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      if (menu.hidden) openThemeMenu(true);
    });
    options.forEach((option) => {
      option.addEventListener("click", () => {
        setTheme(option.dataset.themeOption, true);
        closeThemeMenu(true);
      });
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeThemeMenu(true);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = options.indexOf(document.activeElement);
      let nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : currentIndex;
      if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
      if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
      options[nextIndex].focus();
    });
    document.addEventListener("click", (event) => {
      if (!selector.contains(event.target)) closeThemeMenu();
    });
  }

  function initThemeToggle() {
    themeControl = createThemeSelector();
    setTheme(localStorage.getItem(storageKey) || "system", false, false);

    if (themeControl.button.dataset.themeToggleReady === "true") return;
    themeControl.button.dataset.themeToggleReady = "true";

    if (themeControl.type === "selector") {
      configureThemeSelector();
    } else {
      themeControl.button.addEventListener("click", () => {
        const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
        setTheme(nextTheme, true);
      });
    }

    const followSystemTheme = () => {
      if (selectedTheme === "system") setTheme("system", true, false);
    };
    if (typeof systemTheme.addEventListener === "function") systemTheme.addEventListener("change", followSystemTheme);
    else systemTheme.addListener(followSystemTheme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
