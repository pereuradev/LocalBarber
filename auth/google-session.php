<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo nao permitido.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/supabase-auth.php';
require_once __DIR__ . '/../config/perfis-acesso.php';

$dadosRecebidos = json_decode((string)file_get_contents('php://input'), true);
$tokenAcesso = is_array($dadosRecebidos) ? trim((string)($dadosRecebidos['access_token'] ?? '')) : '';
$tipoAcesso = normalizarTipoAcesso(
    is_array($dadosRecebidos) ? ($dadosRecebidos['tipo_acesso'] ?? null) : null
);

if ($tokenAcesso === '' || strlen($tokenAcesso) > 8192 || $tipoAcesso === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Sessão do Google ou tipo de acesso inválido. Tente novamente.']);
    exit;
}

function obterUsuarioSupabase(string $tokenAcesso): array
{
    $requisicao = curl_init(SUPABASE_PROJECT_URL . '/auth/v1/user');
    if ($requisicao === false) {
        throw new RuntimeException('supabase_unavailable');
    }

    curl_setopt_array($requisicao, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'apikey: ' . SUPABASE_PUBLISHABLE_KEY,
            'Authorization: Bearer ' . $tokenAcesso,
        ],
    ]);

    $corpoResposta = curl_exec($requisicao);
    $statusHttp = (int)curl_getinfo($requisicao, CURLINFO_RESPONSE_CODE);
    $requisicaoFalhou = $corpoResposta === false;
    curl_close($requisicao);

    if ($requisicaoFalhou) {
        throw new RuntimeException('supabase_unavailable');
    }

    $usuarioSupabase = is_string($corpoResposta) ? json_decode($corpoResposta, true) : null;

    if ($statusHttp !== 200 || !is_array($usuarioSupabase)) {
        $autenticacaoRejeitada = $statusHttp >= 400 && $statusHttp < 500;
        throw new RuntimeException($autenticacaoRejeitada ? 'unauthorized' : 'supabase_unavailable');
    }

    return $usuarioSupabase;
}

function criarSessaoLocal(array $usuario, string $tipoAcesso): void
{
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['barbearia_id'] = $usuario['barbearia_id'];
    $_SESSION['usuario_nome'] = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_papel'] = $usuario['papel'];
    $_SESSION['tipo_acesso'] = $tipoAcesso;
    $_SESSION['barbearia_nome'] = $usuario['nome_fantasia'] ?: 'LocalBarber';
    $_SESSION['barbearia_cor_tema'] = $usuario['cor_tema'] ?: '#244BC5';
    $_SESSION['auth_provider'] = 'google';
    $_SESSION['usuario_validado_em'] = time();
}

try {
    $usuarioSupabase = obterUsuarioSupabase($tokenAcesso);
    $email = strtolower(trim((string)($usuarioSupabase['email'] ?? '')));
    $provedores = $usuarioSupabase['app_metadata']['providers'] ?? [];
    $emailConfirmado = !empty($usuarioSupabase['email_confirmed_at']);

    if (
        !filter_var($email, FILTER_VALIDATE_EMAIL)
        || !$emailConfirmado
        || !in_array('google', (array)$provedores, true)
    ) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'A conta retornada pelo Google nao pôde ser validada.']);
        exit;
    }

    $consulta = $pdo->prepare(
        'select
            u.id,
            u.barbearia_id,
            u.nome,
            u.email,
            u.papel,
            u.ativo,
            b.nome_fantasia,
            b.cor_tema
         from usuarios u
         left join barbearias b on b.id = u.barbearia_id
         where lower(u.email) = lower(:email)
         limit 1'
    );
    $consulta->execute(['email' => $email]);
    $usuario = $consulta->fetch();
    $usuarioAtivo = $usuario && in_array(strtolower((string)$usuario['ativo']), ['1', 't', 'true'], true);
    $perfilCompativel = $usuario && papelCompativelComTipoAcesso((string)$usuario['papel'], $tipoAcesso);

    if ($usuarioAtivo && $perfilCompativel) {
        criarSessaoLocal($usuario, $tipoAcesso);
        $pdo->prepare('update usuarios set ultimo_acesso_at = now() where id = :id')
            ->execute(['id' => $usuario['id']]);

        echo json_encode([
            'ok' => true,
            'message' => 'Autenticacao com Google concluida.',
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

    http_response_code($usuarioAtivo ? 401 : 403);
    echo json_encode([
        'ok' => false,
        'code' => $usuarioAtivo ? 'tipo_acesso_incorreto' : 'google_account_not_linked',
        'message' => $usuarioAtivo
            ? 'A conta existe, mas não corresponde ao tipo de acesso selecionado.'
            : 'Este email do Google ainda não está vinculado a uma barbearia. Cadastre a empresa usando o mesmo email.',
    ]);
} catch (RuntimeException $excecao) {
    $naoAutorizado = $excecao->getMessage() === 'unauthorized';
    http_response_code($naoAutorizado ? 401 : 502);
    echo json_encode([
        'ok' => false,
        'message' => $naoAutorizado
            ? 'A sessao do Google expirou. Tente novamente.'
            : 'Nao foi possivel validar o Google no momento. Tente novamente.',
    ]);
} catch (Throwable $excecao) {
    error_log('[LocalBarber] Falha no login Google: ' . $excecao->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Erro ao concluir a autenticacao com Google.']);
}
