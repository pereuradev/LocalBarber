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

$payload = json_decode((string)file_get_contents('php://input'), true);
$accessToken = is_array($payload) ? trim((string)($payload['access_token'] ?? '')) : '';

if ($accessToken === '' || strlen($accessToken) > 8192) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Sessao do Google invalida. Tente novamente.']);
    exit;
}

function getSupabaseUser(string $accessToken): array
{
    $request = curl_init(SUPABASE_PROJECT_URL . '/auth/v1/user');
    if ($request === false) {
        throw new RuntimeException('supabase_unavailable');
    }

    curl_setopt_array($request, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'apikey: ' . SUPABASE_PUBLISHABLE_KEY,
            'Authorization: Bearer ' . $accessToken,
        ],
    ]);

    $body = curl_exec($request);
    $status = (int)curl_getinfo($request, CURLINFO_RESPONSE_CODE);
    $requestFailed = $body === false;
    curl_close($request);

    if ($requestFailed) {
        throw new RuntimeException('supabase_unavailable');
    }

    $user = is_string($body) ? json_decode($body, true) : null;

    if ($status !== 200 || !is_array($user)) {
        $authenticationRejected = $status >= 400 && $status < 500;
        throw new RuntimeException($authenticationRejected ? 'unauthorized' : 'supabase_unavailable');
    }

    return $user;
}

function createLocalSession(array $usuario): void
{
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['barbearia_id'] = $usuario['barbearia_id'];
    $_SESSION['usuario_nome'] = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_papel'] = $usuario['papel'];
    $_SESSION['barbearia_nome'] = $usuario['nome_fantasia'] ?: 'LocalBarber';
    $_SESSION['auth_provider'] = 'google';
}

try {
    $supabaseUser = getSupabaseUser($accessToken);
    $email = strtolower(trim((string)($supabaseUser['email'] ?? '')));
    $providers = $supabaseUser['app_metadata']['providers'] ?? [];
    $emailConfirmed = !empty($supabaseUser['email_confirmed_at']);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !$emailConfirmed || !in_array('google', (array)$providers, true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'A conta retornada pelo Google nao pôde ser validada.']);
        exit;
    }

    $stmt = $pdo->prepare(
        'select
            u.id,
            u.barbearia_id,
            u.nome,
            u.email,
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

    if ($usuarioAtivo) {
        createLocalSession($usuario);
        $pdo->prepare('update usuarios set ultimo_acesso_at = now() where id = :id')
            ->execute(['id' => $usuario['id']]);

        echo json_encode([
            'ok' => true,
            'message' => 'Autenticacao com Google concluida.',
            'redirect' => 'dashboard.php',
        ]);
        exit;
    }

    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'code' => 'google_account_not_linked',
        'message' => 'Este email do Google ainda nao esta vinculado a uma barbearia. Cadastre a empresa usando o mesmo email.',
    ]);
} catch (RuntimeException $exception) {
    $unauthorized = $exception->getMessage() === 'unauthorized';
    http_response_code($unauthorized ? 401 : 502);
    echo json_encode([
        'ok' => false,
        'message' => $unauthorized
            ? 'A sessao do Google expirou. Tente novamente.'
            : 'Nao foi possivel validar o Google no momento. Tente novamente.',
    ]);
} catch (Throwable $exception) {
    error_log('[LocalBarber] Falha no login Google: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Erro ao concluir a autenticacao com Google.']);
}
