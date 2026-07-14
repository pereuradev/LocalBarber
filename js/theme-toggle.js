(function () {
  const storageKey = "localbarber-theme";
  let transitionTimer;

  function enableThemeTransition() {
    window.clearTimeout(transitionTimer);
    document.documentElement.classList.add("theme-transition");
    transitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 460);
  }

  function createThemeButton() {
    let button = document.getElementById("themeToggle");
    if (button) return button;

    button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.id = "themeToggle";
    button.setAttribute("aria-label", "Ativar modo escuro");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">&#9790;</span><span class="theme-toggle-text">Tema</span>';

    const topbarActions = document.querySelector(".topbar-right");
    const navActions = document.querySelector(".nav-cta, .nav-actions");

    if (topbarActions) {
      topbarActions.insertBefore(button, topbarActions.firstChild);
      return button;
    }

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

  function setTheme(theme, animate) {
    const button = document.getElementById("themeToggle");
    const themeText = button && button.querySelector(".theme-toggle-text");
    const themeIcon = button && button.querySelector(".theme-toggle-icon");
    const isDark = theme === "dark";

    if (animate) enableThemeTransition();
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    document.body.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);

    if (!button) return;
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
    if (themeText) themeText.textContent = isDark ? "Claro" : "Escuro";
    if (themeIcon) themeIcon.innerHTML = isDark ? "&#9728;" : "&#9790;";
  }

  function initThemeToggle() {
    const button = createThemeButton();
    setTheme(localStorage.getItem(storageKey) || "light", false);

    if (button.dataset.themeToggleReady === "true") return;
    button.dataset.themeToggleReady = "true";
    button.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme, true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
