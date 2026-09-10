<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/sessao.php';
iniciarSessaoSegura();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo nao permitido.']);
    exit;
}

require_once __DIR__ . '/../config/perfis-acesso.php';

$email = trim((string)($_POST['email'] ?? ''));
$senha = (string)($_POST['senha'] ?? '');
$tipoAcesso = normalizarTipoAcesso($_POST['tipo_acesso'] ?? null);

if ($email === '' || $senha === '' || $tipoAcesso === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Preencha email, senha e tipo de acesso.']);
    exit;
}

try {
    require_once __DIR__ . '/../config/database.php';
    $consultaUsuario = $pdo->prepare(
        'select
            u.id,
            u.barbearia_id,
            u.nome,
            u.email,
            u.senha_hash,
            u.papel,
            u.ativo,
            u.versao_sessao,
            b.nome_fantasia,
            b.cor_tema
        from usuarios u
        left join barbearias b on b.id = u.barbearia_id
        where lower(u.email) = lower(:email)
        limit 1'
    );
    $consultaUsuario->execute(['email' => $email]);
    $usuario = $consultaUsuario->fetch();
    $usuarioAtivo = $usuario && in_array(strtolower((string)$usuario['ativo']), ['1', 't', 'true'], true);
    $perfilCompativel = $usuario && papelCompativelComTipoAcesso((string)$usuario['papel'], $tipoAcesso);

    if (
        $usuarioAtivo
        && $perfilCompativel
        && !empty($usuario['senha_hash'])
        && password_verify($senha, $usuario['senha_hash'])
    ) {
        $pdo->prepare('update usuarios set ultimo_acesso_at = now() where id = :id')
            ->execute(['id' => $usuario['id']]);

        session_regenerate_id(true);
        $_SESSION['usuario_id'] = $usuario['id'];
        $_SESSION['versao_sessao'] = (int)$usuario['versao_sessao'];
        $_SESSION['token_csrf'] = bin2hex(random_bytes(32));
        $_SESSION['barbearia_id'] = $usuario['barbearia_id'];
        $_SESSION['usuario_nome'] = $usuario['nome'];
        $_SESSION['usuario_email'] = $usuario['email'];
        $_SESSION['usuario_papel'] = $usuario['papel'];
        $_SESSION['tipo_acesso'] = $tipoAcesso;
        $_SESSION['barbearia_nome'] = $usuario['nome_fantasia'] ?: 'LocalBarber';
        $_SESSION['barbearia_cor_tema'] = $usuario['cor_tema'] ?: '#244BC5';
        $_SESSION['usuario_validado_em'] = time();

        echo json_encode([
            'ok' => true,
            'message' => 'Login realizado com sucesso.',
            'redirect' => rotaInicialPorPapel((string)$usuario['papel']),
            'sessao_visual' => [
                'usuario' => [
                    'nome' => $usuario['nome'],
                    'tipo_acesso' => $tipoAcesso,
                    'permissoes' => permissoesPorPapel((string)$usuario['papel']),
                ],
                'barbearia' => [
                    'cor_tema' => $usuario['cor_tema'] ?: '#244BC5',
                ],
            ],
        ]);
        exit;
    }

    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Email, senha ou tipo de acesso incorretos.']);
} catch (Throwable $excecao) {
    error_log('[LocalBarber] Falha no login: ' . $excecao->getMessage());
    http_response_code(503);
    echo json_encode(['ok' => false, 'message' => 'Não foi possível acessar o banco. Tente novamente em instantes.']);
}
