<?php

declare(strict_types=1);

try {
    require_once __DIR__ . '/../config/database.php';
    echo "Conexão com o banco de dados realizada com sucesso.\n";
} catch (Throwable $erro) {
    fwrite(STDERR, "Não foi possível conectar. Confira o .env, as extensões PHP e a disponibilidade do banco.\n");
    exit(1);
}
