<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

require_once __DIR__ . '/../config/senha.php';

executarApi(static function () use ($pdo): array {
    exigirMetodo('PATCH');
    $sessao = exigirAutenticacao($pdo);
    exigirTokenCsrf();

    $identificadorUsuario = (string)$sessao['usuario_id'];
    if (!identificadorUuidValido($identificadorUsuario)) {
        throw new ExcecaoApi(
            'Entre com um usuário cadastrado para alterar a senha.',
            403,
            'sessao_sem_usuario'
        );
    }

    $dados = lerCorpoJson();
    $senhaAtual = (string)($dados['senha_atual'] ?? '');
    $novaSenha = (string)($dados['nova_senha'] ?? '');
    $confirmacaoSenha = (string)($dados['confirmacao_senha'] ?? '');

    if ($senhaAtual === '' || $novaSenha === '' || $confirmacaoSenha === '') {
        throw new ExcecaoApi(
            'Preencha a senha atual, a nova senha e a confirmação.',
            422,
            'campos_obrigatorios'
        );
    }

    validarNovaSenha($novaSenha);

    if (!hash_equals($novaSenha, $confirmacaoSenha)) {
        throw new ExcecaoApi(
            'A confirmação da nova senha não confere.',
            422,
            'confirmacao_invalida'
        );
    }

    if (hash_equals($senhaAtual, $novaSenha)) {
        throw new ExcecaoApi(
            'A nova senha precisa ser diferente da senha atual.',
            422,
            'senha_repetida'
        );
    }

    $consultaUsuario = $pdo->prepare(
        'select senha_hash
         from usuarios
         where id = :usuario_id
           and barbearia_id = :barbearia_id
           and ativo
         limit 1'
    );
    $consultaUsuario->execute([
        'usuario_id' => $identificadorUsuario,
        'barbearia_id' => $sessao['barbearia_id'],
    ]);
    $usuario = $consultaUsuario->fetch();

    if (!$usuario) {
        throw new ExcecaoApi(
            'Usuário não encontrado ou inativo.',
            404,
            'usuario_nao_encontrado'
        );
    }

    if (empty($usuario['senha_hash']) || !password_verify($senhaAtual, (string)$usuario['senha_hash'])) {
        throw new ExcecaoApi(
            'A senha atual está incorreta.',
            422,
            'senha_atual_incorreta'
        );
    }

    $atualizarSenha = $pdo->prepare(
        'update usuarios
         set senha_hash = :senha_hash
         where id = :usuario_id
           and barbearia_id = :barbearia_id
         returning versao_sessao'
    );
    $atualizarSenha->execute([
        'senha_hash' => password_hash($novaSenha, PASSWORD_DEFAULT),
        'usuario_id' => $identificadorUsuario,
        'barbearia_id' => $sessao['barbearia_id'],
    ]);
    $versaoSessao = (int)$atualizarSenha->fetchColumn();

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    session_regenerate_id(true);
    $_SESSION['versao_sessao'] = $versaoSessao;
    $_SESSION['usuario_validado_em'] = time();
    session_write_close();

    return [
        'senha_atualizada' => true,
    ];
});
