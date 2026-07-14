<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo nao permitido.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$email = trim((string)($_POST['email'] ?? ''));
$senha = (string)($_POST['senha'] ?? '');

if ($email === '' || $senha === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Preencha email e senha para entrar.']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        'select
            u.id,
            u.barbearia_id,
            u.nome,
            u.email,
            u.senha_hash,
            u.papel,
            u.ativo,
            b.nome_fantasia
        from usuarios u
        left join barbearias b on b.id = u.barbearia_id
        where lower(u.email) = lower(:email)
        limit 1'
    );
    $stmt->execute(['email' => $email]);
    $usuario = $stmt->fetch();
    $usuarioAtivo = $usuario && in_array(strtolower((string)$usuario['ativo']), ['1', 't', 'true'], true);

    if ($usuarioAtivo && !empty($usuario['senha_hash']) && password_verify($senha, $usuario['senha_hash'])) {
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = $usuario['id'];
        $_SESSION['barbearia_id'] = $usuario['barbearia_id'];
        $_SESSION['usuario_nome'] = $usuario['nome'];
        $_SESSION['usuario_email'] = $usuario['email'];
        $_SESSION['usuario_papel'] = $usuario['papel'];
        $_SESSION['barbearia_nome'] = $usuario['nome_fantasia'] ?: 'LocalBarber';

        $pdo->prepare('update usuarios set ultimo_acesso_at = now() where id = :id')
            ->execute(['id' => $usuario['id']]);

        echo json_encode([
            'ok' => true,
            'message' => 'Login realizado com sucesso.',
            'redirect' => 'dashboard.php',
        ]);
        exit;
    }

    try {
        $stmt = $pdo->prepare(
            'select id, nome_fantasia, email, senha
             from public.barbearias
             where lower(email) = lower(:email)
             limit 1'
        );
        $stmt->execute(['email' => $email]);
        $barbearia = $stmt->fetch();
    } catch (PDOException $e) {
        $barbearia = false;
    }

    $senhaLegadaValida = $barbearia
        && !empty($barbearia['senha'])
        && (
            hash_equals((string)$barbearia['senha'], $senha)
            || password_verify($senha, (string)$barbearia['senha'])
        );

    if ($senhaLegadaValida) {
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = 'legacy-' . $barbearia['id'];
        $_SESSION['barbearia_id'] = $barbearia['id'];
        $_SESSION['usuario_nome'] = $barbearia['nome_fantasia'] ?: 'Administrador';
        $_SESSION['usuario_email'] = $barbearia['email'];
        $_SESSION['usuario_papel'] = 'admin';
        $_SESSION['barbearia_nome'] = $barbearia['nome_fantasia'] ?: 'LocalBarber';

        echo json_encode([
            'ok' => true,
            'message' => 'Login realizado com sucesso.',
            'redirect' => 'dashboard.php',
        ]);
        exit;
    }

    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Email ou senha incorretos.']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Erro ao conectar com o banco de dados.']);
}
