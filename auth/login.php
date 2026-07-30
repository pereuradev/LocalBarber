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
    $consultaUsuario = $pdo->prepare(
        'select
            u.id,
            u.barbearia_id,
            u.nome,
            u.email,
            u.senha_hash,
            u.papel,
            u.ativo,
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
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = $usuario['id'];
        $_SESSION['barbearia_id'] = $usuario['barbearia_id'];
        $_SESSION['usuario_nome'] = $usuario['nome'];
        $_SESSION['usuario_email'] = $usuario['email'];
        $_SESSION['usuario_papel'] = $usuario['papel'];
        $_SESSION['tipo_acesso'] = $tipoAcesso;
        $_SESSION['barbearia_nome'] = $usuario['nome_fantasia'] ?: 'LocalBarber';
        $_SESSION['barbearia_cor_tema'] = $usuario['cor_tema'] ?: '#244BC5';
        $_SESSION['usuario_validado_em'] = time();

        $pdo->prepare('update usuarios set ultimo_acesso_at = now() where id = :id')
            ->execute(['id' => $usuario['id']]);

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

    try {
        $consultaBarbearia = $pdo->prepare(
            'select id, nome_fantasia, email, senha
             from public.barbearias
             where lower(email) = lower(:email)
             limit 1'
        );
        $consultaBarbearia->execute(['email' => $email]);
        $barbearia = $consultaBarbearia->fetch();
    } catch (PDOException $excecaoBanco) {
        $barbearia = false;
    }

    $senhaLegadaValida = $barbearia
        && !empty($barbearia['senha'])
        && (
            hash_equals((string)$barbearia['senha'], $senha)
            || password_verify($senha, (string)$barbearia['senha'])
        );

    if ($senhaLegadaValida && $tipoAcesso === 'administrador') {
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = 'legacy-' . $barbearia['id'];
        $_SESSION['barbearia_id'] = $barbearia['id'];
        $_SESSION['usuario_nome'] = $barbearia['nome_fantasia'] ?: 'Administrador';
        $_SESSION['usuario_email'] = $barbearia['email'];
        $_SESSION['usuario_papel'] = 'admin';
        $_SESSION['tipo_acesso'] = 'administrador';
        $_SESSION['barbearia_nome'] = $barbearia['nome_fantasia'] ?: 'LocalBarber';
        $_SESSION['barbearia_cor_tema'] = '#244BC5';
        $_SESSION['usuario_validado_em'] = time();

        echo json_encode([
            'ok' => true,
            'message' => 'Login realizado com sucesso.',
            'redirect' => 'dashboard.php',
            'sessao_visual' => [
                'usuario' => [
                    'nome' => $barbearia['nome_fantasia'] ?: 'Administrador',
                    'tipo_acesso' => 'administrador',
                    'permissoes' => permissoesPorPapel('admin'),
                ],
                'barbearia' => [
                    'cor_tema' => '#244BC5',
                ],
            ],
        ]);
        exit;
    }

    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Email, senha ou tipo de acesso incorretos.']);
} catch (Throwable $excecao) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Erro ao conectar com o banco de dados.']);
}
