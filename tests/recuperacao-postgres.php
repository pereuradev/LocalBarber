<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/recuperacao.php';
require __DIR__ . '/../config/database.php';

use LocalBarber\RecuperacaoSenha;

// SAVEPOINTs apenas no adaptador de teste: tudo, incluindo DDL, termina em ROLLBACK.
final class BancoRecuperacaoTeste extends PDO
{
    public function __construct(private PDO $real) {}
    public function prepare(string $query, array $options = []): PDOStatement|false { return $this->real->prepare($query, $options); }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false { return $this->real->query($query); }
    public function exec(string $statement): int|false { return $this->real->exec($statement); }
    public function beginTransaction(): bool { $this->real->exec('SAVEPOINT reset_teste'); return true; }
    public function commit(): bool { $this->real->exec('RELEASE SAVEPOINT reset_teste'); return true; }
    public function rollBack(): bool { $this->real->exec('ROLLBACK TO SAVEPOINT reset_teste'); $this->real->exec('RELEASE SAVEPOINT reset_teste'); return true; }
}

$schemaTeste = 'localbarber_reset_teste_' . bin2hex(random_bytes(6));
$pdo->beginTransaction();
try {
    $pdo->exec("SET LOCAL statement_timeout = '45s'");
    $base = preg_replace('/^(?:BEGIN|COMMIT);\s*$/m', '', file_get_contents(__DIR__ . '/../database/schema.sql'));
    $pdo->exec(str_replace('locaalbarber', $schemaTeste, $base));
    $arquivos = glob(__DIR__ . '/../supabase/migrations/*.sql');
    sort($arquivos);
    foreach ($arquivos as $arquivo) $pdo->exec(str_replace('locaalbarber', $schemaTeste, file_get_contents($arquivo)));
    $pdo->exec(str_replace('locaalbarber', $schemaTeste, file_get_contents(__DIR__ . '/database.sql')));
    $pdo->exec('SET LOCAL search_path = ' . $schemaTeste . ', extensions, public');
    $usuario = '22222222-2222-4222-8222-222222222222';
    $consulta = $pdo->prepare('UPDATE usuarios SET email = :email, ativo = true WHERE id = :id');
    $consulta->execute(['email' => 'reset-teste@example.invalid', 'id' => $usuario]);
    verificarRecuperacao($consulta->rowCount() === 1, 'Fixture de usuário ausente.');
    $servico = new RecuperacaoSenha(new BancoRecuperacaoTeste($pdo));
    $enviados = [];
    $capturar = static function (string $email, string $token) use (&$enviados, $emailTeste): void {
        verificarRecuperacao($email === 'reset-teste@example.invalid', 'Destinatário inesperado.');
        $mensagem = $emailTeste->mensagem($email, $token);
        $mensagem->preSend(); // Apenas MIME em memória; nenhum e-mail sai deste teste.
        $enviados[] = $token;
    };
    $servico->solicitar('  RESET-TESTE@example.invalid ', 'ip-teste');
    $servico->solicitar('inexistente@example.invalid', 'ip-teste');
    verificarRecuperacao((int)$pdo->query('SELECT count(*) FROM recuperacao_senha_emails')->fetchColumn() === 2, 'Fila distingue contas.');
    $servico->processarProximo($capturar);
    $servico->processarProximo($capturar);
    verificarRecuperacao(count($enviados) === 1, 'Enviou para conta desconhecida.');
    $hash = $pdo->query('SELECT token_hash FROM recuperacoes_senha')->fetchColumn();
    verificarRecuperacao($hash === hash('sha256', $enviados[0]) && $hash !== $enviados[0], 'Token não protegido por hash.');
    $servico->solicitar('reset-teste@example.invalid', 'ip-teste');
    $servico->processarProximo($capturar);
    $versao = (int)$pdo->query("SELECT versao_sessao FROM usuarios WHERE id = '{$usuario}'")->fetchColumn();
    rejeitarRecuperacao(static fn () => $servico->redefinir($enviados[0], 'OutraSenha123', 'Diferente123', 'ip-teste'), 'confirmacao_invalida');
    $servico->redefinir($enviados[0], 'OutraSenha123', 'OutraSenha123', 'ip-teste');
    $atual = $pdo->query("SELECT senha_hash, versao_sessao FROM usuarios WHERE id = '{$usuario}'")->fetch();
    verificarRecuperacao(password_verify('OutraSenha123', $atual['senha_hash']), 'Nova senha não autentica.');
    verificarRecuperacao((int)$atual['versao_sessao'] === $versao + 1, 'Sessões antigas não revogadas.');
    foreach ([$enviados[0], $enviados[1], str_repeat('f', 64), 'invalido'] as $token) {
        rejeitarRecuperacao(static fn () => $servico->redefinir($token, 'SenhaNova456', 'SenhaNova456', 'ip-teste'), 'link_invalido');
    }
    $servico->solicitar('reset-teste@example.invalid', 'ip-teste');
    $servico->processarProximo($capturar);
    $pdo->exec("UPDATE recuperacoes_senha SET criado_em = now() - interval '1 hour', expira_em = now() - interval '1 second'");
    rejeitarRecuperacao(static fn () => $servico->redefinir($enviados[2], 'SenhaNova456', 'SenhaNova456', 'ip-teste'), 'link_invalido');
    // Limite por e-mail não revela o motivo nem enfileira o quarto envio.
    $servico->solicitar('reset-teste@example.invalid', 'outro-ip');
    verificarRecuperacao($servico->processarProximo($capturar) === 'vazio', 'Limite por e-mail ignorado.');
    for ($i = 0; $i < 10; $i++) $servico->solicitar('desconhecido' . $i . '@example.invalid', 'ip-limite');
    rejeitarRecuperacao(static fn () => $servico->solicitar('desconhecido@example.invalid', 'ip-limite'), 'limite_recuperacao');
    while ($servico->processarProximo($capturar) !== 'vazio') {}
    $pdo->exec("DELETE FROM recuperacao_senha_limites");
    $servico->solicitar('reset-teste@example.invalid', 'ip-falha');
    $falhar = static function (): void { throw new RuntimeException('Falha SMTP simulada, sem conexão.'); };
    for ($i = 0; $i < 3; $i++) {
        verificarRecuperacao($servico->processarProximo($falhar) === 'falha', 'Falha SMTP não tratada.');
        $pdo->exec('UPDATE recuperacao_senha_emails SET disponivel_em = now()');
    }
    verificarRecuperacao($servico->processarProximo($falhar) === 'vazio', 'Tentativas de envio ilimitadas.');
    verificarRecuperacao((int)$pdo->query('SELECT count(*) FROM recuperacoes_senha WHERE expira_em > now()')->fetchColumn() === 0, 'Token de envio com falha permaneceu válido.');
    $pdo->exec("UPDATE recuperacao_senha_emails SET criado_em = now() - interval '2 days'");
    $servico->limparExpirados();
    verificarRecuperacao((int)$pdo->query('SELECT count(*) FROM recuperacoes_senha')->fetchColumn() === 0, 'Tokens expirados não removidos.');
    verificarRecuperacao((int)$pdo->query('SELECT count(*) FROM recuperacao_senha_emails')->fetchColumn() === 0, 'Fila antiga não limpa.');
    echo "PostgreSQL: migrações, fila, destinatários, limites, hash, uso único, expiração, revogação e falhas SMTP passaram.\n";
} finally {
    $pdo->rollBack();
}
echo "ROLLBACK concluído: nenhum usuário, senha ou schema de teste persistiu.\n";
