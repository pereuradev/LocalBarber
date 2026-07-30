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
    if (["concluido", "confirmado"].includes(situacao)) return "sucesso";
    if (["pendente", "parcial"].includes(situacao)) return "alerta";
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

  function renderizarAgendamentos(agendamentos) {
    const recipiente = document.getElementById("lista-agendamentos");
    if (!agendamentos.length) {
      recipiente.innerHTML = estadoVazio(
        "Nenhum agendamento para hoje",
        "Os novos agendamentos aparecerão aqui assim que forem cadastrados."
      );
      return;
    }

    recipiente.innerHTML = `<div class="lista">${agendamentos.map((agendamento) => `
      <div class="item-lista">
        <div>
          <strong>${escaparHtml(agendamento.cliente)}</strong>
          <span>${escaparHtml(agendamento.servico)} · ${escaparHtml(agendamento.funcionario || "Sem profissional")}</span>
        </div>
        <div class="texto-direita">
          <strong>${formatarHorario(agendamento.horario_inicio)}</strong>
          <span class="etiqueta ${classeSituacao(agendamento.status)}">${rotuloSituacao(agendamento.status)}</span>
        </div>
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
        <div class="grupo-barra" title="${formatarData(item.data)}: ${formatarMoeda(item.valor)}">
          <div class="barra" style="height:${altura}%"></div>
          <span class="rotulo-barra">${escaparHtml(rotulo.replace(".", ""))}</span>
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

    recipiente.innerHTML = `<div class="lista">${transacoes.map((transacao) => `
      <div class="item-lista">
        <div>
          <strong>${escaparHtml(transacao.descricao)}</strong>
          <span>${formatarData(transacao.data_transacao, true)}</span>
        </div>
        <strong style="color:${transacao.tipo === "entrada" ? "var(--sucesso)" : "var(--perigo)"}">
          ${transacao.tipo === "entrada" ? "+" : "−"}${formatarMoeda(transacao.valor)}
        </strong>
      </div>`).join("")}</div>`;
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

    recipiente.innerHTML = `<div class="lista">${equipe.map((profissional) => `
      <div class="item-lista">
        <div>
          <strong>${escaparHtml(profissional.nome)}</strong>
          <span>${escaparHtml(profissional.funcao)}</span>
        </div>
        <span class="etiqueta ${classeSituacao(profissional.status)}">${rotuloSituacao(profissional.status)}</span>
      </div>`).join("")}</div>`;
  }

  async function carregarDashboard() {
    try {
      await inicializarLayout("dashboard", "Dashboard");
      const dados = await requisitarApi("dashboard.php");
      document.getElementById("kpi-agendamentos").textContent = dados.resumo.agendamentos_hoje;
      document.getElementById("kpi-faturamento").textContent = formatarMoeda(dados.resumo.faturamento_hoje);
      document.getElementById("kpi-clientes").textContent = dados.resumo.clientes_ativos;
      document.getElementById("kpi-pendentes").textContent = dados.resumo.pendentes;
      renderizarAgendamentos(dados.agendamentos);
      renderizarGrafico(dados.faturamento);
      renderizarTransacoes(dados.transacoes);
      renderizarEquipe(dados.equipe);
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  carregarDashboard();
})();

