(function () {
  const storageKey = "localbarber-theme";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let transitionTimer;
  let selectedTheme = "system";

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
    const preference = ["light", "dark", "system"].includes(theme) ? theme : "system";
    const resolvedTheme = preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference;
    const isDark = resolvedTheme === "dark";

    if (animate) enableThemeTransition();
    selectedTheme = preference;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.body.dataset.theme = resolvedTheme;
    localStorage.setItem(storageKey, preference);

    if (!button) return;
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", preference === "system" ? "Tema do sistema ativo" : (isDark ? "Ativar modo claro" : "Ativar modo escuro"));
    if (themeText) themeText.textContent = preference === "system" ? "Sistema" : (isDark ? "Claro" : "Escuro");
    if (themeIcon) themeIcon.innerHTML = preference === "system" ? "&#9635;" : (isDark ? "&#9728;" : "&#9790;");
  }

  function initThemeToggle() {
    const button = createThemeButton();
    setTheme(localStorage.getItem(storageKey) || "system", false);

    if (button.dataset.themeToggleReady === "true") return;
    button.dataset.themeToggleReady = "true";
    button.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme, true);
    });

    const followSystemTheme = () => {
      if (selectedTheme === "system") setTheme("system", true);
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
