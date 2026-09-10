(() => {
  "use strict";

  const {
    escaparHtml,
    estaAtivo,
    requisitarApi,
    inicializarLayout,
    mostrarAviso,
    mostrarModalAviso,
    confirmar,
    previsualizarCorTema,
    atualizarCorTema,
  } = window.LocalBarber;

  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const COR_TEMA_PADRAO = "#244BC5";
  const SATURACAO_MINIMA_RODA = 68;
  const PASSO_TECLADO_GRAUS = 4;
  let dadosOriginais = null;
  let formularioPronto = false;
  let formularioAlterado = false;

  function atualizarEstadoConfiguracoes(estado) {
    const barraAcoes = document.getElementById("configuracoes-acoes");
    const textoStatus = document.getElementById("configuracoes-status-texto");
    const botaoSalvar = document.getElementById("salvar-configuracoes");
    const botaoDescartar = document.getElementById("descartar-alteracoes");
    const mensagens = {
      carregando: "Carregando configurações",
      salvo: "Tudo atualizado",
      alterado: "Alterações não salvas",
      salvando: "Salvando alterações",
      erro: "Não foi possível carregar os dados",
    };
    const permiteAcao = estado === "alterado";

    barraAcoes.dataset.estado = estado;
    textoStatus.textContent = mensagens[estado] || mensagens.salvo;
    botaoSalvar.disabled = !permiteAcao;
    botaoDescartar.disabled = !permiteAcao;
  }

  function marcarFormularioAlterado() {
    if (!formularioPronto || formularioAlterado) return;
    formularioAlterado = true;
    atualizarEstadoConfiguracoes("alterado");
  }

  function aoAlterarFormulario(evento) {
    if (evento.target.closest("[data-ignorar-alteracao]")) return;
    marcarFormularioAlterado();
  }

  function definirCarregamentoDados(ativo) {
    const formulario = document.getElementById("formulario-barbearia");
    const layout = document.getElementById("configuracoes-layout");

    formulario.dataset.carregando = String(ativo);
    layout.setAttribute("aria-busy", String(ativo));
  }

  function limitar(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
  }

  function normalizarMatiz(matiz) {
    return ((Number(matiz) % 360) + 360) % 360;
  }

  function converterHexParaHsl(cor) {
    const corNormalizada = window.LocalBarberTema?.normalizarCorHex(cor)
      || COR_TEMA_PADRAO;
    const vermelho = Number.parseInt(corNormalizada.slice(1, 3), 16) / 255;
    const verde = Number.parseInt(corNormalizada.slice(3, 5), 16) / 255;
    const azul = Number.parseInt(corNormalizada.slice(5, 7), 16) / 255;
    const maiorCanal = Math.max(vermelho, verde, azul);
    const menorCanal = Math.min(vermelho, verde, azul);
    const diferenca = maiorCanal - menorCanal;
    const luminosidade = (maiorCanal + menorCanal) / 2;
    let matiz = 0;

    if (diferenca !== 0) {
      if (maiorCanal === vermelho) {
        matiz = 60 * (((verde - azul) / diferenca) % 6);
      } else if (maiorCanal === verde) {
        matiz = 60 * ((azul - vermelho) / diferenca + 2);
      } else {
        matiz = 60 * ((vermelho - verde) / diferenca + 4);
      }
    }

    const saturacao = diferenca === 0
      ? 0
      : diferenca / (1 - Math.abs(2 * luminosidade - 1));

    return {
      matiz: normalizarMatiz(matiz),
      saturacao: saturacao * 100,
      luminosidade: luminosidade * 100,
    };
  }

  function converterHslParaHex({ matiz, saturacao, luminosidade }) {
    const matizNormalizada = normalizarMatiz(matiz);
    const saturacaoNormalizada = limitar(saturacao, 0, 100) / 100;
    const luminosidadeNormalizada = limitar(luminosidade, 0, 100) / 100;
    const croma = (1 - Math.abs(2 * luminosidadeNormalizada - 1)) * saturacaoNormalizada;
    const posicao = matizNormalizada / 60;
    const componenteIntermediario = croma * (1 - Math.abs((posicao % 2) - 1));
    const ajuste = luminosidadeNormalizada - croma / 2;
    let canais = [0, 0, 0];

    if (posicao < 1) canais = [croma, componenteIntermediario, 0];
    else if (posicao < 2) canais = [componenteIntermediario, croma, 0];
    else if (posicao < 3) canais = [0, croma, componenteIntermediario];
    else if (posicao < 4) canais = [0, componenteIntermediario, croma];
    else if (posicao < 5) canais = [componenteIntermediario, 0, croma];
    else canais = [croma, 0, componenteIntermediario];

    return `#${canais.map((canal) =>
      Math.round((canal + ajuste) * 255).toString(16).padStart(2, "0")
    ).join("").toUpperCase()}`;
  }

  function atualizarIndicadorRoda(cor) {
    const seletor = document.getElementById("seletor-cor-esfera");
    const { matiz } = converterHexParaHsl(cor);
    const matizArredondada = Math.round(matiz);

    seletor.style.setProperty("--angulo-cor", `${matiz}deg`);
    seletor.setAttribute("aria-valuenow", String(matizArredondada));
    seletor.setAttribute("aria-valuetext", cor);
  }

  function atualizarSeletorCor(cor, aplicarNoSistema = true) {
    const corNormalizada = window.LocalBarberTema?.normalizarCorHex(cor)
      || COR_TEMA_PADRAO;
    const campoCor = document.getElementById("cor-tema");
    const valorCor = document.getElementById("valor-cor-tema");

    campoCor.value = corNormalizada;
    valorCor.textContent = corNormalizada;
    atualizarIndicadorRoda(corNormalizada);
    document.querySelectorAll("[data-cor-preset]").forEach((botao) => {
      const selecionado = botao.dataset.corPreset === corNormalizada;
      botao.classList.toggle("selecionado", selecionado);
      botao.setAttribute("aria-pressed", String(selecionado));
    });

    if (aplicarNoSistema) {
      previsualizarCorTema(corNormalizada);
    }

    return corNormalizada;
  }

  function selecionarMatiz(matiz) {
    const campoCor = document.getElementById("cor-tema");
    const corAtual = converterHexParaHsl(campoCor.value);
    const novaCor = converterHslParaHex({
      matiz,
      saturacao: Math.max(corAtual.saturacao, SATURACAO_MINIMA_RODA),
      luminosidade: limitar(corAtual.luminosidade, 42, 56),
    });

    atualizarSeletorCor(novaCor);
    marcarFormularioAlterado();
  }

  function selecionarCorPelaPosicao(evento) {
    const seletor = document.getElementById("seletor-cor-esfera");
    const limites = seletor.getBoundingClientRect();
    const centroX = limites.left + limites.width / 2;
    const centroY = limites.top + limites.height / 2;
    const deslocamentoX = evento.clientX - centroX;
    const deslocamentoY = evento.clientY - centroY;
    const distanciaDoCentro = Math.hypot(deslocamentoX, deslocamentoY);

    if (distanciaDoCentro < limites.width * 0.2) return;

    const angulo = normalizarMatiz(
      Math.atan2(deslocamentoX, -deslocamentoY) * (180 / Math.PI)
    );
    selecionarMatiz(angulo);
  }

  function iniciarSelecaoNaRoda(evento) {
    if (evento.button !== 0) return;
    const seletor = evento.currentTarget;

    seletor.classList.add("esta-arrastando");
    seletor.setPointerCapture(evento.pointerId);
    selecionarCorPelaPosicao(evento);
    evento.preventDefault();
  }

  function continuarSelecaoNaRoda(evento) {
    const seletor = evento.currentTarget;
    if (!seletor.hasPointerCapture(evento.pointerId)) return;
    selecionarCorPelaPosicao(evento);
  }

  function finalizarSelecaoNaRoda(evento) {
    const seletor = evento.currentTarget;
    seletor.classList.remove("esta-arrastando");
    if (seletor.hasPointerCapture(evento.pointerId)) {
      seletor.releasePointerCapture(evento.pointerId);
    }
  }

  function selecionarCorPeloTeclado(evento) {
    const campoCor = document.getElementById("cor-tema");
    const { matiz } = converterHexParaHsl(campoCor.value);
    const passos = {
      ArrowLeft: -PASSO_TECLADO_GRAUS,
      ArrowDown: -PASSO_TECLADO_GRAUS,
      ArrowRight: PASSO_TECLADO_GRAUS,
      ArrowUp: PASSO_TECLADO_GRAUS,
      PageDown: -15,
      PageUp: 15,
    };

    if (evento.key === "Home") selecionarMatiz(0);
    else if (evento.key === "End") selecionarMatiz(359);
    else if (passos[evento.key]) selecionarMatiz(matiz + passos[evento.key]);
    else return;

    evento.preventDefault();
  }

  function configurarSeletorCorDireto() {
    const seletor = document.getElementById("seletor-cor-esfera");
    seletor.addEventListener("pointerdown", iniciarSelecaoNaRoda);
    seletor.addEventListener("pointermove", continuarSelecaoNaRoda);
    seletor.addEventListener("pointerup", finalizarSelecaoNaRoda);
    seletor.addEventListener("pointercancel", finalizarSelecaoNaRoda);
    seletor.addEventListener("keydown", selecionarCorPeloTeclado);

    document.querySelectorAll("[data-cor-preset]").forEach((botao) => {
      botao.addEventListener("click", () => {
        atualizarSeletorCor(botao.dataset.corPreset);
        marcarFormularioAlterado();
      });
    });
  }

  function renderizarHorarios(horarios) {
    const porDia = new Map(horarios.map((horario) => [Number(horario.dia_semana), horario]));
    const linhas = diasSemana.map((dia, indice) => {
      const horario = porDia.get(indice);
      const ativo = horario ? estaAtivo(horario.ativo) : false;
      return `
        <div class="linha-horario" data-dia="${indice}">
          <strong>${dia}</strong>
          <label class="horario-campo">
            <span>Abertura</span>
            <input class="campo" data-abertura type="time" value="${escaparHtml(horario?.abertura?.slice(0, 5) || "")}" ${ativo ? "" : "disabled"} aria-label="Abertura de ${dia}">
          </label>
          <label class="horario-campo">
            <span>Fechamento</span>
            <input class="campo" data-fechamento type="time" value="${escaparHtml(horario?.fechamento?.slice(0, 5) || "")}" ${ativo ? "" : "disabled"} aria-label="Fechamento de ${dia}">
          </label>
          <label class="interruptor-horario">
            <input data-ativo type="checkbox" ${ativo ? "checked" : ""} aria-label="Atendimento na ${dia}">
            <span class="interruptor-trilho" aria-hidden="true"><span></span></span>
            <span data-rotulo-horario>${ativo ? "Aberto" : "Fechado"}</span>
          </label>
        </div>`;
    }).join("");
    document.getElementById("horarios-funcionamento").innerHTML = `
      <div class="horarios-cabecalho" aria-hidden="true">
        <span>Dia</span>
        <span>Abertura</span>
        <span>Fechamento</span>
        <span>Situação</span>
      </div>
      ${linhas}`;

    document.querySelectorAll("[data-ativo]").forEach((controle) => {
      controle.addEventListener("change", () => {
        const linha = controle.closest(".linha-horario");
        linha.querySelectorAll("input[type=time]").forEach((campo) => {
          campo.disabled = !controle.checked;
        });
        linha.querySelector("[data-rotulo-horario]").textContent = controle.checked
          ? "Aberto"
          : "Fechado";
      });
    });
  }

  function preencherFormulario(dados) {
    document.getElementById("documento-status").textContent = dados.barbearia.documento_requer_regularizacao
      ? "O CNPJ do cadastro antigo precisa ser regularizado. Informe um documento válido e ativo para atualizá-lo."
      : "Ao alterar o CNPJ, verificaremos a situação cadastral da empresa.";
    formularioPronto = false;
    dadosOriginais = dados;
    const formulario = document.getElementById("formulario-barbearia");
    Object.entries(dados.barbearia || {}).forEach(([nome, valor]) => {
      if (formulario.elements[nome]) formulario.elements[nome].value = valor ?? "";
    });
    Object.entries(dados.endereco || {}).forEach(([nome, valor]) => {
      if (formulario.elements[nome]) formulario.elements[nome].value = valor ?? "";
    });
    if (!formulario.elements.pais.value) formulario.elements.pais.value = "Brasil";
    atualizarSeletorCor(dados.barbearia?.cor_tema || COR_TEMA_PADRAO);
    renderizarHorarios(dados.horarios || []);

    const redes = new Map((dados.redes_sociais || []).map((rede) => [rede.plataforma, rede]));
    document.querySelectorAll("[data-rede]").forEach((campo) => {
      const rede = redes.get(campo.dataset.rede);
      campo.value = rede?.identificador || rede?.url || "";
    });
    formularioAlterado = false;
    formularioPronto = true;
    atualizarEstadoConfiguracoes("salvo");
  }

  async function carregarBarbearia() {
    definirCarregamentoDados(true);
    try {
      const dados = await requisitarApi("barbearia.php");
      preencherFormulario(dados);
    } finally {
      definirCarregamentoDados(false);
    }
  }

  function coletarHorarios() {
    return Array.from(document.querySelectorAll(".linha-horario")).map((linha) => ({
      dia_semana: Number(linha.dataset.dia),
      abertura: linha.querySelector("[data-abertura]").value || null,
      fechamento: linha.querySelector("[data-fechamento]").value || null,
      ativo: linha.querySelector("[data-ativo]").checked,
    }));
  }

  function coletarRedes() {
    return Array.from(document.querySelectorAll("[data-rede]")).map((campo) => {
      const valor = campo.value.trim();
      const contemUrl = /^https?:\/\//i.test(valor);
      return {
        plataforma: campo.dataset.rede,
        identificador: contemUrl ? null : valor || null,
        url: contemUrl ? valor : null,
      };
    });
  }

  async function salvarBarbearia(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const campos = Object.fromEntries(new FormData(formulario));
    const barbearia = {
      nome_fantasia: campos.nome_fantasia,
      razao_social: campos.razao_social,
      documento: campos.documento,
      categoria: campos.categoria,
      telefone: campos.telefone,
      email: campos.email,
      descricao: campos.descricao,
      cor_tema: atualizarSeletorCor(campos.cor_tema),
    };
    const endereco = {
      cep: campos.cep,
      logradouro: campos.logradouro,
      numero: campos.numero,
      complemento: campos.complemento,
      bairro: campos.bairro,
      cidade: campos.cidade,
      uf: String(campos.uf || "").toUpperCase(),
      pais: campos.pais,
    };

    try {
      atualizarEstadoConfiguracoes("salvando");
      const resultado = await requisitarApi("barbearia.php", {
        metodo: "PATCH",
        dados: {
          barbearia,
          endereco,
          horarios: coletarHorarios(),
          redes_sociais: coletarRedes(),
        },
      });
      atualizarCorTema(resultado.cor_tema);
      mostrarAviso("Dados da barbearia atualizados.");
      await carregarBarbearia();
    } catch (erro) {
      formularioAlterado = true;
      atualizarEstadoConfiguracoes("alterado");
      if (erro.codigo === "perfil_social_nao_encontrado") {
        mostrarModalAviso(
          "Perfil não encontrado",
          erro.message || "O perfil informado não existe. Por favor, tente novamente."
        );
        return;
      }

      mostrarAviso(erro.message, "erro");
    }
  }

  function descartarAlteracoes() {
    confirmar({
      titulo: "Descartar alterações?",
      mensagem: "Os campos voltarão aos últimos dados salvos no banco.",
      rotulo: "Descartar",
      acao: async () => {
        if (dadosOriginais) preencherFormulario(dadosOriginais);
        mostrarAviso("Alterações descartadas.");
      },
    });
  }

  async function buscarCep() {
    const cep = document.getElementById("cep").value.replace(/\D/g, "");
    if (cep.length !== 8) {
      mostrarAviso("Informe um CEP com oito dígitos.", "erro");
      return;
    }

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const endereco = await resposta.json();
      if (!resposta.ok || endereco.erro) throw new Error("CEP não encontrado.");
      document.getElementById("logradouro").value = endereco.logradouro || "";
      document.getElementById("bairro").value = endereco.bairro || "";
      document.getElementById("cidade").value = endereco.localidade || "";
      document.getElementById("uf").value = endereco.uf || "";
      marcarFormularioAlterado();
      mostrarAviso("Endereço preenchido. Revise antes de salvar.");
    } catch (erro) {
      mostrarAviso(erro.message || "Não foi possível consultar o CEP.", "erro");
    }
  }

  function validarCamposSenha({ senhaAtual, novaSenha, confirmacaoSenha }) {
    if (!senhaAtual) {
      return {
        valido: false,
        campo: "senha-atual",
        mensagem: "Informe sua senha atual.",
      };
    }

    if (!novaSenha) {
      return {
        valido: false,
        campo: "nova-senha",
        mensagem: "Informe a nova senha.",
      };
    }

    if (
      novaSenha.length < 8
      || novaSenha.length > 72
      || !/\p{L}/u.test(novaSenha)
      || !/\d/u.test(novaSenha)
    ) {
      return {
        valido: false,
        campo: "nova-senha",
        mensagem: "A nova senha deve ter entre 8 e 72 caracteres, com pelo menos uma letra e um número.",
      };
    }

    if (novaSenha !== confirmacaoSenha) {
      return {
        valido: false,
        campo: "confirmar-nova-senha",
        mensagem: "A confirmação da nova senha não confere.",
      };
    }

    if (novaSenha === senhaAtual) {
      return {
        valido: false,
        campo: "nova-senha",
        mensagem: "A nova senha precisa ser diferente da senha atual.",
      };
    }

    return { valido: true };
  }

  function definirSalvamentoSenha(ativo) {
    document.querySelectorAll("#senha-atual, #nova-senha, #confirmar-nova-senha, #salvar-senha, [data-alternar-senha]")
      .forEach((elemento) => {
        elemento.disabled = ativo;
      });
    document.getElementById("salvar-senha").textContent = ativo
      ? "Alterando..."
      : "Alterar senha";
  }

  function limparCamposSenha() {
    document.querySelectorAll("#senha-atual, #nova-senha, #confirmar-nova-senha")
      .forEach((campo) => {
        campo.value = "";
        campo.type = "password";
      });
    document.querySelectorAll("[data-alternar-senha]").forEach((botao) => {
      botao.textContent = "Mostrar";
      botao.setAttribute("aria-pressed", "false");
      const campo = document.getElementById(botao.dataset.alternarSenha);
      botao.setAttribute("aria-label", `Mostrar ${campo?.labels?.[0]?.textContent?.toLowerCase() || "senha"}`);
    });
  }

  async function salvarSenha() {
    const senhaAtual = document.getElementById("senha-atual").value;
    const novaSenha = document.getElementById("nova-senha").value;
    const confirmacaoSenha = document.getElementById("confirmar-nova-senha").value;
    const status = document.getElementById("senha-status");
    const validacao = validarCamposSenha({ senhaAtual, novaSenha, confirmacaoSenha });

    if (!validacao.valido) {
      status.textContent = validacao.mensagem;
      document.getElementById(validacao.campo)?.focus();
      mostrarAviso(validacao.mensagem, "erro");
      return;
    }

    try {
      definirSalvamentoSenha(true);
      status.textContent = "Alterando senha...";
      await requisitarApi("senha.php", {
        metodo: "PATCH",
        dados: {
          senha_atual: senhaAtual,
          nova_senha: novaSenha,
          confirmacao_senha: confirmacaoSenha,
        },
      });
      limparCamposSenha();
      status.textContent = "Senha atualizada com sucesso.";
      mostrarAviso("Senha alterada com sucesso.");
    } catch (erro) {
      status.textContent = erro.message || "Não foi possível alterar a senha.";
      mostrarAviso(status.textContent, "erro");
    } finally {
      definirSalvamentoSenha(false);
    }
  }

  function alternarVisibilidadeSenha(evento) {
    const botao = evento.currentTarget;
    const campo = document.getElementById(botao.dataset.alternarSenha);
    if (!campo) return;

    const vaiMostrar = campo.type === "password";
    campo.type = vaiMostrar ? "text" : "password";
    botao.textContent = vaiMostrar ? "Ocultar" : "Mostrar";
    botao.setAttribute("aria-pressed", String(vaiMostrar));
    botao.setAttribute(
      "aria-label",
      `${vaiMostrar ? "Ocultar" : "Mostrar"} ${campo.labels?.[0]?.textContent?.toLowerCase() || "senha"}`
    );
  }

  function configurarAlteracaoSenha() {
    document.getElementById("salvar-senha").addEventListener("click", salvarSenha);
    document.querySelectorAll("[data-alternar-senha]").forEach((botao) => {
      botao.addEventListener("click", alternarVisibilidadeSenha);
    });
    document.querySelectorAll("#senha-atual, #nova-senha, #confirmar-nova-senha").forEach((campo) => {
      campo.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter") return;
        evento.preventDefault();
        salvarSenha();
      });
    });
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("barbearia", "Configurações");
      await carregarBarbearia();
    } catch (erro) {
      atualizarEstadoConfiguracoes("erro");
      mostrarAviso(erro.message, "erro");
    }
  }

  function configurarNavegacaoConfiguracoes() {
    const links = Array.from(document.querySelectorAll("[data-config-link]"));
    const secoes = links
      .map((link) => document.getElementById(link.dataset.configLink))
      .filter(Boolean);

    function ativarLink(id) {
      links.forEach((link) => {
        const ativo = link.dataset.configLink === id;
        link.classList.toggle("ativo", ativo);
        if (ativo) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }

    links.forEach((link) => {
      link.addEventListener("click", (evento) => {
        const secao = document.getElementById(link.dataset.configLink);
        if (!secao) return;
        evento.preventDefault();
        ativarLink(secao.id);
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if (!("IntersectionObserver" in window)) return;
    const observador = new IntersectionObserver((entradas) => {
      const visiveis = entradas
        .filter((entrada) => entrada.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visiveis[0]) ativarLink(visiveis[0].target.id);
    }, { rootMargin: "-18% 0px -62%", threshold: [0, 0.2, 0.5] });

    secoes.forEach((secao) => observador.observe(secao));
  }

  const formulario = document.getElementById("formulario-barbearia");
  formulario.addEventListener("submit", salvarBarbearia);
  formulario.addEventListener("input", aoAlterarFormulario);
  formulario.addEventListener("change", aoAlterarFormulario);
  document.getElementById("buscar-cep").addEventListener("click", buscarCep);
  document.getElementById("descartar-alteracoes").addEventListener("click", descartarAlteracoes);
  configurarSeletorCorDireto();
  configurarNavegacaoConfiguracoes();
  configurarAlteracaoSenha();
  document.getElementById("restaurar-cor-tema").addEventListener("click", () => {
    atualizarSeletorCor(COR_TEMA_PADRAO);
    marcarFormularioAlterado();
  });
  window.addEventListener("beforeunload", (evento) => {
    if (!formularioAlterado) return;
    evento.preventDefault();
    evento.returnValue = "";
  });

  iniciarPagina();
})();
