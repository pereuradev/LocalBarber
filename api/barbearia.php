<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';
require_once __DIR__ . '/../config/brasil-api.php';

function validarHorarioFuncionamento(array $horario): array
{
    $diaSemana = numeroInteiro($horario, 'dia_semana', 'dia da semana', 0, 6);
    $ativo = valorBooleano($horario['ativo'] ?? null, false);
    $abertura = textoOpcional($horario, 'abertura', 5);
    $fechamento = textoOpcional($horario, 'fechamento', 5);

    if ($ativo && (
        $abertura === null
        || $fechamento === null
        || !horarioValido($abertura)
        || !horarioValido($fechamento)
        || $abertura >= $fechamento
    )) {
        throw new ExcecaoApi(
            'Revise os horários de abertura e fechamento.',
            422,
            'horario_invalido'
        );
    }

    return [
        'dia_semana' => $diaSemana,
        'abertura' => $ativo ? $abertura : null,
        'fechamento' => $ativo ? $fechamento : null,
        'ativo' => $ativo,
    ];
}

function urlComProtocolo(string $valor): string
{
    return preg_match('/^https?:\/\//i', $valor) === 1 ? $valor : "https://{$valor}";
}

function primeiroSegmentoCaminho(?string $caminho): string
{
    $segmentos = array_values(array_filter(explode('/', trim((string)$caminho, '/'))));
    return trim((string)($segmentos[0] ?? ''));
}

function caminhoUrl(string $url): ?string
{
    $caminho = parse_url($url, PHP_URL_PATH);
    return is_string($caminho) ? $caminho : null;
}

function falharPerfilSocial(string $plataforma): void
{
    $rotulos = [
        'instagram' => 'Instagram',
        'facebook' => 'Facebook',
        'linkedin' => 'LinkedIn',
        'youtube' => 'YouTube',
    ];
    $rotulo = $rotulos[$plataforma] ?? 'perfil';

    throw new ExcecaoApi(
        "O perfil informado para {$rotulo} não foi encontrado ou não existe. Por favor, tente novamente.",
        422,
        'perfil_social_nao_encontrado'
    );
}

function obterStatusHttp(string $url): ?int
{
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_NOBODY => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_USERAGENT => 'Mozilla/5.0 LocalBarber/1.0',
        ]);
        curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        return $status > 0 ? $status : null;
    }

    $cabecalhos = @get_headers($url);
    if (!is_array($cabecalhos) || !isset($cabecalhos[0])) {
        return null;
    }

    return preg_match('/\s(\d{3})\s/', (string)$cabecalhos[0], $resultado) === 1
        ? (int)$resultado[1]
        : null;
}

function validarPerfilSocialExiste(string $plataforma, string $url): void
{
    $status = obterStatusHttp($url);

    if (in_array($status, [404, 410], true)) {
        falharPerfilSocial($plataforma);
    }
}

