(() => {
  "use strict";

  const emSubpasta = window.location.pathname.replaceAll("\\", "/").includes("/pages/");
  const prefixoRaiz = emSubpasta ? ".." : ".";
  let tokenCsrf = "";
  let promessaSessao = null;
  let sessaoAtual = null;
  let temporizadorAviso = null;
  let acaoConfirmacao = null;
  const CHAVE_SESSAO_VISUAL = "localbarber:sessao-visual";

  const rotas = [
    ["dashboard", "Dashboard", `${prefixoRaiz}/dashboard.php`, "▦", "dashboard.visualizar"],
    ["agenda", "Agenda", `${prefixoRaiz}/pages/agenda.html`, "◷", "agenda.visualizar"],
    ["clientes", "Clientes", `${prefixoRaiz}/pages/clientes.html`, "♙", "clientes.visualizar"],
    ["servicos", "Serviços", `${prefixoRaiz}/pages/servicos.html`, "✂", "servicos.visualizar"],
    ["faturamento", "Faturamento", `${prefixoRaiz}/pages/faturamento.html`, "R$", "financeiro.visualizar"],
    ["transacoes", "Transações", `${prefixoRaiz}/pages/transacoes.html`, "↗", "financeiro.visualizar"],
    ["equipe", "Equipe", `${prefixoRaiz}/pages/equipe.html`, "♟", "equipe.visualizar"],
    ["barbearia", "Minha Barbearia", `${prefixoRaiz}/pages/minha-barbearia.html`, "⌂", "barbearia.visualizar"],
  ];

  const secoesNavegacao = [
    ["principal", "Principal", ["dashboard", "agenda", "clientes", "servicos"]],
    ["financeiro", "Financeiro", ["faturamento", "transacoes"]],
    ["gestao", "Gestão", ["equipe"]],
    ["configuracoes", "Configurações", ["barbearia"]],
  ];

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatarMoeda(valor) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(valor || 0));
  }

  function formatarData(valor, comHorario = false) {
    if (!valor) return "—";
    const data = new Date(comHorario ? valor : `${valor}T12:00:00`);
    if (Number.isNaN(data.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", comHorario
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" }).format(data);
  }

  function formatarHorario(valor) {
    return valor ? String(valor).slice(0, 5) : "—";
  }

  function iniciais(nome) {
    const partes = String(nome || "U").trim().split(/\s+/).filter(Boolean);
    return partes.slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "U";
  }

  function estaAtivo(valor) {
    return [true, 1, "1", "t", "true"].includes(valor);
  }

  function mostrarAviso(mensagem, tipo = "sucesso") {
    clearTimeout(temporizadorAviso);
    document.querySelector(".aviso")?.remove();
    const aviso = document.createElement("div");
    aviso.className = `aviso ${tipo}`;
    aviso.setAttribute("role", tipo === "erro" ? "alert" : "status");
    aviso.textContent = mensagem;
    document.body.append(aviso);
    temporizadorAviso = window.setTimeout(() => aviso.remove(), 4200);
  }

  async function obterSessao() {
    if (promessaSessao) return promessaSessao;

    promessaSessao = fetch(`${prefixoRaiz}/api/sessao.php`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (resposta) => {
        const retorno = await resposta.json().catch(() => ({}));
        if (!resposta.ok || !retorno.sucesso) {
          throw new Error(retorno.mensagem || "Sessão inválida.");
        }
        tokenCsrf = retorno.dados.token_csrf;
        sessaoAtual = retorno.dados;
        salvarSessaoVisual(sessaoAtual);
        return sessaoAtual;
      })
      .catch((erro) => {
        removerSessaoVisual();
        window.location.href = `${prefixoRaiz}/index.html?login=necessario`;
        throw erro;
      });

    return promessaSessao;
  }

  function temPermissao(permissao, sessao = sessaoAtual) {
    return Array.isArray(sessao?.usuario?.permissoes)
      && sessao.usuario.permissoes.includes(permissao);
  }

  function destinoInicialPermitido(sessao) {
    return rotas.find((rota) => temPermissao(rota[4], sessao))?.[2]
      || `${prefixoRaiz}/index.html`;
  }

  function aplicarPermissoes(sessao) {
    document.querySelectorAll("[data-permissao]").forEach((elemento) => {
      const permitido = temPermissao(elemento.dataset.permissao, sessao);
      elemento.hidden = !permitido;
      if ("disabled" in elemento) elemento.disabled = !permitido;
    });
  }

  async function requisitarApi(caminho, opcoes = {}) {
    const metodo = String(opcoes.metodo || "GET").toUpperCase();
    const alteraDados = !["GET", "HEAD"].includes(metodo);

    if (alteraDados && !tokenCsrf) {
      await obterSessao();
    }

    const resposta = await fetch(`${prefixoRaiz}/api/${caminho}`, {
      method: metodo,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(alteraDados ? {
          "Content-Type": "application/json",
          "X-CSRF-Token": tokenCsrf,
        } : {}),
      },
      body: alteraDados ? JSON.stringify(opcoes.dados || {}) : undefined,
    });
    const retorno = await resposta.json().catch(() => ({}));

    if (resposta.status === 401) {
      removerSessaoVisual();
      window.location.href = `${prefixoRaiz}/index.html?login=necessario`;
      throw new Error("Sua sessão expirou.");
    }

    if (!resposta.ok || !retorno.sucesso) {
      throw new Error(retorno.mensagem || "Não foi possível concluir a operação.");
    }

    return retorno.dados;
  }

  function htmlNavegacao(paginaAtual, sessao) {
    const secoesPermitidas = secoesNavegacao
      .map(([identificadorSecao, titulo, identificadoresRotas]) => ({
        identificadorSecao,
        titulo,
        identificadoresRotas,
        rotas: rotas.filter(([identificador, , , , permissao]) =>
          identificadoresRotas.includes(identificador)
          && temPermissao(permissao, sessao)),
      }))
      .filter((secao) => secao.rotas.length > 0);
    const secaoPaginaAtual = secoesPermitidas.find((secao) =>
      secao.identificadoresRotas.includes(paginaAtual));
    const identificadorSecaoAberta =
      secaoPaginaAtual?.identificadorSecao
      || secoesPermitidas[0]?.identificadorSecao;

    return secoesPermitidas.map((secao) => {
      const estaAberta = secao.identificadorSecao === identificadorSecaoAberta;
      const identificadorBotao = `botao-nav-${secao.identificadorSecao}`;
      const identificadorConteudo = `conteudo-nav-${secao.identificadorSecao}`;

      return `
        <section class="nav-secao ${estaAberta ? "aberta" : ""}"
                 data-secao-navegacao="${secao.identificadorSecao}">
          <button class="nav-secao-botao" id="${identificadorBotao}" type="button"
                  aria-expanded="${estaAberta}" aria-controls="${identificadorConteudo}">
            <span>${secao.titulo}</span>
            <span class="nav-secao-seta" aria-hidden="true"></span>
          </button>
          <div class="nav-secao-conteudo" id="${identificadorConteudo}" role="region"
               aria-labelledby="${identificadorBotao}" aria-hidden="${!estaAberta}"
               ${estaAberta ? "" : "inert"}>
            <div class="nav-secao-links">
              ${secao.rotas.map(([identificador, rotulo, destino, icone]) => `
                <a class="nav-item ${paginaAtual === identificador ? "active" : ""}"
                   href="${destino}">
                  <span aria-hidden="true">${icone}</span>
                  <span>${rotulo}</span>
                </a>
              `).join("")}
            </div>
          </div>
        </section>
      `;
    }).join("");
  }

  function configurarAcordeaoNavegacao(barraLateral) {
    const secoes = Array.from(
      barraLateral.querySelectorAll("[data-secao-navegacao]")
    );

    function atualizarSecoes(secaoParaAbrir = null) {
      secoes.forEach((secao) => {
        const estaAberta = secao === secaoParaAbrir;
        const botao = secao.querySelector(".nav-secao-botao");
        const conteudo = secao.querySelector(".nav-secao-conteudo");

        secao.classList.toggle("aberta", estaAberta);
        botao.setAttribute("aria-expanded", String(estaAberta));
        conteudo.setAttribute("aria-hidden", String(!estaAberta));
        conteudo.toggleAttribute("inert", !estaAberta);
      });
    }

    secoes.forEach((secao) => {
      secao.querySelector(".nav-secao-botao").addEventListener("click", () => {
        const vaiAbrir = !secao.classList.contains("aberta");
        atualizarSecoes(vaiAbrir ? secao : null);
      });
    });
  }

  function obterSessaoVisual() {
    try {
      const sessao = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO_VISUAL) || "null");
      const usuario = sessao?.usuario;

      if (
        !usuario
        || typeof usuario.nome !== "string"
        || !Array.isArray(usuario.permissoes)
      ) {
        return null;
      }

      window.LocalBarberTema?.aplicarCorTema(
        sessao?.barbearia?.cor_tema
          || window.LocalBarberTema.COR_TEMA_PADRAO
      );

      return sessao;
    } catch {
      removerSessaoVisual();
      return null;
    }
  }

  function salvarSessaoVisual(sessao) {
    const usuario = sessao?.usuario;
    if (!usuario) return;

    try {
      const corTema = window.LocalBarberTema?.normalizarCorHex(
        sessao?.barbearia?.cor_tema
      ) || "#244BC5";
      const sessaoVisual = {
        usuario: {
          nome: String(usuario.nome || "Usuário"),
          tipo_acesso: usuario.tipo_acesso === "administrador"
            ? "administrador"
            : "colaborador",
          permissoes: Array.isArray(usuario.permissoes)
            ? usuario.permissoes
            : [],
        },
        barbearia: {
          cor_tema: corTema,
        },
      };

      sessionStorage.setItem(CHAVE_SESSAO_VISUAL, JSON.stringify(sessaoVisual));
      window.LocalBarberTema?.aplicarCorTema(corTema);
    } catch {
      // A interface continua funcionando se o navegador bloquear o armazenamento.
    }
  }

  function removerSessaoVisual() {
    try {
      sessionStorage.removeItem(CHAVE_SESSAO_VISUAL);
      localStorage.removeItem("localbarber-cor-tema");
    } catch {
      // O redirecionamento de autenticação continua sendo a fonte de verdade.
    }
  }

  function previsualizarCorTema(cor) {
    return window.LocalBarberTema?.aplicarCorTema(cor, false)
      || String(cor || "").toUpperCase();
  }

  function atualizarCorTema(cor) {
    const corNormalizada = window.LocalBarberTema?.aplicarCorTema(cor)
      || String(cor || "").toUpperCase();
    const sessao = sessaoAtual || obterSessaoVisual();

    if (sessao) {
      sessao.barbearia = {
        ...(sessao.barbearia || {}),
        cor_tema: corNormalizada,
      };
      sessaoAtual = sessao;
      salvarSessaoVisual(sessao);
    }

    return corNormalizada;
  }

  function htmlNavegacaoCarregando() {
    return `
      <div class="sidebar-esqueleto" aria-hidden="true">
        <span class="sidebar-esqueleto-titulo"></span>
        <span class="sidebar-esqueleto-link"></span>
        <span class="sidebar-esqueleto-link"></span>
        <span class="sidebar-esqueleto-link"></span>
        <span class="sidebar-esqueleto-titulo"></span>
        <span class="sidebar-esqueleto-link"></span>
        <span class="sidebar-esqueleto-link"></span>
      </div>
    `;
  }

  function configurarBotaoSair() {
    document.getElementById("botao-sair")?.addEventListener("click", () => {
      confirmar({
        titulo: "Sair do sistema?",
        mensagem: "Sua sessão atual será encerrada. Você precisará entrar novamente para acessar o painel.",
        rotulo: "Sim, sair",
        acao: async () => {
          removerSessaoVisual();
          window.location.href = `${prefixoRaiz}/auth/logout.php`;
        },
      });
    });
  }

  function renderizarBarraLateral(paginaAtual, sessao, carregando = false) {
    const barraLateral = document.getElementById("barra-lateral");
    if (!barraLateral) return;

    const nomeUsuario = sessao?.usuario?.nome || "Carregando…";
    const tipoAcesso = sessao?.usuario?.tipo_acesso;

    barraLateral.className = carregando ? "sidebar sidebar-carregando" : "sidebar";
    barraLateral.setAttribute("aria-busy", String(carregando));
    barraLateral.innerHTML = `
      <div class="sidebar-logo">
        <img src="${prefixoRaiz}/assets/images/logo.png" alt="LocalBarber">
      </div>
      <nav class="sidebar-nav" aria-label="Navegação principal">
        ${sessao ? htmlNavegacao(paginaAtual, sessao) : htmlNavegacaoCarregando()}
      </nav>
      <div class="sidebar-footer">
        <div class="user-row">
          <div class="user-avatar" id="avatar-usuario">${sessao ? iniciais(nomeUsuario) : "…"}</div>
          <div class="user-info">
            <p id="nome-usuario">${escaparHtml(nomeUsuario)}</p>
            <span id="papel-usuario">${
              carregando
                ? "Validando sessão"
                : tipoAcesso === "administrador" ? "Administrador" : "Colaborador"
            }</span>
          </div>
          ${sessao ? `
            <button class="botao-sair" id="botao-sair" type="button"
                    aria-label="Sair do sistema" title="Sair do sistema">
              <span aria-hidden="true">↪</span>
            </button>
          ` : ""}
        </div>
      </div>
    `;

    if (sessao) {
      configurarAcordeaoNavegacao(barraLateral);
    }
    configurarBotaoSair();
  }

  function renderizarBarraSuperior(tituloPagina) {
    const barraSuperior = document.getElementById("barra-superior");
    if (!barraSuperior) return;

    barraSuperior.className = "topbar";
    barraSuperior.innerHTML = `
      <div class="topbar-title">${escaparHtml(tituloPagina)}</div>
      <div class="topbar-right">
        <div class="topbar-date">${new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}</div>
      </div>
    `;
  }

  function garantirModalConfirmacao() {
    if (document.getElementById("modal-confirmacao")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-fundo" id="modal-confirmacao" role="dialog" aria-modal="true"
           aria-labelledby="titulo-confirmacao">
        <div class="modal modal-confirmacao">
          <div class="modal-cabecalho">
            <h2 id="titulo-confirmacao">Confirmar ação</h2>
            <button class="botao botao-icone" type="button" data-fechar-confirmacao aria-label="Fechar">×</button>
          </div>
          <div class="modal-corpo" id="mensagem-confirmacao"></div>
          <div class="modal-rodape">
            <button class="botao" type="button" data-fechar-confirmacao>Cancelar</button>
            <button class="botao botao-perigo" id="executar-confirmacao" type="button">Confirmar</button>
          </div>
        </div>
      </div>
    `);

    document.querySelectorAll("[data-fechar-confirmacao]").forEach((botao) => {
      botao.addEventListener("click", fecharConfirmacao);
    });
    document.getElementById("modal-confirmacao").addEventListener("click", (evento) => {
      if (evento.target.id === "modal-confirmacao") fecharConfirmacao();
    });
    document.getElementById("executar-confirmacao").addEventListener("click", async () => {
      const acao = acaoConfirmacao;
      fecharConfirmacao();
      if (acao) await acao();
    });
  }

  function confirmar({ titulo, mensagem, rotulo = "Confirmar", acao }) {
    garantirModalConfirmacao();
    acaoConfirmacao = acao;
    document.getElementById("titulo-confirmacao").textContent = titulo;
    document.getElementById("mensagem-confirmacao").textContent = mensagem;
    document.getElementById("executar-confirmacao").textContent = rotulo;
    document.getElementById("modal-confirmacao").classList.add("aberto");
    document.getElementById("executar-confirmacao").focus();
  }

  function fecharConfirmacao() {
    document.getElementById("modal-confirmacao")?.classList.remove("aberto");
    acaoConfirmacao = null;
  }

  async function inicializarLayout(paginaAtual, tituloPagina) {
    const sessaoVisual = obterSessaoVisual();
    sessaoAtual = sessaoVisual;
    renderizarBarraLateral(paginaAtual, sessaoVisual, !sessaoVisual);
    renderizarBarraSuperior(tituloPagina);

    const sessao = sessaoVisual || await obterSessao();
    const rotaAtual = rotas.find(([identificador]) => identificador === paginaAtual);

    if (rotaAtual && !temPermissao(rotaAtual[4], sessao)) {
      window.location.replace(destinoInicialPermitido(sessao));
      throw new Error("Seu perfil não possui acesso a esta página.");
    }

    if (!sessaoVisual) {
      renderizarBarraLateral(paginaAtual, sessao);
    }

    garantirModalConfirmacao();
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") fecharConfirmacao();
    });

    aplicarPermissoes(sessao);

    if (sessaoVisual) {
      void obterSessao()
        .then((sessaoValidada) => {
          if (rotaAtual && !temPermissao(rotaAtual[4], sessaoValidada)) {
            window.location.replace(destinoInicialPermitido(sessaoValidada));
            return;
          }
          aplicarPermissoes(sessaoValidada);
        })
        .catch(() => {
          // obterSessao já redireciona quando a autenticação expira.
        });
    }

    return sessao;
  }

  function abrirModal(identificador) {
    const modal = document.getElementById(identificador);
    modal?.classList.add("aberto");
    modal?.querySelector("input, select, textarea, button")?.focus();
  }

  function fecharModal(identificador) {
    document.getElementById(identificador)?.classList.remove("aberto");
  }

  window.LocalBarber = Object.freeze({
    prefixoRaiz,
    escaparHtml,
    formatarMoeda,
    formatarData,
    formatarHorario,
    iniciais,
    estaAtivo,
    mostrarAviso,
    obterSessao,
    temPermissao,
    requisitarApi,
    inicializarLayout,
    previsualizarCorTema,
    atualizarCorTema,
    confirmar,
    abrirModal,
    fecharModal,
  });
})();
