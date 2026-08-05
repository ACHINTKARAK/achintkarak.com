(function () {
  "use strict";

  const THEME_KEY = "ak_theme";
  const html = document.documentElement;

  function readTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch (error) {
      // localStorage may be unavailable in privacy-restricted contexts.
    }

    return "light";
  }

  function applyTheme(theme) {
    html.setAttribute("data-theme", theme);

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // The page still works when localStorage is unavailable.
    }

    const themeButton = document.getElementById("themeToggle");
    if (themeButton) {
      themeButton.textContent = theme === "dark" ? "Light" : "Dark";
    }
  }

  // Apply the saved theme immediately because this script is loaded in <head>.
  applyTheme(readTheme());

  function initializeControls() {
    const themeButton = document.getElementById("themeToggle");
    const settingsToggle = document.getElementById("settingsToggle");
    const settingsMenu = document.getElementById("settingsMenu");

    // Refresh the button label now that the body exists.
    applyTheme(html.getAttribute("data-theme") || "light");

    if (themeButton) {
      themeButton.addEventListener("click", function (event) {
        event.stopPropagation();

        const current = html.getAttribute("data-theme") || "light";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }

    function closeMenu() {
      if (!settingsMenu || !settingsToggle) {
        return;
      }

      settingsMenu.hidden = true;
      settingsToggle.setAttribute("aria-expanded", "false");
    }

    if (settingsToggle && settingsMenu) {
      settingsToggle.addEventListener("click", function (event) {
        event.stopPropagation();

        const shouldOpen = settingsMenu.hidden;
        settingsMenu.hidden = !shouldOpen;
        settingsToggle.setAttribute(
          "aria-expanded",
          shouldOpen ? "true" : "false"
        );
      });

      settingsMenu.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      document.addEventListener("click", function (event) {
        if (
          !settingsMenu.hidden &&
          !event.target.closest(".settings")
        ) {
          closeMenu();
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeMenu();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeControls);
  } else {
    initializeControls();
  }
})();
