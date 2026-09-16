<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

executarApi(static function () use ($pdo): array {
    exigirMetodo('GET');
    $sessao = exigirAutenticacao($pdo);

    return [
        'usuario' => [
            'id' => $sessao['usuario_id'],
            'nome' => $sessao['usuario_nome'],
            'email' => $sessao['usuario_email'],
            'papel' => $sessao['usuario_papel'],
            'tipo_acesso' => $sessao['tipo_acesso'],
            'permissoes' => $sessao['permissoes'],
            'cor_tema' => $sessao['usuario_cor_tema'],
        ],
        'barbearia' => [
            'id' => $sessao['barbearia_id'],
            'nome' => $sessao['barbearia_nome'],
        ],
        'token_csrf' => tokenCsrf(),
    ];
});
