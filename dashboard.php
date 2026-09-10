<?php

declare(strict_types=1);

require_once __DIR__ . '/config/sessao.php';
iniciarSessaoSegura();

if (empty($_SESSION['usuario_id'])) {
    header('Location: index.html?login=necessario');
    exit;
}

$conteudoPainel = file_get_contents(__DIR__ . '/views/dashboard.html');

if ($conteudoPainel === false) {
    http_response_code(500);
    echo 'Painel não encontrado.';
    exit;
}

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $conteudoPainel;
