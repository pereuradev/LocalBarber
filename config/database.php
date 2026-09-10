<?php

declare(strict_types=1);

require_once __DIR__ . '/env.php';

loadEnvironmentFile(dirname(__DIR__) . '/.env');

/**
 * Retorna uma variável obrigatória sem manter credenciais no código-fonte.
 */
function requiredEnvironmentVariable(string $name): string
{
    $value = getenv($name);

    if ($value === false || trim($value) === '') {
        throw new RuntimeException(
            "Variável de ambiente obrigatória ausente: {$name}. " .
            'Copie .env.example para .env e preencha os dados locais.'
        );
    }

    return trim($value);
}

function optionalBooleanEnvironmentVariable(string $name, bool $default): bool
{
    $value = getenv($name);

    if ($value === false || trim($value) === '') {
        return $default;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
}

try {
    $host = requiredEnvironmentVariable('SUPABASE_DB_HOST');
    $port = requiredEnvironmentVariable('SUPABASE_DB_PORT');
    $dbname = requiredEnvironmentVariable('SUPABASE_DB_NAME');
    $user = requiredEnvironmentVariable('SUPABASE_DB_USER');
    $password = requiredEnvironmentVariable('SUPABASE_DB_PASSWORD');
    $schema = requiredEnvironmentVariable('SUPABASE_DB_SCHEMA');
    $persistentConnection = optionalBooleanEnvironmentVariable('SUPABASE_DB_PERSISTENT', false);

    if (filter_var($port, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) === false) {
        throw new RuntimeException('SUPABASE_DB_PORT deve conter uma porta válida.');
    }

    if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $schema) !== 1) {
        throw new RuntimeException('SUPABASE_DB_SCHEMA deve conter um identificador valido.');
    }

    $pdo = new PDO(
        "pgsql:host={$host};port={$port};dbname={$dbname};sslmode=require;" .
        "options='--search_path={$schema},public'",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => $persistentConnection,
        ]
    );

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // O navegador envia horários da barbearia. Datas SQL e current_date usam o mesmo fuso.
    $pdo->exec("set time zone 'America/Sao_Paulo'");
    date_default_timezone_set('America/Sao_Paulo');

} catch (Throwable $exception) {
    error_log('[LocalBarber] Falha ao inicializar o banco de dados: ' . $exception->getMessage());
    throw new RuntimeException('Não foi possível inicializar o banco de dados. Verifique a configuração local.', 0, $exception);
}
