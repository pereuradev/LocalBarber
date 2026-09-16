const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || (process.platform === 'win32' && fs.existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
function executar(bin, args, silencioso = false) {
  return execFileSync(bin, args, { cwd: root, encoding: 'utf8', stdio: silencioso ? 'pipe' : 'inherit' });
}
function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    if (['.git', 'node_modules', 'vendor'].includes(item.name)) return [];
    const file = path.join(dir, item.name);
    return item.isDirectory() ? arquivos(file) : [file];
  });
}
let phpCount = 0, jsCount = 0;
for (const file of arquivos(root)) {
  if (file.endsWith('.php')) { executar(php, ['-l', file], true); phpCount++; }
  if (/\.(?:js|cjs)$/.test(file)) { executar(process.execPath, ['--check', file], true); jsCount++; }
}
console.log(`Sintaxe: ${phpCount} arquivos PHP e ${jsCount} arquivos JavaScript passaram.`);
for (const file of ['php.php', 'sessao.php', 'mutacoes.php', 'recuperacao.php']) executar(php, ['tests/' + file]);
executar(process.execPath, ['--test', 'tests/frontend.cjs']);
executar(process.execPath, ['tests/http.cjs']);
executar(process.execPath, ['tests/recuperacao-http.cjs', ...(process.argv.includes('--browser') ? ['--browser'] : [])]);
const consultas = JSON.parse(executar(php, ['tests/exportar-consultas.php'], true));
if (consultas.length !== 8) throw new Error('Quantidade inesperada de consultas GET exportadas.');
console.log('Captura das 8 consultas GET passou; use montar-sql.cjs para validá-las no PostgreSQL.');
if (process.argv.includes('--browser')) executar(process.execPath, ['tests/browser.cjs']);
