(function () {
  const scriptUrl = document.currentScript && document.currentScript.src;
  const appRoot = new URL("../../", scriptUrl || window.location.href);

  function resolveAppUrl(path) {
    return new URL(path, appRoot).href;
  }

  const commands = [
    { title: "Dashboard", detail: "Resumo do dia, equipe e atalhos", group: "Principal", url: "dashboard.php", icon: "D", keywords: "painel inicio resumo home" },
    { title: "Agenda", detail: "Horarios e atendimentos marcados", group: "Principal", url: "pages/agenda.html", icon: "A", keywords: "marcar agendamento horario calendario" },
    { title: "Clientes", detail: "Cadastro e historico dos clientes", group: "Principal", url: "pages/clientes.html", icon: "C", keywords: "cliente telefone contato cadastro" },
    { title: "Servicos", detail: "Precos, duracao e categorias", group: "Principal", url: "pages/servicos.html", icon: "S", keywords: "servico corte barba preco tabela" },
    { title: "Faturamento", detail: "Indicadores, ranking e ticket medio", group: "Financeiro", url: "pages/faturamento.html", icon: "$", keywords: "faturamento receita lucro caixa dinheiro" },
    { title: "Transacoes", detail: "Entradas, saidas e formas de pagamento", group: "Financeiro", url: "pages/transacoes.html", icon: "T", keywords: "transacao despesa pagamento pix credito debito" },
    { title: "Equipe", detail: "Profissionais, cargos e disponibilidade", group: "Gestao", url: "pages/equipe.html", icon: "E", keywords: "barbeiro funcionario equipe profissional" },
    { title: "Minha Barbearia", detail: "Dados da barbearia e configuracoes", group: "Gestao", url: "pages/minha-barbearia.html", icon: "B", keywords: "configuracao barbearia dados loja" },
    { title: "Central de informacoes", detail: "Ajuda, politicas e FAQ", group: "Ajuda", url: "pages/central-informacoes.html", icon: "?", keywords: "ajuda faq termos contato suporte" },
    { title: "Pagina inicial", detail: "Voltar para a vitrine do LocalBarber", group: "Principal", url: "index.html", icon: "L", keywords: "landing home inicio apresentacao" },
    { title: "Cadastrar barbearia", detail: "Abrir o formulario de cadastro", group: "Acoes", url: "cadastro-empresa.php", icon: "+", keywords: "cadastro criar conta empresa barbearia" },
    { title: "Novo servico", detail: "Cadastrar corte, barba ou combo", group: "Acoes", url: "pages/servicos.html", action: "newService", icon: "+", keywords: "novo servico criar preco duracao" },
    { title: "Novo cliente", detail: "Ir para o cadastro de clientes", group: "Acoes", url: "pages/clientes.html", icon: "+", keywords: "novo cliente cadastrar contato" },
    { title: "Novo agendamento", detail: "Ir para a agenda de horarios", group: "Acoes", url: "pages/agenda.html", icon: "+", keywords: "novo agendamento marcar horario" },
    { title: "Alternar tema", detail: "Trocar entre claro e escuro", group: "Acoes", action: "toggleTheme", icon: "*", keywords: "tema claro escuro modo cor" }
  ];

  let activeIndex = 0;
  let activeGroup = "Todos";
  let query = "";
  let elements = {};

  function currentPage() {
    return window.location.pathname;
  }

  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function filteredCommands() {
    const needle = normalize(query);
    return commands.filter(command => {
      const groupMatch = activeGroup === "Todos" || command.group === activeGroup;
      const haystack = normalize([command.title, command.detail, command.group, command.keywords].join(" "));
      return groupMatch && (!needle || haystack.includes(needle));
    });
  }

  function openPalette() {
    elements.overlay.classList.add("is-open");
    window.requestAnimationFrame(() => {
      elements.overlay.classList.add("is-visible");
      elements.input.focus();
      elements.input.select();
    });
  }

  function closePalette() {
    elements.overlay.classList.remove("is-visible");
    window.setTimeout(() => elements.overlay.classList.remove("is-open"), 180);
  }

  function toggleTheme() {
    const button = document.getElementById("themeToggle");
    if (button) {
      button.click();
      return;
    }

    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === "dark" ? "dark" : "light";
    document.body.dataset.theme = next;
    localStorage.setItem("localbarber-theme", next);
  }

  function samePage(url) {
    if (!url) return false;
    return new URL(resolveAppUrl(url)).pathname === currentPage();
  }

  function runCommand(command) {
    if (!command) return;
    closePalette();

    if (command.action === "toggleTheme") {
      toggleTheme();
      return;
    }

    if (command.action === "newService" && samePage(command.url) && typeof window.abrirModal === "function") {
      window.abrirModal();
      return;
    }

    if (command.url) {
      window.location.href = resolveAppUrl(command.url);
    }
  }

  function renderGroups() {
    const groups = ["Todos", ...Array.from(new Set(commands.map(command => command.group)))];
    elements.groups.innerHTML = groups.map(group => `
      <button type="button" class="lb-command-chip${group === activeGroup ? " is-active" : ""}" data-group="${group}">
        ${group}
      </button>
    `).join("");

    elements.groups.querySelectorAll(".lb-command-chip").forEach(button => {
      button.addEventListener("click", () => {
        activeGroup = button.dataset.group;
        activeIndex = 0;
        render();
      });
    });
  }

  function renderResults() {
    const results = filteredCommands();

    if (!results.length) {
      elements.results.innerHTML = '<div class="lb-command-empty">Nenhum resultado encontrado.</div>';
      return;
    }

    activeIndex = Math.max(0, Math.min(activeIndex, results.length - 1));
    elements.results.innerHTML = results.map((command, index) => `
      <button type="button" class="lb-command-item${index === activeIndex ? " is-active" : ""}" data-index="${index}">
        <span class="lb-command-item-icon">${command.icon}</span>
        <span>
          <span class="lb-command-item-title">${command.title}</span>
          <span class="lb-command-item-detail">${command.detail}</span>
        </span>
        <span class="lb-command-item-meta">${command.group}</span>
      </button>
    `).join("");

    elements.results.querySelectorAll(".lb-command-item").forEach(button => {
      button.addEventListener("mouseenter", () => {
        activeIndex = Number(button.dataset.index);
        renderResults();
      });

      button.addEventListener("click", () => runCommand(results[Number(button.dataset.index)]));
    });
  }

  function render() {
    renderGroups();
    renderResults();
  }

  function createMarkup() {
    const root = document.createElement("div");
    root.id = "lb-command-root";
    root.innerHTML = `
      <button type="button" class="lb-command-launcher" id="lbCommandLauncher" aria-label="Abrir busca rapida">
        <span class="lb-command-launcher-icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
          </svg>
        </span>
        <span class="lb-command-launcher-text">Busca rapida</span>
      </button>

      <div class="lb-command-overlay" id="lbCommandOverlay" role="dialog" aria-modal="true" aria-label="Busca rapida">
        <div class="lb-command-panel">
          <div class="lb-command-head">
            <label class="lb-command-search-wrap">
              <span class="lb-command-search-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="7"></circle>
                  <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
                </svg>
              </span>
              <input class="lb-command-input" id="lbCommandInput" type="search" autocomplete="off" placeholder="Buscar pagina, acao ou relatorio">
            </label>
            <button type="button" class="lb-command-close" id="lbCommandClose" aria-label="Fechar">x</button>
          </div>
          <div class="lb-command-groups" id="lbCommandGroups"></div>
          <div class="lb-command-results" id="lbCommandResults"></div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    elements = {
      launcher: document.getElementById("lbCommandLauncher"),
      overlay: document.getElementById("lbCommandOverlay"),
      close: document.getElementById("lbCommandClose"),
      input: document.getElementById("lbCommandInput"),
      groups: document.getElementById("lbCommandGroups"),
      results: document.getElementById("lbCommandResults")
    };
  }

  function bindEvents() {
    elements.launcher.addEventListener("click", openPalette);
    elements.close.addEventListener("click", closePalette);
    elements.overlay.addEventListener("click", event => {
      if (event.target === elements.overlay) closePalette();
    });

    elements.input.addEventListener("input", () => {
      query = elements.input.value;
      activeIndex = 0;
      renderResults();
    });

    document.addEventListener("keydown", event => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        openPalette();
        return;
      }

      if (!elements.overlay.classList.contains("is-open")) return;

      const results = filteredCommands();
      if (event.key === "Escape") {
        closePalette();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        renderResults();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderResults();
      } else if (event.key === "Enter") {
        event.preventDefault();
        runCommand(results[activeIndex]);
      }
    });
  }

  function initCommandPalette() {
    if (document.getElementById("lb-command-root")) return;
    createMarkup();
    render();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommandPalette);
  } else {
    initCommandPalette();
  }
})();
