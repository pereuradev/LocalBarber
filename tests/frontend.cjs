const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(path.join(root, "assets/js/api-localbarber.js"), "utf8");
const themeSource = fs.readFileSync(path.join(root, "assets/js/theme-init.js"), "utf8");

function ambiente(fetch) {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const context = { window: { location: { pathname: "/pages/clientes.html", href: "" } },
    sessionStorage: storage, localStorage: storage, document: {}, fetch, crypto: webcrypto,
    Uint8Array, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  return { context, api: context.window.LocalBarber };
}
function executarTemaInicial({ paginaPublica = false, corUsuario = "#244BC5" } = {}) {
  const valores = new Map([["localbarber-cor-tema", "#B4235A"]]);
  const storage = {
    getItem: (chave) => valores.get(chave) ?? null,
    setItem: (chave, valor) => valores.set(chave, valor),
    removeItem: (chave) => valores.delete(chave),
  };
  const criarAlvo = () => ({ dataset: {}, style: { valores: {}, setProperty(nome, valor) { this.valores[nome] = valor; } } });
  const raiz = criarAlvo();
  raiz.hasAttribute = (nome) => nome === "data-acento-publico" && paginaPublica;
  const corpo = criarAlvo();
  const sessaoStorage = {
    getItem: (chave) => chave === "localbarber:sessao-visual"
      ? JSON.stringify({ usuario: { id: "usuario-teste", cor_tema: corUsuario } })
      : null,
  };
  const janela = {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
  };
  const context = {
    window: janela,
    document: { documentElement: raiz, body: corpo },
    localStorage: storage,
    sessionStorage: sessaoStorage,
    MutationObserver: class { observe() {} },
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(themeSource, context);
  return { raiz, corpo, valores };
}
const sessao = () => ({ ok: true, status: 200, json: async () => ({ sucesso: true, dados: {
  token_csrf: "token-teste", usuario: { id: "usuario-teste", nome: "Teste", permissoes: [], cor_tema: "#244BC5" }, barbearia: {},
} }) });

test("landing mantém o azul público e não herda a cor da conta", () => {
  const { raiz, valores } = executarTemaInicial({ paginaPublica: true, corUsuario: "#B4235A" });
  assert.equal(raiz.style.valores["--cor-tema-original"], "#244BC5");
  assert.equal(valores.has("localbarber-cor-tema"), false);
});

test("cada sessão visual aplica a cor do próprio usuário", () => {
  const primeiro = executarTemaInicial({ corUsuario: "#0F766E" });
  const segundo = executarTemaInicial({ corUsuario: "#7C3AED" });
  assert.equal(primeiro.raiz.style.valores["--cor-tema-original"], "#0F766E");
  assert.equal(segundo.raiz.style.valores["--cor-tema-original"], "#7C3AED");
});

test("erro 503 preserva a tela e permite consultar a sessão novamente", async () => {
  let chamadas = 0;
  const { context, api } = ambiente(async () => ++chamadas === 1
    ? { ok: false, status: 503, json: async () => ({ mensagem: "Banco indisponível" }) } : sessao());
  await assert.rejects(api.obterSessao(), /Banco indisponível/);
  assert.equal(context.window.location.href, "");
  await api.obterSessao();
  assert.equal(chamadas, 2);
});
test("sessão expirada redireciona para o login", async () => {
  const { context, api } = ambiente(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  await assert.rejects(api.obterSessao());
  assert.match(context.window.location.href, /login=necessario/);
});
test("falha de rede não é confundida com logout", async () => {
  const { context, api } = ambiente(async () => { throw new Error("Sem conexão"); });
  await assert.rejects(api.obterSessao());
  assert.equal(context.window.location.href, "");
});
test("uma tentativa sem resposta reutiliza a chave; uma nova transação ganha outra", async () => {
  const chaves = [];
  const { api } = ambiente(async (url, options) => {
    if (url.includes("sessao.php")) return sessao();
    chaves.push(options.headers["Idempotency-Key"]);
    if (chaves.length === 1) throw new Error("Resposta perdida");
    return { ok: true, status: 200, json: async () => ({ sucesso: true, dados: { id: "registro" } }) };
  });
  const envio = () => api.requisitarApi("transacoes.php", { metodo: "POST", dados: { valor: 50 } });
  await assert.rejects(envio(), /Resposta perdida/);
  await envio();
  await envio();
  assert.match(chaves[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(chaves[0], chaves[1]);
  assert.notEqual(chaves[1], chaves[2]);
});
test("campos financeiros usam São Paulo inclusive na virada do dia", () => {
  const { api } = ambiente();
  assert.equal(api.dataHoraSaoPaulo("2026-09-10T13:00:00Z"), "2026-09-10T10:00");
  assert.equal(api.dataHoraSaoPaulo("2026-09-10T01:00:00Z"), "2026-09-09T22:00");
  assert.equal(api.dataHoraSaoPaulo("inválida"), "");
});

test("telefones brasileiros são formatados de forma consistente", () => {
  const { api } = ambiente();
  assert.equal(api.formatarTelefone("11987654321"), "(11) 98765-4321");
  assert.equal(api.formatarTelefone("1134567890"), "(11) 3456-7890");
  assert.equal(api.formatarTelefone("+55 11 98765-4321"), "(11) 98765-4321");
});

for (const [file,save,loader] of [
  ["transacoes-dados.js","salvarTransacao","carregarTransacoes"],
  ["agenda-dados.js","salvarAgendamento","carregarAgenda"],
]) {
  test(file + ": dois envios simultâneos produzem apenas uma requisição", async () => {
    const { context, api } = ambiente();
    Object.assign(context, api, { identificadorEmEdicao: null, paginaAtual: 1,
      FormData: class { *[Symbol.iterator]() { yield ["cliente", "Teste"]; } },
      fecharFormulario() {}, mostrarAviso() {}, mensagemHorarioInvalido: () => "",
      definirConfirmacaoEmAndamento() {}, [loader]: async () => {} });
    let requisicoes = 0;
    let resolver;
    context.requisitarApi = () => { requisicoes++; return new Promise((resolve) => { resolver = resolve; }); };
    const source = fs.readFileSync(path.join(root, "assets/js", file), "utf8");
    const inicio = source.indexOf("  async function " + save + "(");
    const fim = inicio + 1 + source.slice(inicio + 1).search(/\n  (?:async )?function /);
    vm.runInContext(source.slice(inicio, fim) + "; globalThis.salvarTeste=" + save, context);
    const botao = { disabled: false };
    const form = { querySelectorAll: () => [botao], setAttribute() {}, removeAttribute() {} };
    const evento = { preventDefault() {}, currentTarget: form };
    const primeiro = context.salvarTeste(evento);
    await context.salvarTeste(evento);
    assert.equal(requisicoes, 1);
    assert.equal(botao.disabled, true);
    resolver({});
    await primeiro;
    assert.equal(botao.disabled, false);
  });
}
test("referências locais e scripts internos das telas", () => {
  const files = ["index.html","cadastro-empresa.php","views/dashboard.html",
    ...fs.readdirSync(path.join(root,"pages")).filter((n) => n.endsWith(".html")).map((n) => "pages/" + n)];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root,file),"utf8");
    const base = file === "views/dashboard.html" ? root : path.dirname(path.join(root,file));
    for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      const ref = match[1].split(/[?#]/)[0];
      if (!ref || /^(?:[a-z]+:|\/\/|\$|<)/i.test(ref)) continue;
      assert.ok(fs.existsSync(path.resolve(base,ref)), file + ": " + ref);
    }
    for (const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (match[2].trim() && !/type\s*=\s*["']module/.test(match[1])) {
        assert.doesNotThrow(() => new vm.Script(match[2],{filename:file}));
      }
    }
  }
});
