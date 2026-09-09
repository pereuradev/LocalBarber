(() => {
  "use strict";

  const {
    escaparHtml,
    estaAtivo,
    requisitarApi,
    inicializarLayout,
    mostrarAviso,
    confirmar,
    abrirModal,
    fecharModal,
  } = window.LocalBarber;

  let funcionarios = [];
  let identificadorEmEdicao = null;
  let temporizadorBusca = null;

  const rotulosStatus = {
    online: "Online",
    busy: "Ocupado",
    offline: "Offline",
  };

  const descricoesPerfil = {
    administrador: {
      titulo: "Administrador",
      descricao: "Acesso completo ao dashboard, agenda, clientes, serviços, financeiro, equipe e configurações.",
    },
    colaborador: {
      titulo: "Colaborador",
      descricao: "Pode gerenciar agenda e clientes e consultar serviços. Não acessa financeiro, equipe ou configurações.",
    },
  };

  const EXPRESSAO_NOME = /^[\p{L}](?:[\p{L}\s'’.-]*[\p{L}'’])?$/u;
  const EXPRESSAO_FUNCAO = /^[\p{L}\s'’().&/-]+$/u;
  const EXPRESSAO_TELEFONE =
    /^(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[13-5]|6[1-9]|7[134579]|8[1-9]|9[1-9])\d{8,9}$/;

  function normalizarEspacos(valor) {
    return String(valor || "").trim().replace(/\s+/g, " ");
  }

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

  function obterDigitosTelefone(valor) {
    return String(valor || "").replace(/\D/g, "").slice(0, 11);
  }

  function formatarTelefone(valor) {
    const digitos = obterDigitosTelefone(valor);

    if (!digitos) return "";
    if (digitos.length <= 2) return `(${digitos}`;

    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);

    if (numero.length <= 4) return `(${ddd}) ${numero}`;

    const tamanhoPrefixo = digitos.length === 11 ? 5 : 4;
    return `(${ddd}) ${numero.slice(0, tamanhoPrefixo)}-${numero.slice(tamanhoPrefixo)}`;
  }

  function definirValidade(campo, mensagem = "") {
    campo.setCustomValidity(mensagem);
    campo.classList.toggle("campo-invalido", Boolean(mensagem));

    if (mensagem) {
      campo.setAttribute("aria-invalid", "true");
    } else {
      campo.removeAttribute("aria-invalid");
    }

    return mensagem === "";
  }

  function validarNome() {
    const campo = document.getElementById("funcionario-nome");
    const valor = normalizarEspacos(campo.value);
    let mensagem = "";

    if (!valor) {
      mensagem = "Informe o nome do profissional.";
    } else if (valor.length < 2 || !EXPRESSAO_NOME.test(valor)) {
      mensagem = "Use um nome com pelo menos 2 caracteres e apenas letras.";
    }

    return definirValidade(campo, mensagem);
  }

  function validarCpf() {
    const campo = document.getElementById("funcionario-cpf");
    const mensagem = cpfValido(campo.value) ? "" : "Informe um CPF válido.";
    return definirValidade(campo, mensagem);
  }

  function validarTelefone() {
    const campo = document.getElementById("funcionario-telefone");
    const digitos = obterDigitosTelefone(campo.value);
    const mensagem = digitos && !EXPRESSAO_TELEFONE.test(digitos)
      ? "Informe um DDD válido e um telefone com 10 ou 11 dígitos."
      : "";

    return definirValidade(campo, mensagem);
  }

  function validarEmail() {
    const campo = document.getElementById("funcionario-email");
    definirValidade(campo);
    let mensagem = "";

    if (!campo.value.trim()) {
      mensagem = "Informe o e-mail usado para acessar o sistema.";
    } else if (campo.validity.typeMismatch) {
      mensagem = "Informe um e-mail válido, como nome@empresa.com.";
    }

    return definirValidade(campo, mensagem);
  }

  function validarFuncao() {
    const campo = document.getElementById("funcionario-funcao");
    const valor = normalizarEspacos(campo.value);
    let mensagem = "";

    if (!valor) {
      mensagem = "Informe a função do profissional.";
    } else if (
      valor.length < 2
      || !EXPRESSAO_FUNCAO.test(valor)
      || !/\p{L}/u.test(valor)
    ) {
      mensagem = "Use uma função com pelo menos 2 caracteres e apenas letras ou pontuação adequada.";
    }

    return definirValidade(campo, mensagem);
  }

  function validarComissao() {
    const campo = document.getElementById("funcionario-comissao");
    const valor = campo.valueAsNumber;
    let mensagem = "";

    if (campo.value === "") {
      mensagem = "Informe a comissão padrão.";
    } else if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      mensagem = "Informe uma comissão entre 0 e 100%.";
    }

    return definirValidade(campo, mensagem);
  }

  function validarSenha() {
    const campo = document.getElementById("funcionario-senha");
    const senha = campo.value;
    let mensagem = "";

    if (!senha && campo.required) {
      mensagem = "Crie uma senha para o profissional.";
    } else if (
      senha
      && (
        senha.length < 8
        || senha.length > 72
        || !/\p{L}/u.test(senha)
        || !/\d/.test(senha)
      )
    ) {
      mensagem = "Use de 8 a 72 caracteres, com pelo menos uma letra e um número.";
    }

    return definirValidade(campo, mensagem);
  }

  function validarFormulario() {
    return [
      validarNome(),
      validarCpf(),
      validarTelefone(),
      validarEmail(),
      validarFuncao(),
      validarComissao(),
      validarSenha(),
    ].every(Boolean);
  }

  function limparIndicacoesInvalidas(formulario) {
    formulario.querySelectorAll("input, select").forEach((campo) => {
      definirValidade(campo);
    });
  }

  function configurarValidacaoFormulario() {
    const formulario = document.getElementById("formulario-funcionario");
    const campoNome = document.getElementById("funcionario-nome");
    const campoCpf = document.getElementById("funcionario-cpf");
    const campoTelefone = document.getElementById("funcionario-telefone");
    const campoEmail = document.getElementById("funcionario-email");
    const campoFuncao = document.getElementById("funcionario-funcao");
    const campoComissao = document.getElementById("funcionario-comissao");
    const campoSenha = document.getElementById("funcionario-senha");

    campoNome.addEventListener("input", () => {
      campoNome.value = campoNome.value.replace(/[^\p{L}\s'’.-]/gu, "");
      validarNome();
    });
    campoNome.addEventListener("blur", () => {
      campoNome.value = normalizarEspacos(campoNome.value);
      validarNome();
    });

    campoCpf.addEventListener("input", () => {
      campoCpf.value = formatarCpf(campoCpf.value);
      validarCpf();
    });
    campoCpf.addEventListener("blur", validarCpf);

    campoTelefone.addEventListener("keydown", (evento) => {
      const temAtalho = evento.ctrlKey || evento.metaKey || evento.altKey;
      if (!temAtalho && evento.key.length === 1 && !/\d/.test(evento.key)) {
        evento.preventDefault();
      }
    });
    campoTelefone.addEventListener("input", () => {
      campoTelefone.value = formatarTelefone(campoTelefone.value);
      validarTelefone();
    });
    campoTelefone.addEventListener("blur", validarTelefone);

    campoEmail.addEventListener("blur", () => {
      campoEmail.value = campoEmail.value.trim();
      validarEmail();
    });
    campoEmail.addEventListener("input", validarEmail);

    campoFuncao.addEventListener("input", () => {
      campoFuncao.value = campoFuncao.value.replace(/[^\p{L}\s'’().&/-]/gu, "");
      validarFuncao();
    });
    campoFuncao.addEventListener("blur", () => {
      campoFuncao.value = normalizarEspacos(campoFuncao.value);
      validarFuncao();
    });

    campoComissao.addEventListener("keydown", (evento) => {
      if (["e", "E", "+", "-"].includes(evento.key)) {
        evento.preventDefault();
      }
    });
    campoComissao.addEventListener("input", validarComissao);
    campoSenha.addEventListener("input", validarSenha);

    formulario.addEventListener("invalid", (evento) => {
      evento.target.classList.add("campo-invalido");
      evento.target.setAttribute("aria-invalid", "true");
    }, true);
  }

  function funcionarioPorId(identificador) {
    return funcionarios.find((funcionario) => funcionario.id === identificador);
  }

  function atualizarResumoPerfil() {
    const perfil = document.getElementById("funcionario-perfil").value;
    const configuracao = descricoesPerfil[perfil] || descricoesPerfil.colaborador;
    document.getElementById("resumo-perfil-acesso").innerHTML =
      `<strong>${configuracao.titulo}:</strong> ${configuracao.descricao}`;
  }

  function configurarCampoSenha(funcionario) {
    const campoSenha = document.getElementById("funcionario-senha");
    const rotuloSenha = document.getElementById("rotulo-funcionario-senha");
    const ajudaSenha = document.getElementById("ajuda-funcionario-senha");
    const botaoSenha = document.getElementById("alternar-senha-funcionario");
    const precisaCriarConta = !funcionario || !funcionario.tem_acesso;

    campoSenha.value = "";
    campoSenha.type = "password";
    campoSenha.required = precisaCriarConta;
    rotuloSenha.textContent = precisaCriarConta ? "Senha de acesso *" : "Nova senha";
    ajudaSenha.textContent = precisaCriarConta
      ? "Use entre 8 e 72 caracteres, com pelo menos uma letra e um número."
      : "Deixe em branco para manter a senha atual.";
    botaoSenha.textContent = "Mostrar";
    botaoSenha.setAttribute("aria-label", "Mostrar senha");
    botaoSenha.setAttribute("aria-pressed", "false");
  }

  function atualizarControleAtivo() {
    const campoAtivo = document.getElementById("funcionario-ativo");
    document.getElementById("estado-funcionario-ativo").textContent = campoAtivo.checked
      ? "Ativo"
      : "Inativo";
  }

  function abrirFormulario(funcionario = null) {
    identificadorEmEdicao = funcionario?.id || null;
    const formulario = document.getElementById("formulario-funcionario");
    formulario.reset();
    limparIndicacoesInvalidas(formulario);
    formulario.elements.comissao_padrao_percentual.value = "50";
    formulario.elements.status.value = "online";
    formulario.elements.perfil_acesso.value = "colaborador";
    formulario.elements.ativo.checked = true;
    document.getElementById("titulo-modal-funcionario").textContent =
      funcionario ? "Editar profissional" : "Adicionar profissional";

    if (funcionario) {
      formulario.elements.nome.value = funcionario.nome || "";
      formulario.elements.cpf.value = formatarCpf(funcionario.cpf || "");
      formulario.elements.telefone.value = formatarTelefone(funcionario.telefone || "");
      formulario.elements.email.value = funcionario.email || "";
      formulario.elements.funcao.value = funcionario.funcao || "";
      formulario.elements.comissao_padrao_percentual.value = funcionario.comissao_padrao_percentual || 0;
      formulario.elements.status.value = funcionario.status || "offline";
      formulario.elements.perfil_acesso.value = funcionario.perfil_acesso || "colaborador";
      formulario.elements.ativo.checked = estaAtivo(funcionario.ativo);
    }

    configurarCampoSenha(funcionario);
    atualizarResumoPerfil();
    atualizarControleAtivo();
    abrirModal("modal-funcionario");
  }

  function fecharFormulario() {
    identificadorEmEdicao = null;
    fecharModal("modal-funcionario");
  }

  function classeStatus(status) {
    if (status === "online") return "sucesso";
    if (status === "busy") return "alerta";
    return "perigo";
  }

  function renderizarTabela() {
    const recipiente = document.getElementById("conteudo-equipe");
    document.getElementById("quantidade-equipe").textContent =
      `${funcionarios.length} ${funcionarios.length === 1 ? "profissional" : "profissionais"}`;

    if (!funcionarios.length) {
      recipiente.innerHTML = `<div class="estado-vazio"><div>
        <strong>Nenhum profissional encontrado</strong>
        <p>Cadastre sua equipe para liberar a seleção de profissionais na agenda.</p>
      </div></div>`;
      return;
    }

    recipiente.innerHTML = `
      <table class="tabela">
        <thead><tr><th>Profissional</th><th>Função</th><th>Acesso</th><th>Status</th><th>Hoje</th><th>No mês</th><th>Comissão</th><th></th></tr></thead>
        <tbody>${funcionarios.map((funcionario) => `
          <tr>
            <td><strong>${escaparHtml(funcionario.nome)}</strong><br><span class="texto-suave">${escaparHtml(funcionario.email || funcionario.telefone || "Contato não informado")}</span><br><span class="texto-suave">${funcionario.cpf ? `CPF ${escaparHtml(formatarCpf(funcionario.cpf))}` : "CPF não informado"}</span></td>
            <td>${escaparHtml(funcionario.funcao)}</td>
            <td><span class="etiqueta ${funcionario.tem_acesso && estaAtivo(funcionario.usuario_ativo) ? "sucesso" : "perigo"}">${
              funcionario.tem_acesso
                ? `${funcionario.perfil_acesso === "administrador" ? "Administrador" : "Colaborador"}${estaAtivo(funcionario.usuario_ativo) ? "" : " inativo"}`
                : "Sem acesso"
            }</span></td>
            <td><span class="etiqueta ${classeStatus(funcionario.status)}">${rotulosStatus[funcionario.status] || funcionario.status}</span></td>
            <td>${Number(funcionario.atendimentos_hoje || 0)}</td>
            <td>${Number(funcionario.atendimentos_mes || 0)}</td>
            <td>${Number(funcionario.comissao_padrao_percentual || 0)}%</td>
            <td><div class="acoes-tabela">
              <button class="botao botao-icone" type="button" data-editar="${funcionario.id}" aria-label="Editar ${escaparHtml(funcionario.nome)}">✎</button>
              ${estaAtivo(funcionario.ativo) ? `<button class="botao botao-icone botao-perigo" type="button" data-desativar="${funcionario.id}" aria-label="Desativar ${escaparHtml(funcionario.nome)}">×</button>` : ""}
            </div></td>
          </tr>`).join("")}</tbody>
      </table>`;

    recipiente.querySelectorAll("[data-editar]").forEach((botao) => {
      botao.addEventListener("click", () => abrirFormulario(funcionarioPorId(botao.dataset.editar)));
    });
    recipiente.querySelectorAll("[data-desativar]").forEach((botao) => {
      botao.addEventListener("click", () => desativarFuncionario(botao.dataset.desativar));
    });
  }

  async function carregarEquipe() {
    const busca = encodeURIComponent(document.getElementById("busca-equipe").value.trim());
    const situacao = encodeURIComponent(document.getElementById("situacao-equipe").value);
    const funcao = encodeURIComponent(document.getElementById("funcao-equipe").value.trim());
    const dados = await requisitarApi(`funcionarios.php?busca=${busca}&situacao=${situacao}&funcao=${funcao}`);
    funcionarios = dados.funcionarios;
    document.getElementById("kpi-total").textContent = dados.resumo.total;
    document.getElementById("kpi-ativos").textContent = dados.resumo.ativos;
    document.getElementById("kpi-online").textContent = dados.resumo.online;
    document.getElementById("kpi-comissao").textContent = `${Number(dados.resumo.comissao_media || 0)}%`;
    renderizarTabela();
  }

  async function salvarFuncionario(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;

    formulario.elements.nome.value = normalizarEspacos(formulario.elements.nome.value);
    formulario.elements.cpf.value = formatarCpf(formulario.elements.cpf.value);
    formulario.elements.telefone.value = formatarTelefone(formulario.elements.telefone.value);
    formulario.elements.email.value = formulario.elements.email.value.trim();
    formulario.elements.funcao.value = normalizarEspacos(formulario.elements.funcao.value);

    if (!validarFormulario() || !formulario.reportValidity()) {
      return;
    }

    const dadosFormulario = Object.fromEntries(new FormData(formulario));
    dadosFormulario.cpf = obterDigitosCpf(dadosFormulario.cpf);
    dadosFormulario.ativo = formulario.elements.ativo.checked;
    const estavaEditando = Boolean(identificadorEmEdicao);

    try {
      await requisitarApi("funcionarios.php", {
        metodo: estavaEditando ? "PATCH" : "POST",
        dados: { ...dadosFormulario, ...(estavaEditando ? { id: identificadorEmEdicao } : {}) },
      });
      fecharFormulario();
      mostrarAviso(
        estavaEditando
          ? "Profissional e acesso atualizados."
          : "Profissional cadastrado com acesso ao sistema."
      );
      await carregarEquipe();
    } catch (erro) {
      if (["cpf_invalido", "cpf_duplicado"].includes(erro.codigo)) {
        const campoCpf = formulario.elements.cpf;
        definirValidade(campoCpf, erro.message);
        campoCpf.focus();
        campoCpf.reportValidity();
        return;
      }

      mostrarAviso(erro.message, "erro");
    }
  }

  function desativarFuncionario(identificador) {
    const funcionario = funcionarioPorId(identificador);
    confirmar({
      titulo: "Desativar profissional?",
      mensagem: `${funcionario?.nome || "Este profissional"} deixará de aparecer em novos agendamentos. Os registros anteriores serão preservados.`,
      rotulo: "Desativar",
      acao: async () => {
        try {
          await requisitarApi("funcionarios.php", { metodo: "DELETE", dados: { id: identificador } });
          mostrarAviso("Profissional desativado.");
          await carregarEquipe();
        } catch (erro) {
          mostrarAviso(erro.message, "erro");
        }
      },
    });
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("equipe", "Equipe");
      await carregarEquipe();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.getElementById("novo-funcionario").addEventListener("click", () => abrirFormulario());
  configurarValidacaoFormulario();
  document.getElementById("cancelar-funcionario").addEventListener("click", fecharFormulario);
  document.getElementById("formulario-funcionario").addEventListener("submit", salvarFuncionario);
  document.getElementById("funcionario-perfil").addEventListener("change", atualizarResumoPerfil);
  document.getElementById("funcionario-ativo").addEventListener("change", atualizarControleAtivo);
  document.getElementById("alternar-senha-funcionario").addEventListener("click", (evento) => {
    const campoSenha = document.getElementById("funcionario-senha");
    const vaiMostrar = campoSenha.type === "password";
    campoSenha.type = vaiMostrar ? "text" : "password";
    evento.currentTarget.textContent = vaiMostrar ? "Ocultar" : "Mostrar";
    evento.currentTarget.setAttribute("aria-label", vaiMostrar ? "Ocultar senha" : "Mostrar senha");
    evento.currentTarget.setAttribute("aria-pressed", String(vaiMostrar));
  });
  ["busca-equipe", "funcao-equipe"].forEach((identificador) => {
    document.getElementById(identificador).addEventListener("input", () => {
      clearTimeout(temporizadorBusca);
      temporizadorBusca = setTimeout(() => carregarEquipe().catch((erro) => mostrarAviso(erro.message, "erro")), 280);
    });
  });
  document.getElementById("situacao-equipe").addEventListener("change", () => {
    carregarEquipe().catch((erro) => mostrarAviso(erro.message, "erro"));
  });

  iniciarPagina();
})();
