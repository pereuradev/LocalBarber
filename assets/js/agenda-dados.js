(() => {
  "use strict";

  const {
    escaparHtml,
    formatarData,
    formatarHorario,
    formatarMoeda,
    formatarTelefone,
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
  let horariosFuncionamento = [];
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

  function horarioParaMinutos(valor) {
    const [horas, minutos] = String(valor || "").slice(0, 5).split(":").map(Number);
    if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return null;
    return horas * 60 + minutos;
  }

  function minutosParaHorario(total) {
    const horas = Math.floor(total / 60);
    const minutos = total % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  }

  function horarioAtivo(horario) {
    return horario?.ativo === true || horario?.ativo === 1 || horario?.ativo === "1" || horario?.ativo === "true";
  }

  function obterExpediente(dataIso) {
    if (!dataIso) return null;
    const data = new Date(`${dataIso}T12:00:00`);
    if (Number.isNaN(data.getTime())) return null;
    return horariosFuncionamento.find((horario) =>
      Number(horario.dia_semana) === data.getDay() && horarioAtivo(horario)
    ) || null;
  }

  function obterDuracaoSelecionada(identificadorServico) {
    const servico = servicos.find((item) => item.id === identificadorServico);
    if (servico) return Number(servico.duracao_minutos);

    const original = agendamentoPorId(identificadorEmEdicao);
    if (original?.servico_id !== identificadorServico) return null;
    return horarioParaMinutos(original.horario_fim) - horarioParaMinutos(original.horario_inicio);
  }

  function alterouHorarioDoAgendamento(dados) {
    if (!identificadorEmEdicao) return true;
    const original = agendamentoPorId(identificadorEmEdicao);
    if (!original) return true;
    return original.data_agendamento !== dados.data_agendamento
      || formatarHorario(original.horario_inicio) !== dados.horario_inicio
      || original.servico_id !== dados.servico_id;
  }

  function mensagemHorarioInvalido(dados) {
    if (!dados.data_agendamento || !dados.horario_inicio || !dados.servico_id) return "";
    if (!alterouHorarioDoAgendamento(dados)) return "";

    const expediente = obterExpediente(dados.data_agendamento);
    if (!expediente) return "A barbearia não abre nesta data. Escolha outro dia.";

    const inicio = horarioParaMinutos(dados.horario_inicio);
    const abertura = horarioParaMinutos(expediente.abertura);
    const fechamento = horarioParaMinutos(expediente.fechamento);
    const duracao = obterDuracaoSelecionada(dados.servico_id);
    if ([inicio, abertura, fechamento, duracao].some((valor) => valor === null || !Number.isFinite(valor))) return "";

    const ultimoInicio = fechamento - duracao;
    if (inicio < abertura || inicio > ultimoInicio) {
      if (ultimoInicio < abertura) {
        return `Este serviço dura ${duracao} min e não cabe no expediente desta data.`;
      }
      return `Este serviço dura ${duracao} min. Escolha um início entre ${minutosParaHorario(abertura)} e ${minutosParaHorario(ultimoInicio)}.`;
    }
    return "";
  }

  function atualizarAjudaHorario() {
    const formulario = document.getElementById("formulario-agendamento");
    const ajuda = document.getElementById("ajuda-horario-agendamento");
    const campoHorario = formulario.elements.horario_inicio;
    campoHorario.setCustomValidity("");

    const data = formulario.elements.data_agendamento.value;
    const servicoId = formulario.elements.servico_id.value;
    const expediente = obterExpediente(data);
    if (!data) {
      ajuda.textContent = "Selecione a data e o serviço para conferir o expediente.";
      return;
    }
    if (!expediente) {
      ajuda.textContent = "A barbearia não abre nesta data.";
      return;
    }

    const duracao = obterDuracaoSelecionada(servicoId);
    const abertura = horarioParaMinutos(expediente.abertura);
    const fechamento = horarioParaMinutos(expediente.fechamento);
    if (!Number.isFinite(duracao)) {
      ajuda.textContent = `Expediente: ${minutosParaHorario(abertura)} às ${minutosParaHorario(fechamento)}. Selecione o serviço.`;
      return;
    }
    const ultimoInicio = fechamento - duracao;
    ajuda.textContent = ultimoInicio < abertura
      ? `O serviço dura ${duracao} min e não cabe no expediente desta data.`
      : `Duração: ${duracao} min. Inícios permitidos: ${minutosParaHorario(abertura)} a ${minutosParaHorario(ultimoInicio)}.`;
  }

  function definirConfirmacaoEmAndamento(formulario, ativo) {
    const status = document.getElementById("confirmacao-agendamento");
    formulario.classList.toggle("aguardando-confirmacao", ativo);
    status.hidden = !ativo;
    formulario.querySelectorAll("[data-fechar-modal]").forEach((botao) => {
      botao.disabled = ativo;
    });
  }

  function preencherOpcoes() {
    const opcoesServicos = servicos.map((servico) =>
      `<option value="${servico.id}">${escaparHtml(servico.nome)} · ${formatarMoeda(servico.preco)}</option>`).join("");
    const opcoesFuncionarios = funcionarios.map((funcionario) =>
      `<option value="${funcionario.id}">${escaparHtml(funcionario.nome)}</option>`).join("");
    const opcoesClientes = clientes.map((cliente) =>
      `<option value="${cliente.id}">${escaparHtml(cliente.nome)} · ${escaparHtml(formatarTelefone(cliente.telefone))}</option>`).join("");

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
      formulario.elements.telefone.value = formatarTelefone(agendamento.telefone);
      formulario.elements.servico_id.value = agendamento.servico_id || "";
      formulario.elements.funcionario_id.value = agendamento.funcionario_id || "";
      formulario.elements.horario_inicio.value = formatarHorario(agendamento.horario_inicio);
      formulario.elements.observacoes.value = agendamento.observacoes || "";
    }

    atualizarAjudaHorario();
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
            <td>${escaparHtml(agendamento.cliente)}<br><span class="texto-suave">${escaparHtml(formatarTelefone(agendamento.telefone) || "Sem telefone")}</span></td>
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
    horariosFuncionamento = dados.horarios || [];
    preencherOpcoes();
    renderizarTabela();
  }

  async function salvarAgendamento(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dadosFormulario = Object.fromEntries(new FormData(formulario));
    const estavaEditando = Boolean(identificadorEmEdicao);

    const mensagemHorario = mensagemHorarioInvalido(dadosFormulario);
    if (mensagemHorario) {
      const campoHorario = formulario.elements.horario_inicio;
      campoHorario.setCustomValidity(mensagemHorario);
      document.getElementById("ajuda-horario-agendamento").textContent = mensagemHorario;
      campoHorario.focus();
      campoHorario.reportValidity();
      return;
    }

    if (!iniciarEnvioFormulario(formulario)) return;
    definirConfirmacaoEmAndamento(formulario, true);
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
      definirConfirmacaoEmAndamento(formulario, false);
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
    document.getElementById("agendamento-telefone").value = formatarTelefone(cliente.telefone);
  });
  ["agendamento-data", "agendamento-servico", "agendamento-horario"].forEach((identificador) => {
    document.getElementById(identificador).addEventListener("change", atualizarAjudaHorario);
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

