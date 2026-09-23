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
const agendamentoPagamento = {
  id: '88888888-8888-4888-8888-888888888888', codigo: 'AG-PAGAR', cliente_id: cliente.id,
  cliente: cliente.nome, servico_id: historico.servico_id, servico: historico.servico,
  funcionario_id: historico.funcionario_id, funcionario: historico.funcionario,
  data_agendamento: '2026-09-16', horario_inicio: '14:00:00', valor_previsto: 50,
};
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
  let gravacoesAgenda = 0;
  let gravacoesTransacao = 0;
  let ultimaTransacao = null;
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
        usuario: { id: '22222222-2222-4222-8222-222222222222', nome: 'Administrador teste', tipo_acesso: 'administrador', permissoes, cor_tema: '#244BC5' }, barbearia: {} };
      if (url.pathname.endsWith('/opcoes-clientes.php')) dados = { clientes: [cliente], tem_mais: false };
      if (url.pathname.endsWith('/transacoes.php')) {
        if (route.request().method() === 'GET') {
          dados.transacoes = [historico];
          dados.agendamentos_pendentes = [agendamentoPagamento];
        } else {
          gravacoesTransacao++;
          ultimaTransacao = JSON.parse(route.request().postData() || '{}');
          dados = { transacao: { id: '99999999-9999-4999-8999-999999999999', codigo: 'TX-PAGO' } };
        }
      }
      if (url.pathname.endsWith('/agendamentos.php')) {
        dados.agendamentos = [historico];
        dados.servicos = [{ id: historico.servico_id, nome: historico.servico, preco: 50, duracao_minutos: 60 }];
        dados.funcionarios = [{ id: historico.funcionario_id, nome: historico.funcionario }];
        dados.horarios = Array.from({ length: 7 }, (_, dia_semana) => ({
          dia_semana, abertura: '09:00:00', fechamento: '18:00:00', ativo: true,
        }));
        if (route.request().method() !== 'GET') {
          gravacoesAgenda++;
          await new Promise((resolve) => setTimeout(resolve, 350));
          dados = { id: '77777777-7777-4777-8777-777777777777' };
        }
      }
      if (url.pathname.endsWith('/barbearia.php')) dados = { barbearia: { nome_fantasia: 'Teste', documento: 'legado', documento_requer_regularizacao: true }, endereco: {}, horarios: [], redes_sociais: [] };
      return route.fulfill({ json: { sucesso: true, dados } });
    });
    const base = `http://127.0.0.1:${server.address().port}`;

    await page.goto(`${base}/index.html`);
    await page.evaluate(() => {
      sessionStorage.setItem('localbarber:sessao-visual', JSON.stringify({
        usuario: { id: 'usuario-teste', nome: 'Teste', permissoes: [], cor_tema: '#B4235A' },
      }));
      localStorage.setItem('localbarber-cor-tema', '#B4235A');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement)
      .getPropertyValue('--cor-tema-original').trim().toUpperCase()), '#244BC5');
    assert.equal(await page.evaluate(() => localStorage.getItem('localbarber-cor-tema')), null);
    await page.evaluate(() => sessionStorage.clear());
    console.log('PASS: landing ignora a cor da conta e remove a preferência compartilhada antiga');

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${base}/pages/agenda.html`);
    const botaoMinimizar = page.getByRole('button', { name: 'Minimizar menu lateral', exact: true });
    await botaoMinimizar.click();
    await page.waitForFunction(() => Math.round(document.querySelector('#barra-lateral').getBoundingClientRect().width) === 76);
    assert.equal(await page.locator('body').evaluate((corpo) => corpo.classList.contains('sidebar-minimizada')), true);
    assert.equal(await page.locator('#barra-lateral').evaluate((menu) => Math.round(menu.getBoundingClientRect().width)), 76);
    assert.equal(await page.locator('.principal').evaluate((principal) => getComputedStyle(principal).marginLeft), '76px');
    assert.equal(await page.locator('.sidebar-logo-compacta').isVisible(), true);
    assert.match(await page.locator('.sidebar-logo-compacta').getAttribute('src'), /assets\/images\/favicon\.png/);
    assert.equal(await page.locator('.sidebar-logo-completa').isVisible(), false);
    assert.equal(await page.getByRole('link', { name: 'Clientes', exact: true }).isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem(
      'localbarber:sidebar-minimizada:22222222-2222-4222-8222-222222222222'
    )), 'true');
    await page.reload();
    await page.getByRole('button', { name: 'Expandir menu lateral', exact: true }).waitFor();
    assert.equal(await page.locator('body').evaluate((corpo) => corpo.classList.contains('sidebar-minimizada')), true);
    await page.getByRole('button', { name: 'Expandir menu lateral', exact: true }).click();
    assert.equal(await page.locator('body').evaluate((corpo) => corpo.classList.contains('sidebar-minimizada')), false);
    assert.equal(await page.locator('.sidebar-logo-completa').isVisible(), true);
    assert.equal(await page.locator('.sidebar-logo-compacta').isVisible(), false);
    console.log('PASS: sidebar minimiza, mantém atalhos e restaura a preferência do usuário');

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
    historico.agendamento_id = agendamentoPagamento.id;
    await page.goto(`${base}/pages/transacoes.html`);
    await page.locator('[data-editar]').first().click();
    for (const seletor of ['#transacao-cliente', '#transacao-servico', '#transacao-funcionario']) {
      assert.equal(await page.locator(seletor).isDisabled(), true);
    }
    delete historico.agendamento_id;
    console.log('PASS: pagamento vinculado preserva cliente, serviço e profissional do agendamento');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${base}/pages/transacoes.html`);
    await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
    const modalTransacao = page.locator('#modal-transacao .modal-transacao');
    assert.ok(await modalTransacao.evaluate((modal) => modal.getBoundingClientRect().width >= 900));
    assert.equal(await modalTransacao.evaluate((modal) => getComputedStyle(modal).overflowY), 'visible');
    assert.equal(await page.locator('.campo-transacao-manual').first().isVisible(), false);
    await page.locator('#transacao-agendamento').selectOption(agendamentoPagamento.id);
    assert.equal(await page.locator('#transacao-valor').inputValue(), '50.00');
    assert.match(await page.locator('#transacao-descricao').inputValue(), /Cliente encontrado/);
    await page.getByRole('button', { name: 'Salvar transação', exact: true }).click();
    await page.locator('#modal-transacao').waitFor({ state: 'hidden' });
    assert.equal(gravacoesTransacao, 1);
    assert.equal(ultimaTransacao.agendamento_id, agendamentoPagamento.id);
    console.log('PASS: nova transação exige agendamento não pago e modal desktop não possui rolagem');

    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(`${base}/pages/transacoes.html`);
    await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
    assert.equal(await page.locator('#modal-transacao .modal-transacao').evaluate((modal) => getComputedStyle(modal).overflowY), 'auto');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    console.log('PASS: modal de transação mantém rolagem somente no celular');

    await page.goto(`${base}/pages/agenda.html`);
    await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click();
    await page.locator('#agendamento-cliente').fill('Cliente novo');
    await page.locator('#agendamento-telefone').fill('11987654321');
    assert.equal(await page.locator('#agendamento-telefone').inputValue(), '(11) 98765-4321');
    await page.locator('#agendamento-servico').selectOption(historico.servico_id);
    await page.locator('#agendamento-funcionario').selectOption(historico.funcionario_id);
    await page.locator('#agendamento-data').fill('2026-09-16');
    await page.locator('#agendamento-horario').fill('17:30');
    await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
    assert.match(await page.locator('#agendamento-horario').evaluate((campo) => campo.validationMessage), /09:00 e 17:00/);
    assert.equal(gravacoesAgenda, 0);
    await page.locator('#agendamento-horario').fill('16:00');
    await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
    await page.locator('#confirmacao-agendamento').waitFor({ state: 'visible' });
    await page.locator('#confirmacao-agendamento').waitFor({ state: 'hidden' });
    assert.equal(gravacoesAgenda, 1);
    console.log('PASS: agenda bloqueia horário inválido, formata telefone e anima a confirmação');
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
