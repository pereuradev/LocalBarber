(() => {
  "use strict";

  const {
    escaparHtml,
    estaAtivo,
    requisitarApi,
    inicializarLayout,
    mostrarAviso,
    confirmar,
    previsualizarCorTema,
    atualizarCorTema,
  } = window.LocalBarber;

  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const COR_TEMA_PADRAO = "#244BC5";
  const SATURACAO_MINIMA_RODA = 68;
  const PASSO_TECLADO_GRAUS = 4;
  let dadosOriginais = null;

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
  }

  function renderizarHorarios(horarios) {
    const porDia = new Map(horarios.map((horario) => [Number(horario.dia_semana), horario]));
    document.getElementById("horarios-funcionamento").innerHTML = diasSemana.map((dia, indice) => {
      const horario = porDia.get(indice);
      const ativo = horario ? estaAtivo(horario.ativo) : false;
      return `
        <div class="linha-horario" data-dia="${indice}">
          <strong>${dia}</strong>
          <input class="campo" data-abertura type="time" value="${escaparHtml(horario?.abertura?.slice(0, 5) || "")}" ${ativo ? "" : "disabled"} aria-label="Abertura de ${dia}">
          <input class="campo" data-fechamento type="time" value="${escaparHtml(horario?.fechamento?.slice(0, 5) || "")}" ${ativo ? "" : "disabled"} aria-label="Fechamento de ${dia}">
          <label><input data-ativo type="checkbox" ${ativo ? "checked" : ""}> Aberto</label>
        </div>`;
    }).join("");

    document.querySelectorAll("[data-ativo]").forEach((controle) => {
      controle.addEventListener("change", () => {
        controle.closest(".linha-horario").querySelectorAll("input[type=time]").forEach((campo) => {
          campo.disabled = !controle.checked;
        });
      });
    });
  }

  function preencherFormulario(dados) {
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
  }

  async function carregarBarbearia() {
    const dados = await requisitarApi("barbearia.php");
    preencherFormulario(dados);
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
      mostrarAviso("Endereço preenchido. Revise antes de salvar.");
    } catch (erro) {
      mostrarAviso(erro.message || "Não foi possível consultar o CEP.", "erro");
    }
  }

  async function iniciarPagina() {
    try {
      await inicializarLayout("barbearia", "Minha Barbearia");
      await carregarBarbearia();
    } catch (erro) {
      mostrarAviso(erro.message, "erro");
    }
  }

  document.getElementById("formulario-barbearia").addEventListener("submit", salvarBarbearia);
  document.getElementById("buscar-cep").addEventListener("click", buscarCep);
  document.getElementById("descartar-alteracoes").addEventListener("click", descartarAlteracoes);
  document.querySelector("[data-acao-descartar]").addEventListener("click", descartarAlteracoes);
  configurarSeletorCorDireto();
  document.getElementById("restaurar-cor-tema").addEventListener("click", () => {
    atualizarSeletorCor(COR_TEMA_PADRAO);
  });

  iniciarPagina();
})();
