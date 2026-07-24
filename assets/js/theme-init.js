(function () {
  try {
    const preference = localStorage.getItem("localbarber-theme") || "system";
    const validPreference = ["light", "dark", "system"].includes(preference) ? preference : "system";
    const theme = validPreference === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : validPreference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
})();
