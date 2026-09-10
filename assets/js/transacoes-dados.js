(() => {
  "use strict";

  const {
    escaparHtml,
    formatarMoeda,
    formatarData,
    requisitarApi,
    garantirOpcaoSelecionada,
    configurarBuscaClientes,
    dataHoraSaoPaulo,
    iniciarEnvioFormulario,
    concluirEnvioFormulario,
    renderizarPaginacao,
    inicializarLayout,
    mostrarAviso,
    confirmar,
    abrirModal,
    fecharModal,
  } = window.LocalBarber;

  let transacoes = [];
  let clientes = [];
  let servicos = [];
  let funcionarios = [];
  let periodoAtivo = "hoje";
  let identificadorEmEdicao = null;
  let temporizadorBusca = null;
  let paginaAtual = 1;
  let ultimaCarga = 0;

  const rotulosStatus = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };
  const rotulosPagamento = {
    pix: "Pix",
    credito: "Crédito",
    debito: "Débito",
    dinheiro: "Dinheiro",
    outro: "Outro",
  };

  function transacaoPorId(identificador) {
    return transacoes.find((transacao) => transacao.id === identificador);
  }

  function agoraLocal() {
    return dataHoraSaoPaulo();
  }

  function dataHoraParaCampo(valor) {
    return valor ? dataHoraSaoPaulo(valor) : agoraLocal();
  }

  function preencherOpcoes() {
    document.getElementById("transacao-cliente").innerHTML =
      `<option value="">Não vincular</option>${clientes.map((cliente) =>
        `<option value="${cliente.id}">${escaparHtml(cliente.nome)}</option>`).join("")}`;
    document.getElementById("transacao-servico").innerHTML =
      `<option value="">Não vincular</option>${servicos.map((servico) =>
        `<option value="${servico.id}">${escaparHtml(servico.nome)}</option>`).join("")}`;
    document.getElementById("transacao-funcionario").innerHTML =
      `<option value="">Não vincular</option>${funcionarios.map((funcionario) =>
        `<option value="${funcionario.id}">${escaparHtml(funcionario.nome)}</option>`).join("")}`;
  }

  function abrirFormulario(transacao = null) {
    identificadorEmEdicao = transacao?.id || null;
    const formulario = document.getElementById("formulario-transacao");
    formulario.reset();
    formulario.elements.tipo.value = "entrada";
    formulario.elements.metodo_pagamento.value = "pix";
    formulario.elements.status.value = "concluido";
    formulario.elements.data_transacao.value = agoraLocal();
    document.getElementById("titulo-modal-transacao").textContent =
      transacao ? "Editar transação" : "Nova transação";

    if (transacao) {
      garantirOpcaoSelecionada(formulario.elements.cliente_id, transacao.cliente_id, transacao.cliente);
      garantirOpcaoSelecionada(formulario.elements.servico_id, transacao.servico_id, transacao.servico);
      garantirOpcaoSelecionada(formulario.elements.funcionario_id, transacao.funcionario_id, transacao.funcionario);
      formulario.elements.tipo.value = transacao.tipo;
      formulario.elements.valor.value = transacao.valor;
      formulario.elements.descricao.value = transacao.descricao;
      formulario.elements.metodo_pagamento.value = transacao.metodo_pagamento;
      formulario.elements.status.value = transacao.status;
      formulario.elements.data_transacao.value = dataHoraParaCampo(transacao.data_transacao);
      formulario.elements.cliente_id.value = transacao.cliente_id || "";
      formulario.elements.servico_id.value = transacao.servico_id || "";
      formulario.elements.funcionario_id.value = transacao.funcionario_id || "";
      formulario.elements.observacoes.value = transacao.observacoes || "";
    }

    abrirModal("modal-transacao");
  }

  function fecharFormulario() {
    identificadorEmEdicao = null;
    fecharModal("modal-transacao");
  }

  function classeStatus(status) {
    if (["confirmado", "concluido"].includes(status)) return "sucesso";
    if (status === "pendente") return "alerta";
    return "perigo";
  }

  function renderizarTabela() {
    const recipiente = document.getElementById("conteudo-transacoes");
    document.getElementById("quantidade-transacoes").textContent =
      `${transacoes.length} ${transacoes.length === 1 ? "registro" : "registros"}`;

    if (!transacoes.length) {
      recipiente.innerHTML = `<div class="estado-vazio"><div>
        <strong>Nenhuma transação encontrada</strong>
        <p>Cadastre uma movimentação real ou altere os filtros do período.</p>
      </div></div>`;
      return;
    }

    recipiente.innerHTML = `
      <table class="tabela">
        <thead><tr><th>Data</th><th>Descrição</th><th>Vínculo</th><th>Pagamento</th><th>Valor</th><th>Status</th><th></th></tr></thead>
        <tbody>${transacoes.map((transacao) => `
          <tr>
            <td>${formatarData(transacao.data_transacao, true)}<br><span class="texto-suave">${escaparHtml(transacao.codigo || "")}</span></td>
            <td><strong>${escaparHtml(transacao.descricao)}</strong><br><span class="texto-suave">${transacao.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
            <td>${escaparHtml(transacao.cliente || transacao.servico || transacao.funcionario || "Sem vínculo")}</td>
            <td>${rotulosPagamento[transacao.metodo_pagamento] || transacao.metodo_pagamento}</td>
            <td style="color:${transacao.tipo === "entrada" ? "var(--sucesso)" : "var(--perigo)"};font-weight:800">
              ${transacao.tipo === "entrada" ? "+" : "−"}${formatarMoeda(transacao.valor)}
            </td>
            <td>
              <select class="selecao etiqueta ${classeStatus(transacao.status)}" data-status="${transacao.id}" aria-label="Alterar status" style="min-height:34px;padding:5px 8px">
                ${Object.entries(rotulosStatus).map(([valor, rotulo]) =>
                  `<option value="${valor}" ${valor === transacao.status ? "selected" : ""}>${rotulo}</option>`).join("")}
              </select>
            </td>
            <td><div class="acoes-tabela">
              <button class="botao botao-icone" type="button" data-editar="${transacao.id}" aria-label="Editar transação">✎</button>
              ${transacao.status !== "cancelado" ? `<button class="botao botao-icone botao-perigo" type="button" data-cancelar="${transacao.id}" aria-label="Cancelar transação">×</button>` : ""}
            </div></td>
          </tr>`).join("")}</tbody>
      </table>`;

    recipiente.querySelectorAll("[data-editar]").forEach((botao) => {
      botao.addEventListener("click", () => abrirFormulario(transacaoPorId(botao.dataset.editar)));
    });
    recipiente.querySelectorAll("[data-cancelar]").forEach((botao) => {
      botao.addEventListener("click", () => cancelarTransacao(botao.dataset.cancelar));
    });
    recipiente.querySelectorAll("[data-status]").forEach((selecao) => {
      selecao.addEventListener("change", () => alterarStatus(selecao.dataset.status, selecao.value));
    });
  }

  async function carregarTransacoes(pagina = 1) {
    const carga = ++ultimaCarga;
    const busca = encodeURIComponent(document.getElementById("busca-transacoes").value.trim());
    const metodo = encodeURIComponent(document.getElementById("metodo-transacoes").value);
    const situacao = encodeURIComponent(document.getElementById("situacao-transacoes").value);
    const dados = await requisitarApi(
      `transacoes.php?busca=${busca}&metodo=${metodo}&situacao=${situacao}&periodo=${periodoAtivo}&pagina=${pagina}`
    );
    if (carga !== ultimaCarga) return;
    const ultimaPagina = Math.max(1, Math.ceil(dados.paginacao.total / dados.paginacao.por_pagina));
    if (pagina > ultimaPagina) return carregarTransacoes(ultimaPagina);
    paginaAtual = pagina;
    renderizarPaginacao(dados.paginacao, "conteudo-transacoes", carregarTransacoes);
    transacoes = dados.transacoes;
    clientes = dados.clientes;
    servicos = dados.servicos;
    funcionarios = dados.funcionarios;
    preencherOpcoes();
    document.getElementById("kpi-entradas").textContent = formatarMoeda(dados.resumo.entradas);
    document.getElementById("kpi-saidas").textContent = formatarMoeda(dados.resumo.saidas);
    document.getElementById("kpi-saldo").textContent = formatarMoeda(dados.resumo.saldo);
    document.getElementById("kpi-total").textContent = dados.resumo.total;
    renderizarTabela();
  }

  async function salvarTransacao(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dadosFormulario = Object.fromEntries(new FormData(formulario));
    const estavaEditando = Boolean(identificadorEmEdicao);

    if (!iniciarEnvioFormulario(formulario)) return;
    try {
      await requisitarApi("transacoes.php", {
        metodo: estavaEditando ? "PATCH" : "POST",
        dados: { ...dadosFormulario, ...(estavaEditando ? { id: identificadorEmEdicao } : {}) },
      });
      fecharFormulario();
      mostrarAviso(estavaEditando ? "Transação atualizada." : "Transação registrada.");
      await carregarTransacoes(paginaAtual);
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    } finally {
      concluirEnvioFormulario(formulario);
    }
  }

  async function alterarStatus(identificador, status) {
    try {
      await requisitarApi("transacoes.php", { metodo: "PATCH", dados: { id: identificador, status } });
      mostrarAviso("Status da transação atualizado.");
      await carregarTransacoes(paginaAtual);
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
      await carregarTransacoes(paginaAtual);
    }
  }

  function cancelarTransacao(identificador) {
    confirmar({
      titulo: "Cancelar transação?",
      mensagem: "A movimentação continuará no histórico, mas deixará de compor os indicadores financeiros.",
      rotulo: "Cancelar transação",
      acao: async () => {
        try {
          await requisitarApi("transacoes.php", { metodo: "DELETE", dados: { id: identificador } });
          mostrarAviso("Transação cancelada.");
          await carregarTransacoes(paginaAtual);
        } catch (erro) {
          mostrarAviso(erro.message, "erro");
        }
      },
    });
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("transacoes", "Transações");
      await carregarTransacoes(paginaAtual);
      if (new URLSearchParams(window.location.search).has("novo")) abrirFormulario();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.getElementById("nova-transacao").addEventListener("click", () => abrirFormulario());
  document.querySelectorAll("[data-fechar-modal]").forEach((botao) => botao.addEventListener("click", fecharFormulario));
  document.getElementById("modal-transacao").addEventListener("click", (evento) => {
    if (evento.target.id === "modal-transacao") fecharFormulario();
  });
  document.getElementById("formulario-transacao").addEventListener("submit", salvarTransacao);
  document.getElementById("busca-transacoes").addEventListener("input", () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => carregarTransacoes().catch((erro) => mostrarAviso(erro.message, "erro")), 280);
  });
  ["metodo-transacoes", "situacao-transacoes"].forEach((identificador) => {
    document.getElementById(identificador).addEventListener("change", () => {
      carregarTransacoes().catch((erro) => mostrarAviso(erro.message, "erro"));
    });
  });
  document.querySelectorAll("[data-periodo]").forEach((botao) => {
    botao.addEventListener("click", () => {
      document.querySelectorAll("#periodos-transacoes .aba").forEach((item) => item.classList.remove("ativa"));
      botao.classList.add("ativa");
      periodoAtivo = botao.dataset.periodo;
      carregarTransacoes().catch((erro) => mostrarAviso(erro.message, "erro"));
    });
  });

  configurarBuscaClientes("transacao-cliente", (lista) => { clientes = lista; });
  iniciarPagina();
})();

