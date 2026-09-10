<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/api.php';

// Sessões em memória: o teste não cria contas ou arquivos de sessão do usuário.
ini_set('session.use_cookies', '0');
session_set_save_handler(static fn () => true, static fn () => true,
    static fn () => '', static fn () => true, static fn () => true, static fn () => 0);
class UsuarioTeste extends PDOStatement {
    public array $usuario;
    public function __construct(array $usuario) { $this->usuario = $usuario; }
    public function execute(?array $params = null): bool { return true; }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0) { return $this->usuario; }
}
class BancoSessaoTeste extends PDO {
    public int $versao = 1;
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement {
        return new UsuarioTeste(['nome' => 'Teste', 'email' => 'teste@example.invalid', 'papel' => 'admin',
            'versao_sessao' => $this->versao, 'nome_fantasia' => 'Teste', 'cor_tema' => '#244BC5']);
    }
}
$pdo = new BancoSessaoTeste();
$identidade = ['usuario_id' => '22222222-2222-4222-8222-222222222222',
    'barbearia_id' => '11111111-1111-4111-8111-111111111111', 'versao_sessao' => 1];
session_start();
$_SESSION = $identidade;
$sessao = exigirAutenticacao($pdo);
if ($sessao['usuario_nome'] !== 'Teste') throw new RuntimeException('Sessão válida rejeitada.');
session_start();
$_SESSION = $identidade;
$pdo->versao = 2;
try {
    exigirAutenticacao($pdo);
    throw new RuntimeException('Outra sessão continuou ativa após trocar a senha.');
} catch (ExcecaoApi $erro) {
    if ($erro->codigo !== 'sessao_revogada' || $_SESSION !== []) throw $erro;
}
echo "Sessões: autenticação válida e revogação passaram.\n";
