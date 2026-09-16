<?php

declare(strict_types=1);

require_once __DIR__ . '/sessao.php';
require_once __DIR__ . '/api.php';
iniciarSessaoSegura();
$csrf = tokenCsrf();
session_write_close();
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
