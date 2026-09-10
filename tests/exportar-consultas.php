<?php

declare(strict_types=1);

// Captura as consultas reais das APIs GET sem conectar, alterar dados ou iniciar sessões.
require_once __DIR__ . '/../config/api.php';

class ConsultaCapturada extends PDOStatement
{
    private string $sql;
    public function __construct(string $sql) { $this->sql = $sql; }
    public function execute(?array $params = null): bool
    {
        $GLOBALS['consultas'][] = ['arquivo' => $GLOBALS['arquivoAtual'], 'sql' => $this->sql, 'parametros' => $params];
        return true;
    }
    public function fetchColumn(int $column = 0) { return '[]'; }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, ...$args): array { return []; }
}
class BancoCapturado extends PDO
{
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement { return new ConsultaCapturada($query); }
}
function capturarOperacao(callable $operacao): void { $operacao(); }

$pdo = new BancoCapturado();
$consultas = [];
$_SERVER['REQUEST_METHOD'] = 'GET';
$sessaoTeste = ['usuario_id' => '22222222-2222-4222-8222-222222222222',
    'barbearia_id' => '11111111-1111-4111-8111-111111111111', 'usuario_papel' => 'admin'];
foreach (['clientes', 'servicos', 'funcionarios', 'transacoes', 'agendamentos', 'faturamento', 'dashboard', 'opcoes-clientes'] as $arquivoAtual) {
    $_GET = ['pagina' => 6, 'por_pagina' => 50, 'inicio' => '2030-01-01', 'fim' => '2030-01-31', 'periodo' => 'todos'];
    $codigo = file_get_contents(__DIR__ . '/../api/' . $arquivoAtual . '.php');
    $codigo = preg_replace('/^<\?php\s*|declare\(strict_types=1\);|require_once[^;]+;/m', '', $codigo);
    $codigo = str_replace('executarApi(', 'capturarOperacao(', $codigo);
    $codigo = str_replace('exigirAutenticacao($pdo)', '$GLOBALS["sessaoTeste"]', $codigo);
    eval($codigo);
}
echo json_encode($consultas, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
