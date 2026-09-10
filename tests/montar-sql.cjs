// Imprime um ensaio completo, transacional e sem persistência. Não conecta ao banco.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || (process.platform === 'win32' && fs.existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const consultas = JSON.parse(execFileSync(php, ['tests/exportar-consultas.php'], { cwd: root, encoding: 'utf8' }));
const schema = 'localbarber_teste_' + require('node:crypto').randomBytes(6).toString('hex');
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
function literal(value) { return typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'"; }
const checks = consultas.map(({ arquivo, sql, parametros }) => {
  const query = sql.replace(/(?<!:):([a-z_]+)/g, (_, key) => {
    if (!(key in parametros)) throw new Error('Parâmetro ausente: ' + key);
    return literal(parametros[key]);
  });
  if (arquivo === 'opcoes-clientes') return `DO $check$ DECLARE linhas int; BEGIN
    SELECT count(*) INTO linhas FROM (${query}) q;
    IF linhas <> 51 THEN RAISE EXCEPTION 'Busca não retornou o limite com indicador de mais resultados'; END IF;
    END; $check$;`;
  const assert = arquivo === 'clientes' ? `IF (resultado->'paginacao'->>'total')::int <> 261
    OR jsonb_array_length(resultado->'clientes') <> 11 THEN RAISE EXCEPTION 'Paginação perdeu registros'; END IF;` : '';
  return `DO $check$ DECLARE resultado jsonb; BEGIN ${query} INTO resultado; ${assert} END; $check$;`;
}).join('\n');
const conteudo = [read('database/schema.sql').replace(/^(?:BEGIN|COMMIT);\s*$/gm, ''),
  ...migrations.map((file) => read('supabase/migrations/' + file)), read('tests/database.sql'), checks].join('\n');
console.log("BEGIN;\nSET LOCAL statement_timeout='45s';\n" + conteudo.replaceAll('locaalbarber', schema) + '\nROLLBACK;');
