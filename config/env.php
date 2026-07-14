<?php

declare(strict_types=1);

/**
 * Carrega um arquivo .env simples sem sobrescrever variáveis definidas pelo servidor.
 */
function loadEnvironmentFile(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES);

    if ($lines === false) {
        throw new RuntimeException('Não foi possível ler o arquivo .env.');
    }

    foreach ($lines as $lineNumber => $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        $separator = strpos($line, '=');

        if ($separator === false) {
            throw new RuntimeException('Linha inválida no .env: ' . ($lineNumber + 1));
        }

        $name = trim(substr($line, 0, $separator));
        $value = trim(substr($line, $separator + 1));

        if (!preg_match('/^[A-Z_][A-Z0-9_]*$/', $name)) {
            throw new RuntimeException('Nome de variável inválido no .env: ' . ($lineNumber + 1));
        }

        if (getenv($name) !== false) {
            continue;
        }

        $value = decodeEnvironmentValue($value);
        putenv("{$name}={$value}");
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

/**
 * Remove aspas e interpreta apenas escapes seguros de valores entre aspas duplas.
 */
function decodeEnvironmentValue(string $value): string
{
    $length = strlen($value);

    if ($length < 2) {
        return $value;
    }

    $first = $value[0];
    $last = $value[$length - 1];

    if ($first === "'" && $last === "'") {
        return substr($value, 1, -1);
    }

    if ($first !== '"' || $last !== '"') {
        return $value;
    }

    $unquoted = substr($value, 1, -1);

    return preg_replace_callback(
        '/\\\\([nrt"\\\\])/',
        static function (array $match): string {
            return match ($match[1]) {
                'n' => "\n",
                'r' => "\r",
                't' => "\t",
                '"' => '"',
                '\\' => '\\',
            };
        },
        $unquoted
    ) ?? $unquoted;
}

