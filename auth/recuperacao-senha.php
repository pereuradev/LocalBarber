<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/sessao.php';
require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/senha.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

try {
    exigirMetodo('POST');
    iniciarSessaoSegura();
    exigirTokenCsrf();
    session_write_close();
    $corpo = file_get_contents('php://input', false, null, 0, 8193);
    if ($corpo === false || strlen($corpo) > 8192) {
        throw new ExcecaoApi('Requisição muito grande.', 413, 'corpo_invalido');
    }
    try {
        $dados = json_decode($corpo, true, 8, JSON_THROW_ON_ERROR);
    } catch (JsonException $erro) {
        throw new ExcecaoApi('Requisição inválida.', 400, 'corpo_invalido');
    }
    if (!is_array($dados)) {
        throw new ExcecaoApi('Requisição inválida.', 400, 'corpo_invalido');
    }
    foreach ($dados as $valor) {
        if (!is_string($valor)) {
            throw new ExcecaoApi('Campos inválidos.', 422, 'campos_invalidos');
        }
    }
    $acao = $dados['acao'] ?? '';
    if (!in_array($acao, ['solicitar', 'redefinir'], true)) {
        throw new ExcecaoApi('Operação inválida.', 422, 'acao_invalida');
    }
    require_once __DIR__ . '/../vendor/autoload.php';
    require_once __DIR__ . '/../config/env.php';
    loadEnvironmentFile(dirname(__DIR__) . '/.env');
    if ($acao === 'solicitar') {
        // Configuracao ausente falha igualmente para qualquer endereco, antes de consultar contas.
        new LocalBarber\EmailRecuperacao();
    }
    require __DIR__ . '/../config/database.php';
    $servico = new LocalBarber\RecuperacaoSenha($pdo);
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'desconhecido');
    if ($acao === 'solicitar') {
        $servico->solicitar($dados['email'] ?? '', $ip);
        $mensagem = LocalBarber\RecuperacaoSenha::RESPOSTA;
    } else {
        $servico->redefinir($dados['token'] ?? '', $dados['nova_senha'] ?? '', $dados['confirmacao_senha'] ?? '', $ip);
        $mensagem = 'Senha atualizada! Entre novamente com sua nova senha. Os acessos anteriores foram encerrados.';
    }
    responderJson(['sucesso' => true, 'dados' => ['mensagem' => $mensagem]]);
} catch (ExcecaoApi $erro) {
    responderJson(['sucesso' => false, 'codigo' => $erro->codigo, 'mensagem' => $erro->getMessage()], $erro->statusHttp);
} catch (Throwable $erro) {
    // Nunca registrar o corpo, o token ou o detalhe de SMTP/PDO nesta rota publica.
    error_log('[LocalBarber recuperacao] Serviço indisponível; confira dependências, SMTP e migração.');
    responderJson(['sucesso' => false, 'codigo' => 'recuperacao_indisponivel',
        'mensagem' => 'A recuperação de senha está temporariamente indisponível. Tente mais tarde ou contate o responsável pelo sistema.'], 503);
}
