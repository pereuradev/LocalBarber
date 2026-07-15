<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['ok' => false, 'message' => 'Método não permitido.']);
    exit;
}

require_once __DIR__ . '/../config/brasil-api.php';

try {
    $empresa = consultarCnpjNaBrasilApi((string)($_GET['cnpj'] ?? ''));
    $situacao = strtoupper(trim((string)($empresa['descricao_situacao_cadastral'] ?? '')));

    if ($situacao !== 'ATIVA') {
        http_response_code(422);
        echo json_encode([
            'ok' => false,
            'code' => 'cnpj_inativo',
            'message' => 'O CNPJ está com situação cadastral ' . ($situacao ?: 'não identificada') . '.',
            'situacao_cadastral' => $situacao,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'CNPJ válido e ativo.',
        'empresa' => [
            'cnpj' => formatarCnpj((string)$empresa['cnpj']),
            'razao_social' => trim((string)($empresa['razao_social'] ?? '')),
            'nome_fantasia' => trim((string)($empresa['nome_fantasia'] ?? '')),
            'situacao_cadastral' => $situacao,
            'telefone' => trim((string)($empresa['ddd_telefone_1'] ?? $empresa['ddd_telefone_2'] ?? '')),
            'email' => strtolower(trim((string)($empresa['email'] ?? ''))),
            'cep' => somenteDigitos((string)($empresa['cep'] ?? '')),
            'tipo_logradouro' => trim((string)($empresa['descricao_tipo_de_logradouro'] ?? '')),
            'logradouro' => trim((string)($empresa['logradouro'] ?? '')),
            'numero' => trim((string)($empresa['numero'] ?? '')),
            'complemento' => trim((string)($empresa['complemento'] ?? '')),
            'bairro' => trim((string)($empresa['bairro'] ?? '')),
            'cidade' => trim((string)($empresa['municipio'] ?? '')),
            'uf' => strtoupper(trim((string)($empresa['uf'] ?? ''))),
            'atividade_principal' => trim((string)($empresa['cnae_fiscal_descricao'] ?? '')),
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (BrasilApiException $exception) {
    http_response_code($exception->getHttpStatus());
    echo json_encode([
        'ok' => false,
        'code' => $exception->getHttpStatus() === 422 ? 'cnpj_invalido' : 'consulta_indisponivel',
        'message' => $exception->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
