<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/env.php';
loadEnvironmentFile(dirname(__DIR__) . '/.env');

try {
    require_once __DIR__ . '/../vendor/autoload.php';
    $email = new LocalBarber\EmailRecuperacao();
    if (in_array('--verificar-config', $argv, true)) {
        echo "Dependências e configuração preenchidas. Autenticação Gmail ainda não testada.\n";
        exit(0);
    }
    require __DIR__ . '/../config/database.php';
    $servico = new LocalBarber\RecuperacaoSenha($pdo);
    $servico->limparExpirados();
    $inicio = microtime(true);
    $falhas = 0;
    $processados = 0;
    while ($processados < 20 && microtime(true) - $inicio < 45) {
        $resultado = $servico->processarProximo([$email, 'enviar']);
        if ($resultado === 'vazio') break;
        $processados++;
        if ($resultado === 'falha') $falhas++;
    }
    echo "Pedidos processados: {$processados}; falhas: {$falhas}.\n";
    exit($falhas > 0 ? 1 : 0);
} catch (Throwable $erro) {
    fwrite(STDERR, "Envio indisponível. Confira Composer, APP_URL, SMTP_USERNAME, SMTP_PASSWORD e a migração de recuperação.\n");
    exit(1);
}
