<?php

declare(strict_types=1);

require_once __DIR__ . '/perfis-acesso.php';

final class ExcecaoApi extends RuntimeException
{
    public function __construct(
        string $mensagem,
        public int $statusHttp = 400,
        public string $codigo = 'requisicao_invalida'
    ) {
        parent::__construct($mensagem);
    }
}

function responderJson(array $dados, int $statusHttp = 200): void
{
    http_response_code($statusHttp);
    echo json_encode(
        $dados,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
    );
    exit;
}

function executarApi(callable $operacao): void
{
    try {
        $resultado = $operacao();
        responderJson(['sucesso' => true, 'dados' => $resultado]);
    } catch (ExcecaoApi $excecao) {
        responderJson([
            'sucesso' => false,
            'codigo' => $excecao->codigo,
            'mensagem' => $excecao->getMessage(),
        ], $excecao->statusHttp);
    } catch (PDOException $excecao) {
        error_log('[LocalBarber API] Falha no banco: ' . $excecao->getMessage());

        $detalhe = (string)$excecao->getMessage();
        if ($excecao->getCode() === '23P01' || str_contains($detalhe, 'agendamentos_horario_funcionario_uniq')) {
            responderJson(['sucesso' => false, 'codigo' => 'horario_ocupado',
                'mensagem' => 'O profissional já possui um atendimento nesse intervalo.'], 409);
        }
        if (
            str_contains($detalhe, 'agendamentos_expediente')
            || str_contains($detalhe, 'Agendamento fora do horário de funcionamento')
            || str_contains($detalhe, 'Agendamento fora do horario de funcionamento')
        ) {
            responderJson(['sucesso' => false, 'codigo' => 'fora_do_expediente',
                'mensagem' => 'O atendimento está fora do expediente. Confira os horários em Minha Barbearia.'], 422);
        }
        if (str_contains($detalhe, 'barbearias_cnpj')) {
            responderJson(['sucesso' => false, 'codigo' => 'cnpj_invalido_ou_duplicado',
                'mensagem' => 'O CNPJ é inválido ou já pertence a outra barbearia.'], 422);
        }
        if (str_contains($detalhe, 'transacoes_agendamento_ativo_uniq')) {
            responderJson([
                'sucesso' => false,
                'codigo' => 'agendamento_ja_pago',
                'mensagem' => 'Este agendamento já possui uma transação ativa.',
            ], 409);
        }

        if ($excecao->getCode() === '23505') {
            responderJson([
                'sucesso' => false,
                'codigo' => 'registro_duplicado',
                'mensagem' => 'Já existe um registro com essas informações.',
            ], 409);
        }

        responderJson([
            'sucesso' => false,
            'codigo' => 'erro_banco',
            'mensagem' => 'Não foi possível concluir a operação no banco de dados.',
        ], 500);
    } catch (Throwable $excecao) {
        error_log('[LocalBarber API] Falha inesperada: ' . $excecao->getMessage());
        responderJson([
            'sucesso' => false,
            'codigo' => 'erro_interno',
            'mensagem' => 'Ocorreu um erro inesperado. Tente novamente.',
        ], 500);
    }
}

function invalidarSessao(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $parametrosCookie = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $parametrosCookie['path'],
            $parametrosCookie['domain'],
            $parametrosCookie['secure'],
            $parametrosCookie['httponly']
        );
    }

    session_destroy();
}

