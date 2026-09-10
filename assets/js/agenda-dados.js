(() => {
  "use strict";

  const {
    escaparHtml,
    formatarData,
    formatarHorario,
    formatarMoeda,
    requisitarApi,
    garantirOpcaoSelecionada,
    configurarBuscaClientes,
    iniciarEnvioFormulario,
    concluirEnvioFormulario,
    inicializarLayout,
    mostrarAviso,
    confirmar,
    abrirModal,
    fecharModal,
  } = window.LocalBarber;

  let inicioSemana = obterSegundaFeira(new Date());
  let agendamentos = [];
  let servicos = [];
  let funcionarios = [];
  let clientes = [];
  let identificadorEmEdicao = null;

  const rotulosStatus = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    parcial: "Parcial",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  function obterSegundaFeira(data) {
    const copia = new Date(data);
    copia.setHours(12, 0, 0, 0);
    const dia = copia.getDay();
    copia.setDate(copia.getDate() + (dia === 0 ? -6 : 1 - dia));
    return copia;
  }

  function dataParaIso(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function fimDaSemana() {
    const fim = new Date(inicioSemana);
    fim.setDate(fim.getDate() + 6);
    return fim;
  }

  function classeStatus(status) {
    if (["confirmado", "concluido"].includes(status)) return "sucesso";
    if (["pendente", "parcial"].includes(status)) return "alerta";
    return "perigo";
  }

  function agendamentoPorId(identificador) {
    return agendamentos.find((agendamento) => agendamento.id === identificador);
  }

  function preencherOpcoes() {
    const opcoesServicos = servicos.map((servico) =>
      `<option value="${servico.id}">${escaparHtml(servico.nome)} · ${formatarMoeda(servico.preco)}</option>`).join("");
    const opcoesFuncionarios = funcionarios.map((funcionario) =>
      `<option value="${funcionario.id}">${escaparHtml(funcionario.nome)}</option>`).join("");
    const opcoesClientes = clientes.map((cliente) =>
      `<option value="${cliente.id}">${escaparHtml(cliente.nome)} · ${escaparHtml(cliente.telefone)}</option>`).join("");

    document.getElementById("agendamento-servico").innerHTML = `<option value="">Selecione</option>${opcoesServicos}`;
    document.getElementById("agendamento-funcionario").innerHTML = `<option value="">Selecione</option>${opcoesFuncionarios}`;
    document.getElementById("agendamento-cliente-id").innerHTML = `<option value="">Informar manualmente</option>${opcoesClientes}`;
    document.getElementById("filtro-servico").innerHTML = `<option value="">Todos os serviços</option>${servicos.map((servico) =>
      `<option value="${servico.id}">${escaparHtml(servico.nome)}</option>`).join("")}`;
    document.getElementById("filtro-funcionario").innerHTML = `<option value="">Todos os profissionais</option>${opcoesFuncionarios}`;
  }

  function abrirFormulario(agendamento = null) {
    identificadorEmEdicao = agendamento?.id || null;
    const formulario = document.getElementById("formulario-agendamento");
    formulario.reset();
    document.getElementById("titulo-modal-agendamento").textContent =
      agendamento ? "Editar agendamento" : "Novo agendamento";
    formulario.elements.data_agendamento.value = agendamento?.data_agendamento || dataParaIso(new Date());

    if (agendamento) {
      garantirOpcaoSelecionada(formulario.elements.cliente_id, agendamento.cliente_id, agendamento.cliente);
      garantirOpcaoSelecionada(formulario.elements.servico_id, agendamento.servico_id, agendamento.servico);
      garantirOpcaoSelecionada(formulario.elements.funcionario_id, agendamento.funcionario_id, agendamento.funcionario);
      formulario.elements.cliente_id.value = agendamento.cliente_id || "";
      formulario.elements.cliente.value = agendamento.cliente || "";
      formulario.elements.telefone.value = agendamento.telefone || "";
      formulario.elements.servico_id.value = agendamento.servico_id || "";
      formulario.elements.funcionario_id.value = agendamento.funcionario_id || "";
      formulario.elements.horario_inicio.value = formatarHorario(agendamento.horario_inicio);
      formulario.elements.observacoes.value = agendamento.observacoes || "";
    }

    abrirModal("modal-agendamento");
  }

  function fecharFormulario() {
    identificadorEmEdicao = null;
    fecharModal("modal-agendamento");
  }

  function agendamentosFiltrados() {
    const identificadorFuncionario = document.getElementById("filtro-funcionario").value;
    const identificadorServico = document.getElementById("filtro-servico").value;
    const status = document.getElementById("filtro-status").value;
    return agendamentos.filter((agendamento) =>
      (!identificadorFuncionario || agendamento.funcionario_id === identificadorFuncionario)
      && (!identificadorServico || agendamento.servico_id === identificadorServico)
      && (!status || agendamento.status === status)
    );
  }

  function renderizarTabela() {
    const lista = agendamentosFiltrados();
    const recipiente = document.getElementById("conteudo-agenda");
    document.getElementById("quantidade-agendamentos").textContent =
      `${lista.length} ${lista.length === 1 ? "agendamento" : "agendamentos"}`;

    if (!lista.length) {
      recipiente.innerHTML = `<div class="estado-vazio"><div>
        <strong>Nenhum agendamento nesta semana</strong>
        <p>Os registros reais aparecerão aqui após o primeiro agendamento.</p>
      </div></div>`;
      return;
    }

    recipiente.innerHTML = `
      <table class="tabela">
        <thead><tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Valor</th><th>Status</th><th></th></tr></thead>
        <tbody>${lista.map((agendamento) => `
          <tr>
            <td>${formatarData(agendamento.data_agendamento)}</td>
            <td><strong>${formatarHorario(agendamento.horario_inicio)}</strong></td>
            <td>${escaparHtml(agendamento.cliente)}<br><span class="texto-suave">${escaparHtml(agendamento.telefone || "Sem telefone")}</span></td>
            <td>${escaparHtml(agendamento.servico)}</td>
            <td>${escaparHtml(agendamento.funcionario || "Não informado")}</td>
            <td>${formatarMoeda(agendamento.valor_previsto)}</td>
            <td>
              <select class="selecao" data-status="${agendamento.id}" aria-label="Alterar status" style="min-height:34px;padding:5px 8px">
                ${Object.entries(rotulosStatus).map(([valor, rotulo]) =>
                  `<option value="${valor}" ${valor === agendamento.status ? "selected" : ""}>${rotulo}</option>`).join("")}
              </select>
            </td>
            <td><div class="acoes-tabela">
              <button class="botao botao-icone" type="button" data-editar="${agendamento.id}" aria-label="Editar agendamento">✎</button>
              ${agendamento.status !== "cancelado" ? `<button class="botao botao-icone botao-perigo" type="button" data-cancelar="${agendamento.id}" aria-label="Cancelar agendamento">×</button>` : ""}
            </div></td>
          </tr>`).join("")}</tbody>
      </table>`;

    recipiente.querySelectorAll("[data-editar]").forEach((botao) => {
      botao.addEventListener("click", () => abrirFormulario(agendamentoPorId(botao.dataset.editar)));
    });
    recipiente.querySelectorAll("[data-cancelar]").forEach((botao) => {
      botao.addEventListener("click", () => cancelarAgendamento(botao.dataset.cancelar));
    });
    recipiente.querySelectorAll("[data-status]").forEach((selecao) => {
      selecao.classList.add("etiqueta", classeStatus(selecao.value));
      selecao.addEventListener("change", () => alterarStatus(selecao.dataset.status, selecao.value));
    });
  }

  async function carregarAgenda() {
    const fim = fimDaSemana();
    document.getElementById("periodo-agenda").textContent =
      `${formatarData(dataParaIso(inicioSemana))} – ${formatarData(dataParaIso(fim))}`;
    const dados = await requisitarApi(
      `agendamentos.php?inicio=${dataParaIso(inicioSemana)}&fim=${dataParaIso(fim)}`
    );
    agendamentos = dados.agendamentos;
    servicos = dados.servicos;
    funcionarios = dados.funcionarios;
    clientes = dados.clientes;
    preencherOpcoes();
    renderizarTabela();
  }

  async function salvarAgendamento(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dadosFormulario = Object.fromEntries(new FormData(formulario));
    const estavaEditando = Boolean(identificadorEmEdicao);

    if (!iniciarEnvioFormulario(formulario)) return;
    try {
      await requisitarApi("agendamentos.php", {
        metodo: estavaEditando ? "PATCH" : "POST",
        dados: { ...dadosFormulario, ...(estavaEditando ? { id: identificadorEmEdicao } : {}) },
      });
      fecharFormulario();
      mostrarAviso(estavaEditando ? "Agendamento atualizado." : "Agendamento criado.");
      await carregarAgenda();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    } finally {
      concluirEnvioFormulario(formulario);
    }
  }

  async function alterarStatus(identificador, status) {
    try {
      await requisitarApi("agendamentos.php", {
        metodo: "PATCH",
        dados: { id: identificador, status },
      });
      mostrarAviso("Status do agendamento atualizado.");
      await carregarAgenda();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
      await carregarAgenda();
    }
  }

  function cancelarAgendamento(identificador) {
    confirmar({
      titulo: "Cancelar agendamento?",
      mensagem: "O horário será liberado, mas o registro continuará no histórico com status cancelado.",
      rotulo: "Cancelar agendamento",
      acao: async () => {
        try {
          await requisitarApi("agendamentos.php", { metodo: "DELETE", dados: { id: identificador } });
          mostrarAviso("Agendamento cancelado.");
          await carregarAgenda();
        } catch (erro) {
          mostrarAviso(erro.message, "erro");
        }
      },
    });
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("agenda", "Agenda");
      await carregarAgenda();
      if (new URLSearchParams(window.location.search).has("novo")) abrirFormulario();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.getElementById("novo-agendamento").addEventListener("click", () => abrirFormulario());
  document.querySelectorAll("[data-fechar-modal]").forEach((botao) => botao.addEventListener("click", fecharFormulario));
  document.getElementById("modal-agendamento").addEventListener("click", (evento) => {
    if (evento.target.id === "modal-agendamento") fecharFormulario();
  });
  document.getElementById("formulario-agendamento").addEventListener("submit", salvarAgendamento);
  document.getElementById("agendamento-cliente-id").addEventListener("change", (evento) => {
    const cliente = clientes.find((item) => item.id === evento.target.value);
    if (!cliente) return;
    document.getElementById("agendamento-cliente").value = cliente.nome;
    document.getElementById("agendamento-telefone").value = cliente.telefone;
  });
  document.getElementById("semana-anterior").addEventListener("click", () => {
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    carregarAgenda().catch((erro) => mostrarAviso(erro.message, "erro"));
  });
  document.getElementById("proxima-semana").addEventListener("click", () => {
    inicioSemana.setDate(inicioSemana.getDate() + 7);
    carregarAgenda().catch((erro) => mostrarAviso(erro.message, "erro"));
  });
  document.getElementById("semana-atual").addEventListener("click", () => {
    inicioSemana = obterSegundaFeira(new Date());
    carregarAgenda().catch((erro) => mostrarAviso(erro.message, "erro"));
  });
  ["filtro-funcionario", "filtro-servico", "filtro-status"].forEach((identificador) => {
    document.getElementById(identificador).addEventListener("change", renderizarTabela);
  });

  configurarBuscaClientes("agendamento-cliente-id", (lista) => { clientes = lista; });
  iniciarPagina();
})();

