(() => {
  "use strict";

  const {
    escaparHtml,
    formatarMoeda,
    formatarData,
    requisitarApi,
    inicializarLayout,
    mostrarAviso,
  } = window.LocalBarber;

  function dataParaIso(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function definirPeriodo(periodo) {
    const hoje = new Date();
    const inicio = new Date(hoje);
    if (periodo === "semana") inicio.setDate(hoje.getDate() - 6);
    if (periodo === "mes") inicio.setDate(1);
    if (periodo === "ano") {
      inicio.setMonth(0);
      inicio.setDate(1);
    }
    document.getElementById("data-inicio").value = dataParaIso(inicio);
    document.getElementById("data-fim").value = dataParaIso(hoje);
  }

  function estadoVazio(mensagem) {
    return `<div class="estado-vazio"><div><strong>Sem dados no período</strong><p>${mensagem}</p></div></div>`;
  }

  function renderizarGrafico(serie) {
    const recipiente = document.getElementById("grafico-faturamento");
    const maiorValor = Math.max(...serie.flatMap((item) => [Number(item.entradas), Number(item.saidas)]), 1);
    recipiente.style.overflowX = "auto";
    recipiente.innerHTML = serie.map((item) => {
      const alturaEntrada = Number(item.entradas) === 0 ? 2 : Math.max(4, (Number(item.entradas) / maiorValor) * 100);
      const alturaSaida = Number(item.saidas) === 0 ? 2 : Math.max(4, (Number(item.saidas) / maiorValor) * 100);
      return `
        <div class="grupo-barra" style="min-width:${serie.length > 60 ? "9px" : "24px"}" title="${formatarData(item.data)} · Entradas ${formatarMoeda(item.entradas)} · Saídas ${formatarMoeda(item.saidas)}">
          <div style="height:100%;display:flex;align-items:flex-end;gap:2px">
            <div class="barra" style="height:${alturaEntrada}%;background:var(--sucesso)"></div>
            <div class="barra" style="height:${alturaSaida}%;background:var(--perigo)"></div>
          </div>
          <span class="rotulo-barra">${serie.length <= 31 ? formatarData(item.data).slice(0, 5) : ""}</span>
        </div>`;
    }).join("");
  }

  function renderizarRanking(servicos) {
    const recipiente = document.getElementById("ranking-servicos");
    if (!servicos.length) {
      recipiente.innerHTML = estadoVazio("As receitas vinculadas a serviços aparecerão aqui.");
      return;
    }
    recipiente.innerHTML = `<table class="tabela"><thead><tr><th>Descrição</th><th>Qtd.</th><th class="texto-direita">Receita</th></tr></thead>
      <tbody>${servicos.map((servico) => `<tr>
        <td>${escaparHtml(servico.nome)}</td><td>${servico.quantidade}</td>
        <td class="texto-direita"><strong>${formatarMoeda(servico.valor)}</strong></td>
      </tr>`).join("")}</tbody></table>`;
  }

  function renderizarMetodos(metodos) {
    const recipiente = document.getElementById("resumo-metodos");
    if (!metodos.length) {
      recipiente.innerHTML = estadoVazio("As formas de pagamento usadas aparecerão aqui.");
      return;
    }
    const rotulos = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro", outro: "Outro" };
    recipiente.innerHTML = `<table class="tabela"><thead><tr><th>Método</th><th>Qtd.</th><th class="texto-direita">Valor</th></tr></thead>
      <tbody>${metodos.map((metodo) => `<tr>
        <td>${rotulos[metodo.metodo_pagamento] || escaparHtml(metodo.metodo_pagamento)}</td><td>${metodo.quantidade}</td>
        <td class="texto-direita"><strong>${formatarMoeda(metodo.valor)}</strong></td>
      </tr>`).join("")}</tbody></table>`;
  }

  async function carregarFaturamento() {
    const inicio = document.getElementById("data-inicio").value;
    const fim = document.getElementById("data-fim").value;
    const dados = await requisitarApi(`faturamento.php?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`);
    document.getElementById("kpi-faturamento").textContent = formatarMoeda(dados.resumo.faturamento);
    document.getElementById("kpi-despesas").textContent = formatarMoeda(dados.resumo.despesas);
    document.getElementById("kpi-saldo").textContent = formatarMoeda(dados.resumo.saldo);
    document.getElementById("kpi-ticket").textContent = formatarMoeda(dados.resumo.ticket_medio);
    document.getElementById("quantidade-concluidas").textContent =
      `${dados.resumo.transacoes_concluidas} transações concluídas`;
    renderizarGrafico(dados.serie);
    renderizarRanking(dados.servicos);
    renderizarMetodos(dados.metodos);
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("faturamento", "Faturamento");
      definirPeriodo("mes");
      await carregarFaturamento();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.querySelectorAll("#periodos-faturamento [data-periodo]").forEach((botao) => {
    botao.addEventListener("click", () => {
      document.querySelectorAll("#periodos-faturamento .aba").forEach((item) => item.classList.remove("ativa"));
      botao.classList.add("ativa");
      definirPeriodo(botao.dataset.periodo);
      carregarFaturamento().catch((erro) => mostrarAviso(erro.message, "erro"));
    });
  });
  document.getElementById("aplicar-periodo").addEventListener("click", () => {
    document.querySelectorAll("#periodos-faturamento .aba").forEach((item) => item.classList.remove("ativa"));
    carregarFaturamento().catch((erro) => mostrarAviso(erro.message, "erro"));
  });

  iniciarPagina();
})();