function exigirAutenticacao(PDO $pdo): array
{
    $identificadorUsuario = trim((string)($_SESSION['usuario_id'] ?? ''));
    $identificadorBarbearia = trim((string)($_SESSION['barbearia_id'] ?? ''));

    if (!identificadorUuidValido($identificadorUsuario) || !identificadorUuidValido($identificadorBarbearia)) {
        throw new ExcecaoApi('Sua sessão expirou. Entre novamente.', 401, 'sessao_expirada');
    }

    // A versão é consultada a cada requisição para revogar outros dispositivos após trocar a senha.
    $consultaUsuario = $pdo->prepare(
        'select u.id, u.nome, u.email, u.papel, u.versao_sessao, b.nome_fantasia,
                coalesce(u.cor_tema, b.cor_tema, \'#244BC5\') as cor_tema
         from usuarios u
         join barbearias b on b.id = u.barbearia_id
         where u.id = :usuario_id and u.barbearia_id = :barbearia_id and u.ativo
         limit 1'
    );
    $consultaUsuario->execute([
        'usuario_id' => $identificadorUsuario,
        'barbearia_id' => $identificadorBarbearia,
    ]);
    $usuario = $consultaUsuario->fetch();
    if (!$usuario || (int)($_SESSION['versao_sessao'] ?? 0) !== (int)$usuario['versao_sessao']) {
        invalidarSessao();
        throw new ExcecaoApi('Seu acesso mudou. Entre novamente.', 401, 'sessao_revogada');
    }

    $_SESSION['usuario_nome'] = $usuario['nome'];
    $_SESSION['usuario_email'] = $usuario['email'];
    $_SESSION['usuario_papel'] = $usuario['papel'];
    $_SESSION['barbearia_nome'] = $usuario['nome_fantasia'] ?: 'LocalBarber';
    $_SESSION['usuario_cor_tema'] = $usuario['cor_tema'] ?: '#244BC5';
    $papelUsuario = (string)$usuario['papel'];
    tokenCsrf();

    $sessao = [
        'usuario_id' => $identificadorUsuario,
        'barbearia_id' => $identificadorBarbearia,
        'usuario_nome' => $_SESSION['usuario_nome'],
        'usuario_email' => $_SESSION['usuario_email'],
        'usuario_papel' => $papelUsuario,
        'tipo_acesso' => tipoAcessoPorPapel($papelUsuario),
        'permissoes' => permissoesPorPapel($papelUsuario),
        'barbearia_nome' => $_SESSION['barbearia_nome'],
        'usuario_cor_tema' => $_SESSION['usuario_cor_tema'],
    ];
    session_write_close();
    return $sessao;
}

function exigirPermissao(array $sessao, string $permissao): void
{
    if (!possuiPermissao((string)$sessao['usuario_papel'], $permissao)) {
        throw new ExcecaoApi(
            'Seu perfil não possui permissão para realizar esta ação.',
            403,
            'permissao_negada'
        );
    }
}

function exigirMetodo(string ...$metodosPermitidos): string
{
    $metodo = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $metodosNormalizados = array_map('strtoupper', $metodosPermitidos);

    if (!in_array($metodo, $metodosNormalizados, true)) {
        header('Allow: ' . implode(', ', $metodosNormalizados));
        throw new ExcecaoApi('Método não permitido.', 405, 'metodo_nao_permitido');
    }

    return $metodo;
}

function lerCorpoJson(): array
{
    $conteudo = (string)file_get_contents('php://input');

    if ($conteudo === '') {
        return [];
    }

    $dados = json_decode($conteudo, true);

    if (!is_array($dados)) {
        throw new ExcecaoApi('O corpo da requisição deve conter JSON válido.', 400, 'json_invalido');
    }

    return $dados;
}

function tokenCsrf(): string
{
    if (empty($_SESSION['token_csrf'])) {
        $_SESSION['token_csrf'] = bin2hex(random_bytes(32));
    }

    return (string)$_SESSION['token_csrf'];
}

function executarConsultaJson(PDO $pdo, string $sql, array $parametros = []): array
{
    $consulta = $pdo->prepare($sql);
    $consulta->execute($parametros);
    $json = $consulta->fetchColumn();

    if ($json === false || $json === null || $json === '') {
        return [];
    }

    try {
        $dados = json_decode((string)$json, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $excecao) {
        throw new RuntimeException('O banco retornou uma resposta JSON inválida.', 0, $excecao);
    }

    return is_array($dados) ? $dados : [];
}

function exigirTokenCsrf(): void
{
    $tokenRecebido = trim((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));

    if ($tokenRecebido === '' || !hash_equals(tokenCsrf(), $tokenRecebido)) {
        throw new ExcecaoApi(
            'A validação de segurança expirou. Atualize a página e tente novamente.',
            419,
            'csrf_invalido'
        );
    }
}

function identificadorUuidValido(string $identificador): bool
{
    return preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
        $identificador
    ) === 1;
}

function exigirUuid(array $dados, string $campo = 'id'): string
{
    $identificador = trim((string)($dados[$campo] ?? ''));

    if (!identificadorUuidValido($identificador)) {
        throw new ExcecaoApi('Identificador inválido.', 422, 'identificador_invalido');
    }

    return $identificador;
}

function exigirTexto(
    array $dados,
    string $campo,
    string $rotulo,
    int $tamanhoMaximo = 255
): string {
    $valor = trim((string)($dados[$campo] ?? ''));

    if ($valor === '') {
        throw new ExcecaoApi("Preencha o campo {$rotulo}.", 422, 'campo_obrigatorio');
    }

    if (mb_strlen($valor) > $tamanhoMaximo) {
        throw new ExcecaoApi(
            "O campo {$rotulo} deve ter no máximo {$tamanhoMaximo} caracteres.",
            422,
            'campo_muito_longo'
        );
    }

    return $valor;
}

function textoOpcional(array $dados, string $campo, int $tamanhoMaximo = 1000): ?string
{
    $valor = trim((string)($dados[$campo] ?? ''));

    if ($valor === '') {
        return null;
    }

    if (mb_strlen($valor) > $tamanhoMaximo) {
        throw new ExcecaoApi(
            "O campo {$campo} deve ter no máximo {$tamanhoMaximo} caracteres.",
            422,
            'campo_muito_longo'
        );
    }

    return $valor;
}

function emailOpcional(array $dados, string $campo = 'email'): ?string
{
    $email = textoOpcional($dados, $campo, 254);

    if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new ExcecaoApi('Informe um e-mail válido.', 422, 'email_invalido');
    }

    return $email === null ? null : mb_strtolower($email);
}

