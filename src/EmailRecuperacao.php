<?php

declare(strict_types=1);

namespace LocalBarber;

use PHPMailer\PHPMailer\PHPMailer;
use RuntimeException;

final class EmailRecuperacao
{
    private string $url;
    private string $usuario;
    private string $senha;

    public function __construct()
    {
        $this->url = self::validarUrl((string)getenv('APP_URL'));
        $this->usuario = trim((string)getenv('SMTP_USERNAME'));
        // O Google apresenta a senha de app agrupada com espacos.
        $this->senha = str_replace(' ', '', (string)getenv('SMTP_PASSWORD'));
        if (!filter_var($this->usuario, FILTER_VALIDATE_EMAIL) || $this->senha === '') {
            throw new RuntimeException('Configure SMTP_USERNAME e SMTP_PASSWORD no .env local.');
        }
    }

    public static function validarUrl(string $url): string
    {
        $url = rtrim(trim($url), '/');
        $partes = parse_url($url);
        $local = in_array($partes['host'] ?? '', ['localhost', '127.0.0.1', '[::1]'], true);
        if (!filter_var($url, FILTER_VALIDATE_URL) || !is_array($partes)
            || isset($partes['user'], $partes['pass']) || isset($partes['user'])
            || isset($partes['query']) || isset($partes['fragment'])
            || (($partes['scheme'] ?? '') !== 'https' && !(($partes['scheme'] ?? '') === 'http' && $local))) {
            throw new RuntimeException('APP_URL deve ser HTTPS, ou HTTP somente em localhost.');
        }
        return $url;
    }

    public function mensagem(string $email, string $token): PHPMailer
    {
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            throw new RuntimeException('Token inválido para envio.');
        }
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->Port = 587;
        $mail->SMTPAuth = true;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Username = $this->usuario;
        $mail->Password = $this->senha;
        $mail->Timeout = 15;
        $mail->Timelimit = 30;
        $mail->SMTPDebug = 0;
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->setFrom($this->usuario, 'LocalBarber');
        $mail->addAddress($email);
        $mail->Subject = 'Redefina sua senha no LocalBarber';
        // Fragmento nao vai para os logs de acesso HTTP; a pagina o remove ao abrir.
        $link = $this->url . '/redefinir-senha.php#token=' . $token;
        $linkHtml = htmlspecialchars($link, ENT_QUOTES, 'UTF-8');
        $mail->isHTML(true);
        $mail->Body = '<h1>Redefina sua senha</h1><p>Recebemos um pedido para recuperar seu acesso ao LocalBarber.</p>'
            . '<p><a href="' . $linkHtml . '">Criar uma nova senha</a></p>'
            . '<p>Este link é de uso único e expira em 30 minutos. Se não pediu esta alteração, ignore este e-mail. Sua senha continua a mesma.</p>';
        $mail->AltBody = "Redefina sua senha no LocalBarber:\n\n{$link}\n\nO link é de uso único e expira em 30 minutos. Se não pediu esta alteração, ignore este e-mail.";
        return $mail;
    }

    public function enviar(string $email, string $token): void
    {
        $this->mensagem($email, $token)->send();
    }
}
