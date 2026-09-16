<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/senha.php';

use LocalBarber\EmailRecuperacao;

function verificarRecuperacao(bool $ok, string $mensagem): void
{
    if (!$ok) throw new RuntimeException($mensagem);
}
function rejeitarRecuperacao(callable $operacao, string $codigo): void
{
    try { $operacao(); } catch (ExcecaoApi $erro) {
        verificarRecuperacao($erro->codigo === $codigo, 'Código inesperado: ' . $erro->codigo);
        return;
    }
    throw new RuntimeException('Operação insegura aceita: ' . $codigo);
}

validarNovaSenha('SenhaForte123');
validarNovaSenha(str_repeat('a', 71) . '1');
foreach (['abc1', 'semnumeros', '123456789', str_repeat('a', 72) . '1', str_repeat('á', 36) . '1'] as $senha) {
    rejeitarRecuperacao(static fn () => validarNovaSenha($senha), 'senha_invalida');
}
foreach (['http://localhost/LocalBarber', 'http://127.0.0.1:8000', 'https://example.invalid/portal'] as $url) {
    verificarRecuperacao(EmailRecuperacao::validarUrl($url . '/') === $url, 'URL confiável recusada.');
}
foreach (['', 'http://example.invalid', 'https://user@example.invalid', 'https://example.invalid?next=foo', 'https://example.invalid#foo', 'javascript:alert(1)', "https://example.invalid/\r\nX: y"] as $url) {
    $rejeitada = false;
    try { EmailRecuperacao::validarUrl($url); } catch (RuntimeException $erro) { $rejeitada = true; }
    verificarRecuperacao($rejeitada, 'URL não confiável aceita.');
}
putenv('APP_URL=http://localhost/LocalBarber');
putenv('SMTP_USERNAME=remetente@example.invalid');
putenv('SMTP_PASSWORD=senha-ficticia-teste');
$emailTeste = new EmailRecuperacao();
$tokenTeste = bin2hex(random_bytes(32));
$mail = $emailTeste->mensagem('destinatario@example.invalid', $tokenTeste);
verificarRecuperacao($mail->Host === 'smtp.gmail.com' && $mail->Port === 587 && $mail->SMTPSecure === 'tls', 'Gmail sem TLS.');
verificarRecuperacao($mail->SMTPDebug === 0 && $mail->SMTPOptions === [], 'Depuração ou TLS inseguro.');
$mail->preSend();
$mime = $mail->getSentMIMEMessage();
verificarRecuperacao(str_contains($mime, 'multipart/alternative'), 'Falta versão texto/HTML.');
verificarRecuperacao(str_contains($mail->AltBody, '#token=' . $tokenTeste), 'Link incorreto.');
verificarRecuperacao(!str_contains($mime, 'senha-ficticia-teste'), 'Senha SMTP exposta.');
echo "Recuperação: política de senha, URL confiável, Gmail TLS e mensagem MIME passaram.\n";