function urlOpcional(array $dados, string $campo): ?string
{
    $url = textoOpcional($dados, $campo, 2048);

    if ($url !== null && filter_var($url, FILTER_VALIDATE_URL) === false) {
        throw new ExcecaoApi('Informe uma URL válida, incluindo https://.', 422, 'url_invalida');
    }

    return $url;
}

function corHexOpcional(array $dados, string $campo = 'cor_tema'): ?string
{
    if (!array_key_exists($campo, $dados)) {
        return null;
    }

    $cor = strtoupper(trim((string)$dados[$campo]));

    if (preg_match('/^#[0-9A-F]{6}$/', $cor) !== 1) {
        throw new ExcecaoApi(
            'Selecione uma cor válida para o sistema.',
            422,
            'cor_tema_invalida'
        );
    }

    return $cor;
}

function numeroDecimal(
    array $dados,
    string $campo,
    string $rotulo,
    float $minimo = 0,
    float $maximo = PHP_FLOAT_MAX
): float {
    $valor = filter_var($dados[$campo] ?? null, FILTER_VALIDATE_FLOAT);

    if ($valor === false || $valor < $minimo || $valor > $maximo) {
        throw new ExcecaoApi(
            "Informe um valor válido para {$rotulo}.",
            422,
            'numero_invalido'
        );
    }

    return round((float)$valor, 2);
}

function numeroInteiro(
    array $dados,
    string $campo,
    string $rotulo,
    int $minimo = 0,
    int $maximo = PHP_INT_MAX
): int {
    $valor = filter_var(
        $dados[$campo] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => $minimo, 'max_range' => $maximo]]
    );

    if ($valor === false) {
        throw new ExcecaoApi(
            "Informe um valor válido para {$rotulo}.",
            422,
            'numero_invalido'
        );
    }

    return (int)$valor;
}

function valorBooleano(mixed $valor, bool $padrao = true): bool
{
    if ($valor === null) {
        return $padrao;
    }

    return filter_var($valor, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $padrao;
}

function exigirOpcao(
    array $dados,
    string $campo,
    string $rotulo,
    array $opcoes
): string {
    $valor = trim((string)($dados[$campo] ?? ''));

    if (!in_array($valor, $opcoes, true)) {
        throw new ExcecaoApi(
            "Selecione uma opção válida para {$rotulo}.",
            422,
            'opcao_invalida'
        );
    }

    return $valor;
}

function parametroConsulta(string $nome, int $tamanhoMaximo = 100): string
{
    return mb_substr(trim((string)($_GET[$nome] ?? '')), 0, $tamanhoMaximo);
}

function parametrosPaginacao(): array
{
    $pagina = filter_var($_GET['pagina'] ?? 1, FILTER_VALIDATE_INT);
    $tamanho = filter_var($_GET['por_pagina'] ?? 50, FILTER_VALIDATE_INT);
    if ($pagina === false || $pagina < 1 || $pagina > 1000000
        || $tamanho === false || $tamanho < 1 || $tamanho > 100) {
        throw new ExcecaoApi('Informe uma página e tamanho válidos (1 a 100 registros).', 422, 'paginacao_invalida');
    }
    return [
        'pagina' => $pagina,
        'tamanho_pagina' => $tamanho,
        'limite' => $tamanho,
        'deslocamento' => ($pagina - 1) * $tamanho,
    ];
}

function dataIsoValida(string $data): bool
{
    $objetoData = DateTimeImmutable::createFromFormat('!Y-m-d', $data);
    return $objetoData !== false && $objetoData->format('Y-m-d') === $data;
}

function horarioValido(string $horario): bool
{
    return preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $horario) === 1;
}
