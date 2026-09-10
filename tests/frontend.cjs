const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(path.join(root, "assets/js/api-localbarber.js"), "utf8");

function ambiente(fetch) {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const context = { window: { location: { pathname: "/pages/clientes.html", href: "" } },
    sessionStorage: storage, localStorage: storage, document: {}, fetch, crypto: webcrypto,
    Uint8Array, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(apiSource, context);
  return { context, api: context.window.LocalBarber };
}
const sessao = () => ({ ok: true, status: 200, json: async () => ({ sucesso: true, dados: {
  token_csrf: "token-teste", usuario: { nome: "Teste", permissoes: [] }, barbearia: { cor_tema: "#244BC5" },
} }) });

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

for (const [file,save,loader] of [
  ["transacoes-dados.js","salvarTransacao","carregarTransacoes"],
  ["agenda-dados.js","salvarAgendamento","carregarAgenda"],
]) {
  test(file + ": dois envios simultâneos produzem apenas uma requisição", async () => {
    const { context, api } = ambiente();
    Object.assign(context, api, { identificadorEmEdicao: null, paginaAtual: 1,
      FormData: class { *[Symbol.iterator]() { yield ["cliente", "Teste"]; } },
      fecharFormulario() {}, mostrarAviso() {}, [loader]: async () => {} });
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
