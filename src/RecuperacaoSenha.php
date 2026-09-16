<?php

declare(strict_types=1);

namespace LocalBarber;

use ExcecaoApi;
use PDO;
use Throwable;

final class RecuperacaoSenha
{
    public const RESPOSTA = 'Se o e-mail estiver cadastrado e ativo, você receberá um link para redefinir a senha. Confira também o spam e aguarde alguns minutos.';

    public function __construct(private PDO $pdo)
    {
    }

    public function limitar(string $chave, int $maximo, int $segundos): bool
    {
        $sql = $this->pdo->prepare("INSERT INTO recuperacao_senha_limites AS l (chave, quantidade, expira_em)
            VALUES (:chave, 1, now() + make_interval(secs => :segundos))
            ON CONFLICT (chave) DO UPDATE SET
                quantidade = CASE WHEN l.expira_em <= now() THEN 1 ELSE least(l.quantidade + 1, 100000) END,
                expira_em = CASE WHEN l.expira_em <= now() THEN EXCLUDED.expira_em ELSE l.expira_em END
            RETURNING quantidade");
        $sql->execute(['chave' => hash('sha256', $chave), 'segundos' => $segundos]);
        return (int)$sql->fetchColumn() <= $maximo;
    }

    public function solicitar(string $email, string $ip): void
    {
        if (!$this->limitar('solicitar-ip:' . $ip, 10, 900)) {
            throw new ExcecaoApi('Muitas solicitações. Aguarde 15 minutos antes de tentar novamente.', 429, 'limite_recuperacao');
        }
        $email = mb_strtolower(trim($email), 'UTF-8');
        if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ExcecaoApi('Informe um e-mail válido.', 422, 'email_invalido');
        }
        if (!$this->limitar('solicitar-email:' . $email, 3, 3600)) {
            return;
        }
        // Nao consulta usuarios aqui: emails conhecidos e desconhecidos seguem o mesmo caminho.
        $sql = $this->pdo->prepare('INSERT INTO recuperacao_senha_emails(email) VALUES (:email)');
        $sql->execute(['email' => $email]);
    }

    public function redefinir(string $token, string $senha, string $confirmacao, string $ip): void
    {
        if (!$this->limitar('redefinir-ip:' . $ip, 30, 900)) {
            throw new ExcecaoApi('Muitas tentativas. Aguarde 15 minutos.', 429, 'limite_recuperacao');
        }
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            $this->linkInvalido();
        }
        \validarNovaSenha($senha);
        if (!hash_equals($senha, $confirmacao)) {
            throw new ExcecaoApi('A confirmação da nova senha não confere.', 422, 'confirmacao_invalida');
        }
        $hash = hash('sha256', $token);
        $novoHash = password_hash($senha, PASSWORD_DEFAULT);
        $this->pdo->beginTransaction();
        try {
            // Todos os resets bloqueiam o usuario antes do token, inclusive links distintos.
            $sql = $this->pdo->prepare('SELECT u.id, u.versao_sessao FROM usuarios u
                WHERE u.id = (SELECT usuario_id FROM recuperacoes_senha WHERE token_hash = :hash)
                AND u.ativo AND u.barbearia_id IS NOT NULL FOR UPDATE');
            $sql->execute(['hash' => $hash]);
            $usuario = $sql->fetch();
            if (!$usuario) {
                $this->linkInvalido();
            }
            $sql = $this->pdo->prepare('SELECT token_hash FROM recuperacoes_senha
                WHERE token_hash = :hash AND usuario_id = :usuario AND versao_sessao = :versao
                AND utilizado_em IS NULL AND expira_em > now() FOR UPDATE');
            $sql->execute(['hash' => $hash, 'usuario' => $usuario['id'], 'versao' => $usuario['versao_sessao']]);
            if (!$sql->fetchColumn()) {
                $this->linkInvalido();
            }
            $sql = $this->pdo->prepare('UPDATE usuarios SET senha_hash = :senha WHERE id = :usuario');
            $sql->execute(['senha' => $novoHash, 'usuario' => $usuario['id']]);
            $sql = $this->pdo->prepare('UPDATE recuperacoes_senha SET utilizado_em = now() WHERE token_hash = :hash');
            $sql->execute(['hash' => $hash]);
            // O trigger existente incrementa versao_sessao, revogando sessoes e todos os outros links.
            $this->pdo->commit();
        } catch (Throwable $erro) {
            $this->pdo->rollBack();
            throw $erro;
        }
    }

    private function linkInvalido(): void
    {
        throw new ExcecaoApi('Este link é inválido, expirou ou já foi utilizado. Solicite um novo.', 422, 'link_invalido');
    }

    /** Processa um pedido com reserva curta; nunca segura transacao durante SMTP. */
    public function processarProximo(callable $enviar): string
    {
        $sql = $this->pdo->query("WITH proximo AS (
            SELECT id FROM recuperacao_senha_emails WHERE tentativas < 3
            AND disponivel_em <= now() AND (reservado_ate IS NULL OR reservado_ate < now())
            ORDER BY disponivel_em, id FOR UPDATE SKIP LOCKED LIMIT 1
        ) UPDATE recuperacao_senha_emails e SET tentativas = e.tentativas + 1,
            reservado_ate = now() + interval '5 minutes'
          FROM proximo WHERE e.id = proximo.id RETURNING e.id, e.email, e.tentativas");
        $pedido = $sql->fetch();
        if (!$pedido) {
            return 'vazio';
        }
        $hash = null;
        try {
            $sql = $this->pdo->prepare('SELECT id, email, versao_sessao FROM usuarios
                WHERE lower(email) = :email AND ativo AND barbearia_id IS NOT NULL LIMIT 1');
            $sql->execute(['email' => $pedido['email']]);
            $usuario = $sql->fetch();
            if ($usuario) {
                $token = bin2hex(random_bytes(32));
                $hash = hash('sha256', $token);
                $sql = $this->pdo->prepare('INSERT INTO recuperacoes_senha(token_hash, usuario_id, versao_sessao)
                    VALUES (:hash, :usuario, :versao)');
                $sql->execute(['hash' => $hash, 'usuario' => $usuario['id'], 'versao' => $usuario['versao_sessao']]);
                $enviar((string)$usuario['email'], $token);
            }
            $sql = $this->pdo->prepare('DELETE FROM recuperacao_senha_emails WHERE id = :id');
            $sql->execute(['id' => $pedido['id']]);
            return 'processado';
        } catch (Throwable $erro) {
            if ($hash !== null) {
                $sql = $this->pdo->prepare('DELETE FROM recuperacoes_senha WHERE token_hash = :hash');
                $sql->execute(['hash' => $hash]);
            }
            $sql = $this->pdo->prepare("UPDATE recuperacao_senha_emails SET reservado_ate = NULL,
                disponivel_em = now() + interval '5 minutes' WHERE id = :id");
            $sql->execute(['id' => $pedido['id']]);
            // Mensagens de SMTP/PDO podem incluir destinatarios, links ou credenciais.
            error_log('[LocalBarber recuperacao] Falha no envio; pedido=' . $pedido['id'] . '; tentativa=' . $pedido['tentativas']);
            return 'falha';
        }
    }

    public function limparExpirados(): void
    {
        $this->pdo->exec('DELETE FROM recuperacoes_senha WHERE expira_em < now()');
        $this->pdo->exec('DELETE FROM recuperacao_senha_limites WHERE expira_em < now()');
        $this->pdo->exec("DELETE FROM recuperacao_senha_emails WHERE criado_em < now() - interval '1 day'");
    }
}
