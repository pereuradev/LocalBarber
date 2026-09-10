<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/sessao.php';
require_once __DIR__ . '/../config/api.php';

iniciarSessaoSegura();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

try {
    require_once __DIR__ . '/../config/database.php';
} catch (Throwable $excecao) {
    error_log('[LocalBarber API] Falha na conexão: ' . $excecao->getMessage());
    responderJson([
        'sucesso' => false,
        'codigo' => 'banco_indisponivel',
        'mensagem' => 'O banco está indisponível. Tente novamente em instantes.',
    ], 503);
}
