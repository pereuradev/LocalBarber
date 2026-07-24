(function () {
  const pageIds = ["sobre", "termos", "privacidade", "contato", "seguranca", "faq"];
  let currentPage = "sobre";

  function normalizedPage(id) {
    return pageIds.includes(id) ? id : "sobre";
  }

  function updateNavigation(id) {
    document.querySelectorAll(".sidebar-nav a").forEach((link) => {
      const targetId = link.dataset.infoLink || link.getAttribute("onclick")?.match(/showPage\('([^']+)'\)/)?.[1];
      const isActive = targetId === id;

      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  function showPage(id, options) {
    const targetId = normalizedPage(id);
    const settings = Object.assign({ updateHistory: true, scroll: true }, options);
    const target = document.getElementById(`page-${targetId}`);

    if (!target) return;

    pageIds.forEach((pageId) => {
      const page = document.getElementById(`page-${pageId}`);
      if (page) {
        const isActive = pageId === targetId;
        page.classList.toggle("active", isActive);
        page.setAttribute("aria-hidden", String(!isActive));
      }
    });

    currentPage = targetId;
    updateNavigation(targetId);

    document.dispatchEvent(new CustomEvent("localbarber:panel-active", {
      detail: { panel: target, id: targetId }
    }));

    if (settings.updateHistory) {
      window.history.pushState({ informationPage: targetId }, "", `#${targetId}`);
    }

    if (settings.scroll) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }

    if (settings.scroll) {
      window.setTimeout(() => {
        target.querySelector(".page-title")?.focus({ preventScroll: true });
      }, 360);
    }
  }

  function toggleFaq(question) {
    const item = question.closest(".faq-item");
    if (!item) return;

    const willOpen = !item.classList.contains("open");
    item.classList.toggle("open", willOpen);
    question.setAttribute("aria-expanded", String(willOpen));
  }

  function submitForm() {
    const name = document.getElementById("c-name")?.value.trim();
    const email = document.getElementById("c-email")?.value.trim();
    const message = document.getElementById("c-msg")?.value.trim();

    if (!name || !email || !message) {
      window.alert("Preencha nome, e-mail e mensagem antes de enviar.");
      return;
    }

    const alertBox = document.getElementById("form-alert");
    if (alertBox) {
      alertBox.classList.add("show");
      alertBox.setAttribute("role", "status");
    }

    ["c-name", "c-email", "c-msg"].forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) field.value = "";
    });
  }

  function prepareControls() {
    document.querySelectorAll(".sidebar-nav a").forEach((link) => {
      const match = link.getAttribute("onclick")?.match(/showPage\('([^']+)'\)/);
      if (!match) return;

      const id = match[1];
      link.dataset.infoLink = id;
      link.setAttribute("href", `#${id}`);
      link.removeAttribute("onclick");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showPage(id);
      });
    });

    document.querySelectorAll(".info-footer-links [data-info-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showPage(link.dataset.infoLink);
      });
    });

    document.querySelectorAll(".faq-q").forEach((question, index) => {
      question.setAttribute("role", "button");
      question.setAttribute("tabindex", "0");
      question.setAttribute("aria-expanded", "false");
      question.setAttribute("aria-controls", `faq-answer-${index + 1}`);
      question.nextElementSibling?.setAttribute("id", `faq-answer-${index + 1}`);
      question.removeAttribute("onclick");
      question.addEventListener("click", () => toggleFaq(question));
      question.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleFaq(question);
        }
      });
    });

    document.querySelectorAll(".page-title").forEach((title) => title.setAttribute("tabindex", "-1"));
  }

  window.showPage = showPage;
  window.toggleFaq = toggleFaq;
  window.submitForm = submitForm;

  document.addEventListener("DOMContentLoaded", () => {
    prepareControls();
    const initialPage = normalizedPage(window.location.hash.slice(1));
    showPage(initialPage, { updateHistory: false, scroll: false });
    window.history.replaceState({ informationPage: initialPage }, "", `#${initialPage}`);
  });

  window.addEventListener("popstate", () => {
    const targetPage = normalizedPage(window.location.hash.slice(1));
    if (targetPage !== currentPage) {
      showPage(targetPage, { updateHistory: false, scroll: true });
    }
  });
})();
