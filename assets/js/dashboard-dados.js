(() => {
  "use strict";

  const {
    escaparHtml,
    formatarMoeda,
    formatarData,
    formatarHorario,
    requisitarApi,
    inicializarLayout,
    mostrarAviso,
  } = window.LocalBarber;

  function estadoVazio(titulo, mensagem) {
    return `<div class="estado-vazio"><div><strong>${titulo}</strong><p>${mensagem}</p></div></div>`;
  }

  function classeSituacao(situacao) {
    if (["concluido", "confirmado", "online"].includes(situacao)) return "sucesso";
    if (["pendente", "parcial", "busy"].includes(situacao)) return "alerta";
    return "perigo";
  }

  function rotuloSituacao(situacao) {
    return {
      pendente: "Pendente",
      confirmado: "Confirmado",
      parcial: "Parcial",
      concluido: "Concluído",
      cancelado: "Cancelado",
      online: "Online",
      busy: "Ocupado",
      offline: "Offline",
    }[situacao] || situacao;
  }

  function iniciais(nome) {
    return String(nome || "P")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join("")
      .toUpperCase() || "P";
  }

  function definirCarregamentoDashboard(ativo) {
    const pagina = document.getElementById("dashboard-pagina");
    const conteudo = document.getElementById("dashboard-conteudo");
    pagina.dataset.carregando = String(ativo);
    conteudo.setAttribute("aria-busy", String(ativo));
  }

  function atualizarSaudacao(sessao) {
    const hora = new Date().getHours();
    const periodo = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const primeiroNome = String(sessao?.usuario?.nome || "").trim().split(/\s+/)[0];
    document.getElementById("dashboard-saudacao").textContent = primeiroNome
      ? `${periodo}, ${primeiroNome}`
      : periodo;
  }

  function renderizarAgendamentos(agendamentos) {
    const recipiente = document.getElementById("lista-agendamentos");
    if (!agendamentos.length) {
      recipiente.innerHTML = estadoVazio(
        "Nenhum agendamento para hoje",
        "Os novos agendamentos aparecerão aqui assim que forem cadastrados."
      );
      return;
    }

    recipiente.innerHTML = `<div class="dashboard-agenda-lista">${agendamentos.map((agendamento) => `
      <div class="dashboard-agenda-item">
        <time datetime="${escaparHtml(agendamento.horario_inicio || "")}">${formatarHorario(agendamento.horario_inicio)}</time>
        <span class="dashboard-agenda-marcador" aria-hidden="true"></span>
        <div class="dashboard-agenda-info">
          <strong>${escaparHtml(agendamento.cliente)}</strong>
          <span>${escaparHtml(agendamento.servico)} · ${escaparHtml(agendamento.funcionario || "Sem profissional")}</span>
        </div>
        <span class="etiqueta ${classeSituacao(agendamento.status)}">${rotuloSituacao(agendamento.status)}</span>
      </div>`).join("")}</div>`;
  }

  function renderizarGrafico(serie) {
    const recipiente = document.getElementById("grafico-faturamento");
    const valores = serie.map((item) => Number(item.valor || 0));
    const maiorValor = Math.max(...valores, 1);
    const total = valores.reduce((soma, valor) => soma + valor, 0);
    document.getElementById("total-sete-dias").textContent = formatarMoeda(total);
    recipiente.innerHTML = serie.map((item) => {
      const altura = Number(item.valor || 0) === 0 ? 2 : Math.max(6, (Number(item.valor) / maiorValor) * 100);
      const rotulo = new Date(`${item.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" });
      return `
        <div class="dashboard-grupo-barra" title="${formatarData(item.data)}: ${formatarMoeda(item.valor)}" aria-label="${formatarData(item.data)}: ${formatarMoeda(item.valor)}">
          <div class="dashboard-barra-area">
            <div class="dashboard-barra" style="height:${altura}%"></div>
          </div>
          <span>${escaparHtml(rotulo.replace(".", ""))}</span>
        </div>`;
    }).join("");
  }

  function renderizarTransacoes(transacoes) {
    const recipiente = document.getElementById("lista-transacoes");
    if (!transacoes.length) {
      recipiente.innerHTML = estadoVazio(
        "Nenhuma transação registrada",
        "Entradas e saídas reais serão exibidas aqui."
      );
      return;
    }

    recipiente.innerHTML = `<div class="dashboard-lista">${transacoes.map((transacao) => {
      const entrada = transacao.tipo === "entrada";
      return `
        <div class="dashboard-transacao-item">
          <span class="dashboard-transacao-icone ${entrada ? "entrada" : "saida"}" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="${entrada ? "M7 17 17 7M8 7h9v9" : "M17 7 7 17M16 17H7V8"}"/></svg>
          </span>
          <div class="dashboard-transacao-info">
            <strong>${escaparHtml(transacao.descricao)}</strong>
            <span>${formatarData(transacao.data_transacao, true)}</span>
          </div>
          <strong class="dashboard-transacao-valor ${entrada ? "entrada" : "saida"}">
            ${entrada ? "+" : "−"}${formatarMoeda(transacao.valor)}
          </strong>
        </div>`;
    }).join("")}</div>`;
  }

  function renderizarEquipe(equipe) {
    const recipiente = document.getElementById("lista-equipe");
    if (!equipe.length) {
      recipiente.innerHTML = estadoVazio(
        "Equipe ainda não cadastrada",
        "Adicione profissionais para disponibilizá-los na agenda."
      );
      return;
    }

    recipiente.innerHTML = `<div class="dashboard-lista">${equipe.map((profissional) => `
      <div class="dashboard-equipe-item">
        <span class="dashboard-equipe-avatar" aria-hidden="true">${escaparHtml(iniciais(profissional.nome))}</span>
        <div class="dashboard-equipe-info">
          <strong>${escaparHtml(profissional.nome)}</strong>
          <span>${escaparHtml(profissional.funcao)}</span>
        </div>
        <span class="dashboard-equipe-status ${classeSituacao(profissional.status)}">
          <span aria-hidden="true"></span>${rotuloSituacao(profissional.status)}
        </span>
      </div>`).join("")}</div>`;
  }

  const redesMeta = {
    instagram: {
      rotulo: "Instagram",
      icone: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
        </svg>`,
    },
    facebook: {
      rotulo: "Facebook",
      icone: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v3H6v4h3v8h4v-8h3.5l.5-4h-4V9c0-.7.3-1 1-1Z"/>
        </svg>`,
    },
    linkedin: {
      rotulo: "LinkedIn",
      icone: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 8.5H3V21h3.5V8.5ZM4.75 3a2.05 2.05 0 1 0 0 4.1 2.05 2.05 0 0 0 0-4.1ZM21 13.8c0-3.75-2-5.5-4.7-5.5-2.15 0-3.15 1.2-3.7 2V8.5H9.1V21h3.5v-6.2c0-1.65.3-3.25 2.35-3.25 2 0 2.05 1.9 2.05 3.35V21h3.5l.5-7.2Z"/>
        </svg>`,
    },
    youtube: {
      rotulo: "YouTube",
      icone: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/>
        </svg>`,
    },
  };

  function urlRedeSocial(rede) {
    const plataforma = rede?.plataforma;
    const identificador = String(rede?.identificador || "").trim();
    const url = String(rede?.url || "").trim();

    if (/^https?:\/\//i.test(url)) return url;
    if (!identificador) return "";

    if (plataforma === "instagram") {
      return `https://www.instagram.com/${identificador.replace(/^@/, "")}/`;
    }
    if (plataforma === "facebook") {
      return `https://www.facebook.com/${identificador.replace(/^@/, "")}`;
    }
    if (plataforma === "linkedin") {
      return `https://www.linkedin.com/${identificador.replace(/^\/+|\/+$/g, "")}/`;
    }
    if (plataforma === "youtube") {
      const canal = identificador.replace(/^\/+|\/+$/g, "");
      return `https://www.youtube.com/${canal.startsWith("@") ? canal : `@${canal}`}`;
    }

    return "";
  }

  function renderizarRedesSociais(redes) {
    const recipiente = document.getElementById("botoes-redes-dashboard");
    if (!recipiente) return;

    const redesPorPlataforma = new Map(
      (redes || []).map((rede) => [rede.plataforma, rede])
    );

    recipiente.innerHTML = Object.entries(redesMeta).map(([plataforma, { rotulo, icone }]) => {
      const rede = redesPorPlataforma.get(plataforma);
      const destino = urlRedeSocial(rede);

      if (!destino) {
        return `
          <button class="botao-rede ausente" type="button" data-rede-ausente="${plataforma}">
            <span class="rede-icone rede-icone--${plataforma}">${icone}</span>
            <span><strong>${rotulo}</strong><small>Não configurado</small></span>
            <span class="dashboard-rede-seta" aria-hidden="true">+</span>
          </button>`;
      }

      return `
        <a class="botao-rede" href="${escaparHtml(destino)}" target="_blank" rel="noopener noreferrer">
          <span class="rede-icone rede-icone--${plataforma}">${icone}</span>
          <span><strong>${rotulo}</strong><small>Abrir perfil</small></span>
          <span class="dashboard-rede-seta" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>
          </span>
        </a>`;
    }).join("");

    recipiente.querySelectorAll("[data-rede-ausente]").forEach((botao) => {
      botao.addEventListener("click", () => {
        mostrarAviso("Cadastre esta rede em Minha Barbearia para liberar o botão.", "erro");
      });
    });
  }

  async function carregarDashboard() {
    try {
      definirCarregamentoDashboard(true);
      const sessao = await inicializarLayout("dashboard", "Dashboard");
      atualizarSaudacao(sessao);
      const dados = await requisitarApi("dashboard.php");
      document.getElementById("kpi-agendamentos").textContent = dados.resumo.agendamentos_hoje;
      document.getElementById("kpi-faturamento").textContent = formatarMoeda(dados.resumo.faturamento_hoje);
      document.getElementById("kpi-clientes").textContent = dados.resumo.clientes_ativos;
      document.getElementById("kpi-pendentes").textContent = dados.resumo.pendentes;
      renderizarAgendamentos(dados.agendamentos || []);
      renderizarGrafico(dados.faturamento || []);
      renderizarTransacoes(dados.transacoes || []);
      renderizarEquipe(dados.equipe || []);
      renderizarRedesSociais(dados.redes_sociais || []);
      document.getElementById("dashboard-atualizado").textContent = `Atualizado às ${new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}`;
    } catch (erro) {
      document.getElementById("dashboard-atualizado").textContent = "Falha na atualização";
      mostrarAviso(erro.message, "erro");
    } finally {
      definirCarregamentoDashboard(false);
    }
  }

  carregarDashboard();
})();

