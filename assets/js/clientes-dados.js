(() => {
  "use strict";

  const {
    escaparHtml,
    formatarMoeda,
    formatarData,
    estaAtivo,
    requisitarApi,
    inicializarLayout,
    mostrarAviso,
    confirmar,
    abrirModal,
    fecharModal,
  } = window.LocalBarber;

  let clientes = [];
  let identificadorEmEdicao = null;
  let temporizadorBusca = null;

  function obterDigitosCpf(valor) {
    return String(valor || "").replace(/\D/g, "").slice(0, 11);
  }

  function formatarCpf(valor) {
    const digitos = obterDigitosCpf(valor);
    return digitos
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  function calcularDigitoCpf(base, pesoInicial) {
    const soma = base
      .split("")
      .reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  function cpfValido(valor) {
    const cpf = obterDigitosCpf(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    const primeiroDigito = calcularDigitoCpf(cpf.slice(0, 9), 10);
    const segundoDigito = calcularDigitoCpf(`${cpf.slice(0, 9)}${primeiroDigito}`, 11);
    return cpf.endsWith(`${primeiroDigito}${segundoDigito}`);
  }

  function validarCampoCpf(exibirMensagem = true) {
    const campo = document.getElementById("cliente-cpf");
    const mensagem = cpfValido(campo.value) ? "" : "Informe um CPF válido.";
    campo.setCustomValidity(mensagem);
    campo.classList.toggle("campo-invalido", Boolean(mensagem));
    if (mensagem) campo.setAttribute("aria-invalid", "true");
    else campo.removeAttribute("aria-invalid");
    if (mensagem && exibirMensagem) campo.reportValidity();
    return mensagem === "";
  }

  function clientePorId(identificador) {
    return clientes.find((cliente) => cliente.id === identificador);
  }

  function abrirFormulario(cliente = null) {
    identificadorEmEdicao = cliente?.id || null;
    const formulario = document.getElementById("formulario-cliente");
    formulario.reset();
    formulario.elements.cpf.setCustomValidity("");
    formulario.elements.cpf.classList.remove("campo-invalido");
    formulario.elements.cpf.removeAttribute("aria-invalid");
    document.getElementById("titulo-modal-cliente").textContent =
      cliente ? "Editar cliente" : "Novo cliente";
    document.getElementById("grupo-cliente-ativo").classList.toggle("oculto", !cliente);

    if (cliente) {
      formulario.elements.nome.value = cliente.nome || "";
      formulario.elements.cpf.value = formatarCpf(cliente.cpf || "");
      formulario.elements.telefone.value = cliente.telefone || "";
      formulario.elements.email.value = cliente.email || "";
      formulario.elements.cidade.value = cliente.cidade || "";
      formulario.elements.observacoes.value = cliente.observacoes || "";
      formulario.elements.ativo.checked = estaAtivo(cliente.ativo);
    }

    abrirModal("modal-cliente");
  }

  function fecharFormulario() {
    identificadorEmEdicao = null;
    fecharModal("modal-cliente");
  }

  function renderizarTabela() {
    const recipiente = document.getElementById("conteudo-clientes");
    document.getElementById("quantidade-clientes").textContent =
      `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`;

    if (!clientes.length) {
      recipiente.innerHTML = `
        <div class="estado-vazio">
          <div><strong>Nenhum cliente encontrado</strong>
          <p>Cadastre o primeiro cliente ou altere os filtros de busca.</p></div>
        </div>`;
      return;
    }

    recipiente.innerHTML = `
      <table class="tabela">
        <thead><tr>
          <th>Cliente</th><th>Contato</th><th>Última visita</th>
          <th>Visitas</th><th>Total gasto</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${clientes.map((cliente) => `
          <tr>
            <td><strong>${escaparHtml(cliente.nome)}</strong><br><span class="texto-suave">${escaparHtml(cliente.cidade || "Cidade não informada")}</span></td>
            <td>${escaparHtml(cliente.telefone)}<br><span class="texto-suave">${escaparHtml(cliente.email || "E-mail não informado")}</span><br><span class="texto-suave">${cliente.cpf ? `CPF ${escaparHtml(formatarCpf(cliente.cpf))}` : "CPF não informado"}</span></td>
            <td>${cliente.ultima_visita ? formatarData(cliente.ultima_visita) : "Sem visita"}</td>
            <td>${Number(cliente.total_visitas || 0)}</td>
            <td>${formatarMoeda(cliente.total_gasto)}</td>
            <td><span class="etiqueta ${estaAtivo(cliente.ativo) ? "sucesso" : "perigo"}">${estaAtivo(cliente.ativo) ? "Ativo" : "Inativo"}</span></td>
            <td><div class="acoes-tabela">
              <button class="botao botao-icone" type="button" data-editar="${cliente.id}" aria-label="Editar ${escaparHtml(cliente.nome)}">✎</button>
              ${estaAtivo(cliente.ativo) ? `<button class="botao botao-icone botao-perigo" type="button" data-desativar="${cliente.id}" aria-label="Desativar ${escaparHtml(cliente.nome)}">×</button>` : ""}
            </div></td>
          </tr>`).join("")}</tbody>
      </table>`;

    recipiente.querySelectorAll("[data-editar]").forEach((botao) => {
      botao.addEventListener("click", () => abrirFormulario(clientePorId(botao.dataset.editar)));
    });
    recipiente.querySelectorAll("[data-desativar]").forEach((botao) => {
      botao.addEventListener("click", () => desativarCliente(botao.dataset.desativar));
    });
  }

  async function carregarClientes() {
    const busca = encodeURIComponent(document.getElementById("busca-clientes").value.trim());
    const situacao = encodeURIComponent(document.getElementById("situacao-clientes").value);
    const dados = await requisitarApi(`clientes.php?busca=${busca}&situacao=${situacao}`);
    clientes = dados.clientes;
    document.getElementById("kpi-total").textContent = dados.resumo.total;
    document.getElementById("kpi-ativos").textContent = dados.resumo.ativos;
    document.getElementById("kpi-recentes").textContent = dados.resumo.recentes;
    document.getElementById("kpi-valor").textContent = formatarMoeda(dados.resumo.valor_total);
    renderizarTabela();
  }

  async function salvarCliente(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!validarCampoCpf()) return;
    const dadosFormulario = Object.fromEntries(new FormData(formulario));
    dadosFormulario.cpf = obterDigitosCpf(dadosFormulario.cpf);
    dadosFormulario.ativo = formulario.elements.ativo.checked;
    const estavaEditando = Boolean(identificadorEmEdicao);

    try {
      await requisitarApi("clientes.php", {
        metodo: estavaEditando ? "PATCH" : "POST",
        dados: { ...dadosFormulario, ...(estavaEditando ? { id: identificadorEmEdicao } : {}) },
      });
      fecharFormulario();
      mostrarAviso(estavaEditando ? "Cliente atualizado." : "Cliente cadastrado.");
      await carregarClientes();
    } catch (erro) {
      if (["cpf_invalido", "cpf_duplicado"].includes(erro.codigo)) {
        const campoCpf = formulario.elements.cpf;
        campoCpf.setCustomValidity(erro.message);
        campoCpf.classList.add("campo-invalido");
        campoCpf.setAttribute("aria-invalid", "true");
        campoCpf.focus();
        campoCpf.reportValidity();
        return;
      }

      mostrarAviso(erro.message, "erro");
    }
  }

  function desativarCliente(identificador) {
    const cliente = clientePorId(identificador);
    confirmar({
      titulo: "Desativar cliente?",
      mensagem: `${cliente?.nome || "Este cliente"} deixará de aparecer nas seleções de novos atendimentos. O histórico será preservado.`,
      rotulo: "Desativar",
      acao: async () => {
        try {
          await requisitarApi("clientes.php", { metodo: "DELETE", dados: { id: identificador } });
          mostrarAviso("Cliente desativado.");
          await carregarClientes();
        } catch (erro) {
          mostrarAviso(erro.message, "erro");
        }
      },
    });
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("clientes", "Clientes");
      await carregarClientes();
      if (new URLSearchParams(window.location.search).has("novo")) abrirFormulario();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.getElementById("novo-cliente").addEventListener("click", () => abrirFormulario());
  document.querySelectorAll("[data-fechar-modal]").forEach((botao) => botao.addEventListener("click", fecharFormulario));
  document.getElementById("modal-cliente").addEventListener("click", (evento) => {
    if (evento.target.id === "modal-cliente") fecharFormulario();
  });
  document.getElementById("formulario-cliente").addEventListener("submit", salvarCliente);
  document.getElementById("cliente-cpf").addEventListener("input", (evento) => {
    evento.currentTarget.value = formatarCpf(evento.currentTarget.value);
    validarCampoCpf(false);
  });
  document.getElementById("cliente-cpf").addEventListener("blur", () => validarCampoCpf(false));
  document.getElementById("busca-clientes").addEventListener("input", () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => carregarClientes().catch((erro) => mostrarAviso(erro.message, "erro")), 280);
  });
  document.getElementById("situacao-clientes").addEventListener("change", () => {
    carregarClientes().catch((erro) => mostrarAviso(erro.message, "erro"));
  });

  iniciarPagina();
})();