function normalizarRedeSocial(string $plataforma, ?string $identificador, ?string $url): array
{
    $valor = trim((string)($url ?: $identificador ?: ''));

    if ($valor === '') {
        return [
            'identificador' => null,
            'url' => null,
            'ativo' => false,
        ];
    }

    $valorMinusculo = mb_strtolower($valor);

    if ($plataforma === 'instagram') {
        $valorAnalise = str_contains($valorMinusculo, 'instagram.com') ? urlComProtocolo($valor) : $valor;
        $usuario = str_contains($valorAnalise, '://')
            ? primeiroSegmentoCaminho(caminhoUrl($valorAnalise))
            : ltrim($valorAnalise, '@');

        if (preg_match('/^[A-Za-z0-9._]{1,30}$/', $usuario) !== 1 || str_contains($usuario, '..')) {
            falharPerfilSocial($plataforma);
        }

        $urlFinal = "https://www.instagram.com/{$usuario}/";
        validarPerfilSocialExiste($plataforma, $urlFinal);

        return [
            'identificador' => $usuario,
            'url' => $urlFinal,
            'ativo' => true,
        ];
    }

    if ($plataforma === 'facebook') {
        $valorAnalise = str_contains($valorMinusculo, 'facebook.com') || str_contains($valorMinusculo, 'fb.com')
            ? urlComProtocolo($valor)
            : $valor;
        $pagina = str_contains($valorAnalise, '://')
            ? primeiroSegmentoCaminho(caminhoUrl($valorAnalise))
            : ltrim($valorAnalise, '@');

        if (preg_match('/^[A-Za-z0-9._-]{3,80}$/', $pagina) !== 1) {
            falharPerfilSocial($plataforma);
        }

        $urlFinal = "https://www.facebook.com/{$pagina}";
        validarPerfilSocialExiste($plataforma, $urlFinal);

        return [
            'identificador' => $pagina,
            'url' => $urlFinal,
            'ativo' => true,
        ];
    }

    if ($plataforma === 'linkedin') {
        $tiposPermitidos = ['in', 'company', 'school', 'showcase'];
        $tipo = 'in';
        $perfil = '';

        if (str_contains($valorMinusculo, 'linkedin.com')) {
            $urlInformada = urlComProtocolo($valor);
            $host = mb_strtolower((string)parse_url($urlInformada, PHP_URL_HOST));
            if (preg_match('/(^|\.)linkedin\.com$/', $host) !== 1) {
                falharPerfilSocial($plataforma);
            }

            $partes = array_values(array_filter(explode('/', trim((string)caminhoUrl($urlInformada), '/'))));
            $tipo = mb_strtolower((string)($partes[0] ?? ''));
            $perfil = (string)($partes[1] ?? '');
        } else {
            $partes = array_values(array_filter(explode('/', trim($valor, '@/'))));
            if (count($partes) > 1 && in_array(mb_strtolower($partes[0]), $tiposPermitidos, true)) {
                $tipo = mb_strtolower($partes[0]);
                $perfil = (string)$partes[1];
            } else {
                $perfil = (string)($partes[0] ?? '');
            }
        }

        if (
            !in_array($tipo, $tiposPermitidos, true)
            || preg_match('/^[A-Za-z0-9._-]{2,120}$/', $perfil) !== 1
        ) {
            falharPerfilSocial($plataforma);
        }

        $identificadorFinal = "{$tipo}/{$perfil}";
        $urlFinal = "https://www.linkedin.com/{$identificadorFinal}/";
        validarPerfilSocialExiste($plataforma, $urlFinal);

        return [
            'identificador' => $identificadorFinal,
            'url' => $urlFinal,
            'ativo' => true,
        ];
    }

    if ($plataforma === 'youtube') {
        $caminhoCanal = '';

        if (str_contains($valorMinusculo, 'youtube.com')) {
            $urlInformada = urlComProtocolo($valor);
            $host = mb_strtolower((string)parse_url($urlInformada, PHP_URL_HOST));
            if (preg_match('/(^|\.)youtube\.com$/', $host) !== 1) {
                falharPerfilSocial($plataforma);
            }

            $caminhoCanal = trim((string)caminhoUrl($urlInformada), '/');
        } else {
            $valorCanal = trim($valor, '/');
            $caminhoCanal = str_contains($valorCanal, '/') || str_starts_with($valorCanal, '@')
                ? $valorCanal
                : "@{$valorCanal}";
        }

        $partes = array_values(array_filter(explode('/', $caminhoCanal)));
        $primeiraParte = (string)($partes[0] ?? '');
        $identificadorCanal = (string)($partes[1] ?? '');
        $caminhoValido = str_starts_with($primeiraParte, '@')
            ? count($partes) === 1
                && preg_match('/^@[A-Za-z0-9._-]{3,100}$/', $primeiraParte) === 1
            : in_array(mb_strtolower($primeiraParte), ['channel', 'c', 'user'], true)
                && count($partes) === 2
                && preg_match('/^[A-Za-z0-9._-]{3,120}$/', $identificadorCanal) === 1;

        if (!$caminhoValido) {
            falharPerfilSocial($plataforma);
        }

        $urlFinal = "https://www.youtube.com/{$caminhoCanal}";
        validarPerfilSocialExiste($plataforma, $urlFinal);

        return [
            'identificador' => $caminhoCanal,
            'url' => $urlFinal,
            'ativo' => true,
        ];
    }

    falharPerfilSocial($plataforma);
}

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'PATCH');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'barbearia.visualizar' : 'barbearia.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $resultado = executarConsultaJson(
            $pdo,
            'with parametros as (
                select cast(:barbearia_id as uuid) as barbearia_id
             )
             select jsonb_build_object(
                \'barbearia\', (
                    select to_jsonb(b)
                    from (
                        select
                            id, razao_social, nome_fantasia, documento, categoria,
                            email, telefone, descricao, logo_url, cor_tema, status
                        from barbearias
                        where id = (select barbearia_id from parametros)
                        limit 1
                    ) b
                ),
                \'endereco\', (
                    select to_jsonb(e)
                    from (
                        select cep, logradouro, numero, complemento, bairro, cidade, uf, pais
                        from enderecos_barbearia
                        where barbearia_id = (select barbearia_id from parametros)
                        limit 1
                    ) e
                ),
                \'horarios\', coalesce((
                    select jsonb_agg(to_jsonb(h) order by h.dia_semana)
                    from (
                        select dia_semana, abertura, fechamento, ativo, observacao
                        from horarios_funcionamento
                        where barbearia_id = (select barbearia_id from parametros)
                    ) h
                ), \'[]\'::jsonb),
                \'redes_sociais\', coalesce((
                    select jsonb_agg(to_jsonb(r) order by r.plataforma)
                    from (
                        select plataforma, identificador, url, ativo
                        from redes_sociais
                        where barbearia_id = (select barbearia_id from parametros)
                    ) r
                ), \'[]\'::jsonb)
             )',
            ['barbearia_id' => $identificadorBarbearia]
        );
        $dadosBarbearia = $resultado['barbearia'] ?? null;

        if (!$dadosBarbearia) {
            throw new ExcecaoApi('Barbearia não encontrada.', 404, 'barbearia_nao_encontrada');
        }

        $resultado['barbearia']['documento_requer_regularizacao'] = !cnpjEhValido((string)$dadosBarbearia['documento']);
        return $resultado;
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();
    $dadosBarbearia = is_array($dados['barbearia'] ?? null) ? $dados['barbearia'] : [];
    $dadosEndereco = is_array($dados['endereco'] ?? null) ? $dados['endereco'] : [];
    $horariosRecebidos = is_array($dados['horarios'] ?? null) ? $dados['horarios'] : [];
    $redesRecebidas = is_array($dados['redes_sociais'] ?? null) ? $dados['redes_sociais'] : [];

    $nomeFantasia = exigirTexto($dadosBarbearia, 'nome_fantasia', 'nome fantasia', 160);
    $razaoSocial = textoOpcional($dadosBarbearia, 'razao_social', 180);
    $documento = textoOpcional($dadosBarbearia, 'documento', 30);
    $consultaDocumento = $pdo->prepare('select documento from barbearias where id = :id');
    $consultaDocumento->execute(['id' => $identificadorBarbearia]);
    $documentoAtual = (string)$consultaDocumento->fetchColumn();
    if (!array_key_exists('documento', $dadosBarbearia)
        || somenteDigitos((string)$documento) === somenteDigitos($documentoAtual)) {
        // Documentos históricos são preservados; não inventamos um CNPJ para a conta migrada.
        $documento = $documentoAtual;
    } else {
        if ($documento === null || !cnpjEhValido($documento)) {
            throw new ExcecaoApi('Informe um CNPJ válido.', 422, 'cnpj_invalido');
        }
        try {
            $empresa = consultarCnpjNaBrasilApi($documento);
        } catch (BrasilApiException $excecao) {
            throw new ExcecaoApi($excecao->getMessage(), $excecao->getHttpStatus(), 'consulta_cnpj_falhou');
        }
        if (strtoupper(trim((string)($empresa['descricao_situacao_cadastral'] ?? ''))) !== 'ATIVA') {
            throw new ExcecaoApi('O novo CNPJ precisa estar ativo.', 422, 'cnpj_inativo');
        }
        $documento = formatarCnpj($documento);
        $razaoSocial = trim((string)($empresa['razao_social'] ?? $razaoSocial));
    }
    $categoria = exigirTexto($dadosBarbearia, 'categoria', 'categoria', 100);
    $email = emailOpcional($dadosBarbearia);
    $telefone = textoOpcional($dadosBarbearia, 'telefone', 30);
    $descricao = textoOpcional($dadosBarbearia, 'descricao', 2000);
    $corTema = corHexOpcional($dadosBarbearia);
    $uf = textoOpcional($dadosEndereco, 'uf', 2);

    if ($uf !== null && preg_match('/^[A-Za-z]{2}$/', $uf) !== 1) {
        throw new ExcecaoApi('Informe uma UF válida com duas letras.', 422, 'uf_invalida');
    }

    $horarios = array_map(
        static fn (array $horario): array => validarHorarioFuncionamento($horario),
        array_values(array_filter($horariosRecebidos, 'is_array'))
    );

    if (count($horarios) !== 7) {
        throw new ExcecaoApi('Informe os sete dias de funcionamento.', 422, 'horarios_incompletos');
    }

    $diasInformados = array_column($horarios, 'dia_semana');
    sort($diasInformados);
    if ($diasInformados !== [0, 1, 2, 3, 4, 5, 6]) {
        throw new ExcecaoApi('Há dias repetidos ou ausentes nos horários.', 422, 'horarios_invalidos');
    }

    $pdo->beginTransaction();

    try {
        $atualizacaoBarbearia = $pdo->prepare(
            'update barbearias
             set razao_social = :razao_social,
                 nome_fantasia = :nome_fantasia,
                 documento = :documento,
                 categoria = :categoria,
                 email = :email,
                 telefone = :telefone,
                 descricao = :descricao,
                 cor_tema = coalesce(:cor_tema, cor_tema)
             where id = :id
             returning id, cor_tema'
        );
        $atualizacaoBarbearia->execute([
            'id' => $identificadorBarbearia,
            'razao_social' => $razaoSocial,
            'nome_fantasia' => $nomeFantasia,
            'documento' => $documento,
            'categoria' => $categoria,
            'email' => $email,
            'telefone' => $telefone,
            'descricao' => $descricao,
            'cor_tema' => $corTema,
        ]);

        $barbeariaAtualizada = $atualizacaoBarbearia->fetch();
        if (!$barbeariaAtualizada) {
            throw new ExcecaoApi('Barbearia não encontrada.', 404, 'barbearia_nao_encontrada');
        }

        $endereco = $pdo->prepare(
            'insert into enderecos_barbearia (
                barbearia_id, cep, logradouro, numero, complemento,
                bairro, cidade, uf, pais
             ) values (
                :barbearia_id, :cep, :logradouro, :numero, :complemento,
                :bairro, :cidade, :uf, :pais
             )
             on conflict (barbearia_id) do update set
                cep = excluded.cep,
                logradouro = excluded.logradouro,
                numero = excluded.numero,
                complemento = excluded.complemento,
                bairro = excluded.bairro,
                cidade = excluded.cidade,
                uf = excluded.uf,
                pais = excluded.pais'
        );
        $endereco->execute([
            'barbearia_id' => $identificadorBarbearia,
            'cep' => textoOpcional($dadosEndereco, 'cep', 12),
            'logradouro' => textoOpcional($dadosEndereco, 'logradouro', 180),
            'numero' => textoOpcional($dadosEndereco, 'numero', 20),
            'complemento' => textoOpcional($dadosEndereco, 'complemento', 120),
            'bairro' => textoOpcional($dadosEndereco, 'bairro', 120),
            'cidade' => textoOpcional($dadosEndereco, 'cidade', 120),
            'uf' => $uf === null ? null : mb_strtoupper($uf),
            'pais' => textoOpcional($dadosEndereco, 'pais', 80) ?? 'Brasil',
        ]);

        $gravacaoHorario = $pdo->prepare(
            'insert into horarios_funcionamento (
                barbearia_id, dia_semana, abertura, fechamento, ativo
             ) values (
                :barbearia_id, :dia_semana, :abertura, :fechamento, :ativo
             )
             on conflict (barbearia_id, dia_semana) do update set
                abertura = excluded.abertura,
                fechamento = excluded.fechamento,
                ativo = excluded.ativo'
        );
        foreach ($horarios as $horario) {
            $gravacaoHorario->execute([
                'barbearia_id' => $identificadorBarbearia,
                'dia_semana' => $horario['dia_semana'],
                'abertura' => $horario['abertura'],
                'fechamento' => $horario['fechamento'],
                'ativo' => $horario['ativo'] ? 'true' : 'false',
            ]);
        }

        $plataformasPermitidas = ['instagram', 'facebook', 'linkedin', 'youtube'];
        $gravacaoRede = $pdo->prepare(
            'insert into redes_sociais (
                barbearia_id, plataforma, identificador, url, ativo
             ) values (
                :barbearia_id, :plataforma, :identificador, :url, :ativo
             )
             on conflict (barbearia_id, plataforma) do update set
                identificador = excluded.identificador,
                url = excluded.url,
                ativo = excluded.ativo'
        );

        foreach ($redesRecebidas as $rede) {
            if (!is_array($rede)) {
                continue;
            }

            $plataforma = exigirOpcao(
                $rede,
                'plataforma',
                'plataforma',
                $plataformasPermitidas
            );
            $redeNormalizada = normalizarRedeSocial(
                $plataforma,
                textoOpcional($rede, 'identificador', 255),
                textoOpcional($rede, 'url', 2048)
            );
            $gravacaoRede->execute([
                'barbearia_id' => $identificadorBarbearia,
                'plataforma' => $plataforma,
                'identificador' => $redeNormalizada['identificador'],
                'url' => $redeNormalizada['url'],
                'ativo' => $redeNormalizada['ativo'] ? 'true' : 'false',
            ]);
        }

        $pdo->commit();
        $corTemaAtual = (string)$barbeariaAtualizada['cor_tema'];

        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        $_SESSION['barbearia_nome'] = $nomeFantasia;
        $_SESSION['barbearia_cor_tema'] = $corTemaAtual;
        session_write_close();

        return [
            'id' => $identificadorBarbearia,
            'nome_fantasia' => $nomeFantasia,
            'cor_tema' => $corTemaAtual,
        ];
    } catch (Throwable $excecao) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $excecao;
    }
});
