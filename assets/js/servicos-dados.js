(() => {
  "use strict";

  const {
    escaparHtml,
    formatarMoeda,
    estaAtivo,
    requisitarApi,
    inicializarLayout,
    temPermissao,
    mostrarAviso,
    confirmar,
    abrirModal,
    fecharModal,
  } = window.LocalBarber;

  let servicos = [];
  let identificadorEmEdicao = null;
  let temporizadorBusca = null;

  function servicoPorId(identificador) {
    return servicos.find((servico) => servico.id === identificador);
  }

  function abrirFormulario(servico = null) {
    identificadorEmEdicao = servico?.id || null;
    const formulario = document.getElementById("formulario-servico");
    formulario.reset();
    formulario.elements.comissao_percentual.value = "50";
    formulario.elements.ativo.checked = true;
    document.getElementById("titulo-modal-servico").textContent =
      servico ? "Editar serviço" : "Novo serviço";

    if (servico) {
      formulario.elements.nome.value = servico.nome || "";
      formulario.elements.descricao.value = servico.descricao || "";
      formulario.elements.preco.value = servico.preco || 0;
      formulario.elements.duracao_minutos.value = servico.duracao_minutos || 30;
      formulario.elements.categoria.value = servico.categoria || "";
      formulario.elements.comissao_percentual.value = servico.comissao_percentual || 0;
      formulario.elements.imagem_url.value = servico.imagem_url || "";
      formulario.elements.ativo.checked = estaAtivo(servico.ativo);
    }

    abrirModal("modal-servico");
  }

  function fecharFormulario() {
    identificadorEmEdicao = null;
    fecharModal("modal-servico");
  }

  function renderizarTabela() {
    const recipiente = document.getElementById("conteudo-servicos");
    const podeGerenciar = temPermissao("servicos.gerenciar");
    document.getElementById("quantidade-servicos").textContent =
      `${servicos.length} ${servicos.length === 1 ? "serviço" : "serviços"}`;

    if (!servicos.length) {
      recipiente.innerHTML = `<div class="estado-vazio"><div>
        <strong>Nenhum serviço cadastrado</strong>
        <p>Cadastre serviços reais para habilitar novos agendamentos.</p>
      </div></div>`;
      return;
    }

    recipiente.innerHTML = `
      <table class="tabela">
        <thead><tr><th>Serviço</th><th>Categoria</th><th>Duração</th><th>Preço</th><th>Comissão</th><th>Status</th><th></th></tr></thead>
        <tbody>${servicos.map((servico) => `
          <tr>
            <td><strong>${escaparHtml(servico.nome)}</strong><br><span class="texto-suave">${escaparHtml(servico.descricao || "Sem descrição")}</span></td>
            <td>${escaparHtml(servico.categoria || "Sem categoria")}</td>
            <td>${Number(servico.duracao_minutos)} min</td>
            <td>${formatarMoeda(servico.preco)}</td>
            <td>${Number(servico.comissao_percentual)}%</td>
            <td><span class="etiqueta ${estaAtivo(servico.ativo) ? "sucesso" : "perigo"}">${estaAtivo(servico.ativo) ? "Ativo" : "Inativo"}</span></td>
            <td>${podeGerenciar ? `<div class="acoes-tabela">
              <button class="botao botao-icone" type="button" data-editar="${servico.id}" aria-label="Editar ${escaparHtml(servico.nome)}">✎</button>
              ${estaAtivo(servico.ativo) ? `<button class="botao botao-icone botao-perigo" type="button" data-desativar="${servico.id}" aria-label="Desativar ${escaparHtml(servico.nome)}">×</button>` : ""}
            </div>` : ""}</td>
          </tr>`).join("")}</tbody>
      </table>`;

    recipiente.querySelectorAll("[data-editar]").forEach((botao) => {
      botao.addEventListener("click", () => abrirFormulario(servicoPorId(botao.dataset.editar)));
    });
    recipiente.querySelectorAll("[data-desativar]").forEach((botao) => {
      botao.addEventListener("click", () => desativarServico(botao.dataset.desativar));
    });
  }

  function renderizarCategorias(categorias) {
    const selecao = document.getElementById("categoria-servicos");
    const valorAtual = selecao.value;
    selecao.innerHTML = `<option value="">Todas as categorias</option>${categorias.map((categoria) =>
      `<option value="${escaparHtml(categoria.nome)}">${escaparHtml(categoria.nome)}</option>`).join("")}`;
    selecao.value = valorAtual;
    document.getElementById("categorias-disponiveis").innerHTML = categorias.map((categoria) =>
      `<option value="${escaparHtml(categoria.nome)}"></option>`).join("");
  }

  async function carregarServicos() {
    const busca = encodeURIComponent(document.getElementById("busca-servicos").value.trim());
    const categoria = encodeURIComponent(document.getElementById("categoria-servicos").value);
    const dados = await requisitarApi(`servicos.php?busca=${busca}&categoria=${categoria}`);
    servicos = dados.servicos;
    renderizarCategorias(dados.categorias);
    document.getElementById("kpi-total").textContent = dados.resumo.total;
    document.getElementById("kpi-ativos").textContent = dados.resumo.ativos;
    document.getElementById("kpi-duracao").textContent = `${Number(dados.resumo.duracao_media || 0)} min`;
    document.getElementById("kpi-preco").textContent = formatarMoeda(dados.resumo.preco_medio);
    renderizarTabela();
  }

  async function salvarServico(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dadosFormulario = Object.fromEntries(new FormData(formulario));
    dadosFormulario.ativo = formulario.elements.ativo.checked;

    try {
      const estavaEditando = Boolean(identificadorEmEdicao);
      await requisitarApi("servicos.php", {
        metodo: estavaEditando ? "PATCH" : "POST",
        dados: { ...dadosFormulario, ...(estavaEditando ? { id: identificadorEmEdicao } : {}) },
      });
      fecharFormulario();
      mostrarAviso(estavaEditando ? "Serviço atualizado." : "Serviço cadastrado.");
      await carregarServicos();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  function desativarServico(identificador) {
    const servico = servicoPorId(identificador);
    confirmar({
      titulo: "Desativar serviço?",
      mensagem: `${servico?.nome || "Este serviço"} não poderá ser escolhido em novos agendamentos. O histórico será preservado.`,
      rotulo: "Desativar",
      acao: async () => {
        try {
          await requisitarApi("servicos.php", { metodo: "DELETE", dados: { id: identificador } });
          mostrarAviso("Serviço desativado.");
          await carregarServicos();
        } catch (erro) {
          mostrarAviso(erro.message, "erro");
        }
      },
    });
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("servicos", "Serviços");
      await carregarServicos();
      if (
        temPermissao("servicos.gerenciar")
        && new URLSearchParams(window.location.search).has("novo")
      ) {
        abrirFormulario();
      }
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.getElementById("novo-servico").addEventListener("click", () => abrirFormulario());
  document.querySelectorAll("[data-fechar-modal]").forEach((botao) => botao.addEventListener("click", fecharFormulario));
  document.getElementById("modal-servico").addEventListener("click", (evento) => {
    if (evento.target.id === "modal-servico") fecharFormulario();
  });
  document.getElementById("formulario-servico").addEventListener("submit", salvarServico);
  document.getElementById("busca-servicos").addEventListener("input", () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => carregarServicos().catch((erro) => mostrarAviso(erro.message, "erro")), 280);
  });
  document.getElementById("categoria-servicos").addEventListener("change", () => {
    carregarServicos().catch((erro) => mostrarAviso(erro.message, "erro"));
  });

  iniciarPagina();
})();
