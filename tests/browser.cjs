// Teste de interface: APIs simuladas, sem login real nem escrita no banco.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const permissoes = [...fs.readFileSync(path.join(root, 'config/perfis-acesso.php'), 'utf8')
  .matchAll(/'([a-z]+\.(?:visualizar|gerenciar))'/g)].map((m) => m[1]);
const cliente = { id: '33333333-3333-4333-8333-333333333333', nome: 'Cliente encontrado', telefone: '11900000000' };
const historico = { id: '44444444-4444-4444-8444-444444444444', codigo: 'TESTE',
  cliente_id: cliente.id, cliente: 'Cliente histórico', servico_id: '55555555-5555-4555-8555-555555555555',
  servico: 'Serviço histórico', funcionario_id: '66666666-6666-4666-8666-666666666666', funcionario: 'Profissional histórico',
  tipo: 'entrada', descricao: 'Pagamento de teste', metodo_pagamento: 'pix', valor: 50, status: 'concluido',
  data_transacao: '2026-09-10T13:00:00Z', data_agendamento: '2026-09-10', horario_inicio: '10:00', horario_fim: '11:00' };
const resumo = { total: 51, ativos: 1, recentes: 1, valor_total: 50, duracao_media: 60,
  preco_medio: 50, entradas: 50, saidas: 0, saldo: 50, comissao_media: 10 };

async function main() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!/^\/(?:pages\/[^/]+\.html|assets\/[^.].*|index\.html)$/.test(pathname)) {
      res.writeHead(404); return res.end();
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end();
    }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
    const context = await browser.newContext({ timezoneId: 'UTC' });
    const page = await context.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let dados = { resumo, paginacao: { pagina: Number(url.searchParams.get('pagina') || 1), por_pagina: 50, total: 51 },
        clientes: [], servicos: [], funcionarios: [], categorias: [], transacoes: [], agendamentos: [] };
      if (url.pathname.endsWith('/sessao.php')) dados = { token_csrf: 'teste',
        usuario: { nome: 'Administrador teste', tipo_acesso: 'administrador', permissoes }, barbearia: { cor_tema: '#244BC5' } };
      if (url.pathname.endsWith('/opcoes-clientes.php')) dados = { clientes: [cliente], tem_mais: false };
      if (url.pathname.endsWith('/transacoes.php')) dados.transacoes = [historico];
      if (url.pathname.endsWith('/agendamentos.php')) dados.agendamentos = [historico];
      if (url.pathname.endsWith('/barbearia.php')) dados = { barbearia: { nome_fantasia: 'Teste', documento: 'legado', documento_requer_regularizacao: true }, endereco: {}, horarios: [], redes_sociais: [] };
      return route.fulfill({ json: { sucesso: true, dados } });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tela of ['clientes', 'servicos', 'equipe', 'transacoes']) {
        await page.goto(`${base}/pages/${tela}.html`);
        const pager = page.locator('.paginacao');
        await pager.getByText('Página 1 de 2', { exact: false }).waitFor();
        assert.equal(await pager.getByRole('button', { name: 'Anterior', exact: true }).isDisabled(), true);
        await pager.getByRole('button', { name: 'Próxima', exact: true }).click();
        await pager.getByText('Página 2 de 2', { exact: false }).waitFor();
        assert.equal(await pager.getByRole('button', { name: 'Próxima', exact: true }).isDisabled(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tela}: overflow em ${width}px`);
        console.log(`PASS: ${tela}, paginação e largura ${width}px`);
      }
    }
    for (const [tela, select] of [['agenda', '#agendamento-cliente-id'], ['transacoes', '#transacao-cliente']]) {
      await page.goto(`${base}/pages/${tela}.html`);
      await page.locator('[data-editar]').first().click();
      assert.equal(await page.locator(select).inputValue(), cliente.id);
      if (tela === 'transacoes') assert.equal(await page.locator('[name=data_transacao]').inputValue(), '2026-09-10T10:00');
      await page.getByRole('searchbox', { name: 'Buscar cliente por nome, CPF ou telefone' }).fill('Cliente encontrado');
      await page.getByText('1 clientes encontrados.', { exact: true }).waitFor();
      await page.locator(select).selectOption(cliente.id);
      assert.equal(await page.locator(select).inputValue(), cliente.id);
      console.log(`PASS: ${tela}, seleção histórica e busca de cliente`);
    }
    await page.goto(`${base}/pages/minha-barbearia.html`);
    await page.locator('#documento-status').getByText('CNPJ', { exact: false }).waitFor();
    assert.deepEqual(erros, []);
    console.log('PASS: aviso de documento legado; nenhum erro JavaScript nas telas testadas');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
