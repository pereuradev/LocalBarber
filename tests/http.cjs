// Verifica o contrato HTTP real do PHP, forçando configuração inválida antes de qualquer conexão.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { setTimeout: esperar } = require('node:timers/promises');
const php = process.env.PHP_BINARY || (process.platform === 'win32' && fs.existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
async function main() {
  const portaLivre = net.createServer();
  await new Promise((resolve) => portaLivre.listen(0, '127.0.0.1', resolve));
  const port = portaLivre.address().port;
  await new Promise((resolve) => portaLivre.close(resolve));
  const server = spawn(php, ['-d', 'display_errors=0', '-S', `127.0.0.1:${port}`, '-t', '.'], {
    cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_DB_PORT: 'invalid',
      SUPABASE_DB_NAME: 'teste', SUPABASE_DB_USER: 'teste', SUPABASE_DB_PASSWORD: 'teste-nao-conectar', SUPABASE_DB_SCHEMA: 'locaalbarber' },
  });
  let spawnError;
  server.on('error', (erro) => { spawnError = erro; });
  try {
    const base = `http://127.0.0.1:${port}`;
    let response;
    for (let n = 0; n < 50; n++) {
      if (spawnError) throw spawnError;
      try { response = await fetch(base + '/api/sessao.php'); break; }
      catch { await esperar(100); }
    }
    assert.ok(response, 'Servidor PHP não iniciou.');
    assert.equal(response.status, 503);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal((await response.json()).codigo, 'banco_indisponivel');
    const login = await fetch(base + '/auth/login.php', { method: 'POST', body: new URLSearchParams({
      email: 'teste@example.invalid', senha: 'teste', tipo_acesso: 'administrador',
    }) });
    assert.equal(login.status, 503);
    assert.equal((await login.json()).ok, false);
    console.log('HTTP PHP: sessão e login retornam JSON 503 sem fatal error quando o banco está indisponível.');
  } finally { server.kill(); }
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
