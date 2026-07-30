<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

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

        $plataformasPermitidas = ['instagram', 'facebook', 'whatsapp', 'site'];
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
            $identificador = textoOpcional($rede, 'identificador', 255);
            $url = urlOpcional($rede, 'url');
            $gravacaoRede->execute([
                'barbearia_id' => $identificadorBarbearia,
                'plataforma' => $plataforma,
                'identificador' => $identificador,
                'url' => $url,
                'ativo' => ($identificador !== null || $url !== null) ? 'true' : 'false',
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
