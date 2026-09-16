const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');

async function main() {
  const reserva = net.createServer();
  await new Promise(resolve => reserva.listen(0, '127.0.0.1', resolve));
  const port = reserva.address().port;
  await new Promise(resolve => reserva.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  // Nunca conecta ao banco nem ao Gmail, mesmo com o .env real presente.
  const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', root], {
    cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, SUPABASE_DB_PORT: 'invalid', SMTP_USERNAME: '', SMTP_PASSWORD: '' }
  });
  let browser;
  try {
    let pagina;
    for (let i = 0; i < 40; i++) {
      try { pagina = await fetch(base + '/esqueci-senha.php'); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(pagina, 'Servidor de teste não iniciou.');
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get('cache-control'), /no-store/);
    assert.equal(pagina.headers.get('referrer-policy'), 'no-referrer');
    assert.match(pagina.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const html = await pagina.text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]{64})"/)[1];
    const cookie = pagina.headers.get('set-cookie').split(';')[0];
    const endpoint = base + '/auth/recuperacao-senha.php';
    assert.equal((await fetch(endpoint)).status, 405);
    assert.equal((await fetch(endpoint, { method: 'POST', body: '{}' })).status, 419);
    const post = (body) => fetch(endpoint, { method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body });
    assert.equal((await post('INVALIDO')).status, 400);
    assert.equal((await post('x'.repeat(8193))).status, 413);
    assert.equal((await post(JSON.stringify({ acao: 'solicitar', email: [] }))).status, 422);
    const indisponivel = await post(JSON.stringify({ acao: 'solicitar', email: 'teste@example.invalid' }));
    assert.equal(indisponivel.status, 503);
    assert.equal((await indisponivel.json()).codigo, 'recuperacao_indisponivel');
    console.log('Recuperação HTTP: páginas, cabeçalhos, método, CSRF, JSON, tamanho e indisponibilidade passaram.');

    if (!process.argv.includes('--browser')) return;
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    const context = await browser.newContext();
    const page = await context.newPage();
    const erros = [];
    page.on('pageerror', erro => erros.push(erro.message));
    const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'localbarber-reset-visual-'));
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/esqueci-senha.php');
      await page.getByLabel('E-mail da sua conta').fill('teste@example.invalid');
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
      await page.getByRole('status').filter({ hasText: 'temporariamente indisponível' }).waitFor();
      assert.ok(await page.getByRole('button', { name: 'Enviar link de recuperação' }).isEnabled());
      await page.screenshot({ path: path.join(screenshots, `solicitar-${width}.png`), fullPage: true });
      await page.goto(base + '/redefinir-senha.php');
      assert.ok(await page.locator('#recuperacaoForm').isHidden());
      const token = 'a'.repeat(64);
      await page.goto(base + '/redefinir-senha.php#token=' + token);
      await page.waitForFunction(() => location.hash === '');
      assert.equal(new URL(page.url()).hash, '');
      await page.getByLabel('Nova senha', { exact: true }).fill('SenhaSegura123');
      await page.getByLabel('Confirme a nova senha').fill('OutraSenha123');
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await page.getByRole('status').filter({ hasText: 'não confere' }).waitFor();
      await page.getByRole('button', { name: 'Mostrar senhas' }).click();
      assert.equal(await page.locator('#novaSenha').getAttribute('type'), 'text');
      await page.getByRole('button', { name: 'Ocultar senhas' }).click();
      await page.getByLabel('Confirme a nova senha').fill('SenhaSegura123');
      await page.screenshot({ path: path.join(screenshots, `redefinir-${width}.png`), fullPage: true });
      let envios = 0;
      await page.route('**/auth/recuperacao-senha.php', async route => {
        envios++;
        const body = route.request().postDataJSON();
        assert.equal(body.token, token);
        assert.equal(body.nova_senha, 'SenhaSegura123');
        assert.match(route.request().headers()['x-csrf-token'], /^[a-f0-9]{64}$/);
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.fulfill({ json: { sucesso: true, dados: { mensagem: 'Senha atualizada! Entre novamente.' } } });
      });
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await page.locator('#recuperacaoForm').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true })));
      await page.getByRole('status').filter({ hasText: 'Senha atualizada' }).waitFor();
      assert.equal(envios, 1);
      assert.ok(await page.locator('#recuperacaoForm').isHidden());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length), 0);
      await page.unroute('**/auth/recuperacao-senha.php');
    }
    assert.deepEqual(erros, []);
    console.log('Recuperação navegador: 1366/390 px, token removido da URL, confirmação, visibilidade, duplo envio e sucesso simulado passaram.');
    console.log('Capturas: ' + screenshots);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
