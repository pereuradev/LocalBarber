(function () {
  "use strict";

  const CHAVE_TEMA = "localbarber-theme";
  const CHAVE_COR_TEMA = "localbarber-cor-tema";
  const COR_TEMA_PADRAO = "#244BC5";
  const CORES_REFERENCIA = {
    claro: "#FFFFFF",
    escuro: "#0B2244",
    preto: "#000000",
    branco: "#FFFFFF",
  };

  function corHexValida(cor) {
    return /^#[0-9A-F]{6}$/i.test(String(cor || ""));
  }

  function normalizarCorHex(cor) {
    return corHexValida(cor) ? String(cor).toUpperCase() : COR_TEMA_PADRAO;
  }

  function converterHexParaRgb(cor) {
    const corNormalizada = normalizarCorHex(cor).slice(1);
    return {
      vermelho: Number.parseInt(corNormalizada.slice(0, 2), 16),
      verde: Number.parseInt(corNormalizada.slice(2, 4), 16),
      azul: Number.parseInt(corNormalizada.slice(4, 6), 16),
    };
  }

  function converterRgbParaHex({ vermelho, verde, azul }) {
    const canalParaHex = (canal) =>
      Math.round(Math.max(0, Math.min(255, canal))).toString(16).padStart(2, "0");

    return `#${canalParaHex(vermelho)}${canalParaHex(verde)}${canalParaHex(azul)}`.toUpperCase();
  }

  function misturarCores(corOrigem, corDestino, proporcaoDestino) {
    const origem = converterHexParaRgb(corOrigem);
    const destino = converterHexParaRgb(corDestino);
    const proporcao = Math.max(0, Math.min(1, proporcaoDestino));

    return converterRgbParaHex({
      vermelho: origem.vermelho + (destino.vermelho - origem.vermelho) * proporcao,
      verde: origem.verde + (destino.verde - origem.verde) * proporcao,
      azul: origem.azul + (destino.azul - origem.azul) * proporcao,
    });
  }

  function luminanciaRelativa(cor) {
    const canais = Object.values(converterHexParaRgb(cor)).map((canal) => {
      const valor = canal / 255;
      return valor <= 0.04045
        ? valor / 12.92
        : ((valor + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
  }

  function calcularContraste(corA, corB) {
    const maior = Math.max(luminanciaRelativa(corA), luminanciaRelativa(corB));
    const menor = Math.min(luminanciaRelativa(corA), luminanciaRelativa(corB));
    return (maior + 0.05) / (menor + 0.05);
  }

  function ajustarCorParaContraste(cor, fundo, corDeAjuste) {
    if (calcularContraste(cor, fundo) >= 4.5) {
      return cor;
    }

    for (let passo = 1; passo <= 20; passo += 1) {
      const corAjustada = misturarCores(cor, corDeAjuste, passo / 20);
      if (calcularContraste(corAjustada, fundo) >= 4.5) {
        return corAjustada;
      }
    }

    return corDeAjuste;
  }

  function aplicarCorTema(cor, salvar = true) {
    const corBase = normalizarCorHex(cor);
    const raiz = document.documentElement;
    const temaEscuro = raiz.dataset.theme === "dark";
    const fundo = temaEscuro ? CORES_REFERENCIA.escuro : CORES_REFERENCIA.claro;
    const ajuste = temaEscuro ? CORES_REFERENCIA.branco : CORES_REFERENCIA.preto;
    const corPrimaria = ajustarCorParaContraste(corBase, fundo, ajuste);
    const corPrimariaForte = misturarCores(
      corPrimaria,
      ajuste,
      temaEscuro ? 0.12 : 0.18
    );
    const corPrimariaSuave = misturarCores(corBase, fundo, temaEscuro ? 0.82 : 0.9);
    const contrasteBranco = calcularContraste(corPrimaria, CORES_REFERENCIA.branco);
    const contrastePreto = calcularContraste(corPrimaria, CORES_REFERENCIA.preto);
    const textoSobrePrimaria = contrasteBranco >= contrastePreto
      ? CORES_REFERENCIA.branco
      : CORES_REFERENCIA.preto;

    raiz.style.setProperty("--cor-tema-original", corBase);
    raiz.style.setProperty("--primaria", corPrimaria);
    raiz.style.setProperty("--primaria-forte", corPrimariaForte);
    raiz.style.setProperty("--primaria-suave", corPrimariaSuave);
    raiz.style.setProperty("--texto-sobre-primaria", textoSobrePrimaria);

    if (salvar) {
      localStorage.setItem(CHAVE_COR_TEMA, corBase);
    }

    return corBase;
  }

  function resolverTema(preferencia) {
    const preferenciaValida = ["light", "dark", "system"].includes(preferencia)
      ? preferencia
      : "system";

    return preferenciaValida === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preferenciaValida;
  }

  try {
    const tema = resolverTema(localStorage.getItem(CHAVE_TEMA) || "system");
    document.documentElement.dataset.theme = tema;
    document.documentElement.style.colorScheme = tema;
    aplicarCorTema(localStorage.getItem(CHAVE_COR_TEMA) || COR_TEMA_PADRAO, false);
  } catch {
    const tema = resolverTema("system");
    document.documentElement.dataset.theme = tema;
    document.documentElement.style.colorScheme = tema;
    aplicarCorTema(COR_TEMA_PADRAO, false);
  }

  const observarMudancaTema = new MutationObserver((alteracoes) => {
    if (alteracoes.some((alteracao) => alteracao.attributeName === "data-theme")) {
      aplicarCorTema(
        localStorage.getItem(CHAVE_COR_TEMA) || COR_TEMA_PADRAO,
        false
      );
    }
  });
  observarMudancaTema.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) {
      window.location.reload();
    }
  });

  window.LocalBarberTema = Object.freeze({
    aplicarCorTema,
    corHexValida,
    normalizarCorHex,
    COR_TEMA_PADRAO,
    CHAVE_COR_TEMA,
  });
})();
