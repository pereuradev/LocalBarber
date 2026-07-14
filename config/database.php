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

try {
    $host = requiredEnvironmentVariable('SUPABASE_DB_HOST');
    $port = requiredEnvironmentVariable('SUPABASE_DB_PORT');
    $dbname = requiredEnvironmentVariable('SUPABASE_DB_NAME');
    $user = requiredEnvironmentVariable('SUPABASE_DB_USER');
    $password = requiredEnvironmentVariable('SUPABASE_DB_PASSWORD');
    $schema = requiredEnvironmentVariable('SUPABASE_DB_SCHEMA');

    if (filter_var($port, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) === false) {
        throw new RuntimeException('SUPABASE_DB_PORT deve conter uma porta válida.');
    }

    $pdo = new PDO(
        "pgsql:host={$host};port={$port};dbname={$dbname};sslmode=require",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $pdo->exec('SET search_path TO "' . str_replace('"', '""', $schema) . '", public');
} catch (Throwable $exception) {
    error_log('[LocalBarber] Falha ao inicializar o banco de dados: ' . $exception->getMessage());
    http_response_code(500);
    exit('Não foi possível inicializar o banco de dados. Verifique a configuração local.');
}
