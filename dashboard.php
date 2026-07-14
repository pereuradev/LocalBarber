<?php

declare(strict_types=1);

session_start();

if (empty($_SESSION['usuario_id'])) {
    header('Location: pagina-inicial.html?login=necessario');
    exit;
}

$dashboard = file_get_contents(__DIR__ . '/dashboard.html');

if ($dashboard === false) {
    http_response_code(500);
    echo 'Dashboard nao encontrado.';
    exit;
}

$nomeUsuario = htmlspecialchars((string)($_SESSION['usuario_nome'] ?? 'Usuario'), ENT_QUOTES, 'UTF-8');
$papelUsuario = htmlspecialchars((string)($_SESSION['usuario_papel'] ?? 'admin'), ENT_QUOTES, 'UTF-8');
$iniciais = strtoupper(substr(trim((string)($_SESSION['usuario_nome'] ?? 'U')), 0, 1));

$dashboard = str_replace('href="dashboard.html"', 'href="dashboard.php"', $dashboard);
$dashboard = preg_replace(
    '/<div class="user-avatar">.*?<\/div>\s*<div class="user-info">\s*<p>.*?<\/p>\s*<span>.*?<\/span>\s*<\/div>/s',
    '<div class="user-avatar">' . $iniciais . '</div>' .
    '<div class="user-info"><p>' . $nomeUsuario . '</p><span>' . ucfirst($papelUsuario) . '</span></div>',
    $dashboard,
    1
);
$dashboard = preg_replace_callback(
    '/(<div class="sidebar-footer">.*?)(\s*<\/div>\s*<\/aside>)/s',
    static function (array $matches): string {
        return $matches[1] . PHP_EOL .
            '    <a class="nav-item" href="auth/logout.php" style="margin-top:10px;">' .
            '<span>Sair</span></a>' . $matches[2];
    },
    $dashboard,
    1
);

echo $dashboard;
