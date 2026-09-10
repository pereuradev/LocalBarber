<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

function obterCategoriaServico(
    PDO $pdo,
    string $identificadorBarbearia,
    ?string $nomeCategoria
): ?string {
    if ($nomeCategoria === null) {
        return null;
    }

    $consulta = $pdo->prepare(
        'insert into categorias_servico (barbearia_id, nome)
         values (:barbearia_id, :nome)
         on conflict (barbearia_id, nome)
         do update set ativo = true
         returning id'
    );
    $consulta->execute([
        'barbearia_id' => $identificadorBarbearia,
        'nome' => $nomeCategoria,
    ]);

    return (string)$consulta->fetchColumn();
}

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'POST', 'PATCH', 'DELETE');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'servicos.visualizar' : 'servicos.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $paginacao = parametrosPaginacao();
        $busca = parametroConsulta('busca');
        $categoria = parametroConsulta('categoria');
        $termo = '%' . mb_strtolower($busca) . '%';

        return executarConsultaJson(
            $pdo,
            'with parametros as (
                select
                    cast(:barbearia_id as uuid) as barbearia_id,
                    cast(:busca as text) as busca,
                    cast(:termo as text) as termo,
                    cast(:categoria as text) as categoria
             ),
             servicos_filtrados as (
                select
                    s.id, s.nome, s.descricao, s.preco, s.duracao_minutos,
                    s.comissao_percentual, s.imagem_url, s.ativo,
                    s.total_atendimentos, s.avaliacao_media,
                    c.nome as categoria
                from servicos s
                cross join parametros p
                left join categorias_servico c
                  on c.id = s.categoria_id and c.barbearia_id = s.barbearia_id
                where s.barbearia_id = p.barbearia_id
                  and (p.busca = \'\' or lower(s.nome) like p.termo)
                  and (p.categoria = \'\' or c.nome = p.categoria)
                order by s.ativo desc, s.nome
             ),
             servicos_pagina as (
                 select * from servicos_filtrados order by ativo desc, nome, id limit :limite offset :deslocamento
             ),
             categorias_ativas as (
                select c.id, c.nome
                from categorias_servico c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id and c.ativo
             ),
             resumo as (
                select
                    count(*) as total,
                    count(*) filter (where s.ativo) as ativos,
                    coalesce(round(avg(s.duracao_minutos)), 0) as duracao_media,
                    coalesce(round(avg(s.preco), 2), 0) as preco_medio
                from servicos s
                cross join parametros p
                where s.barbearia_id = p.barbearia_id
             )
             select jsonb_build_object(
                \'paginacao\', jsonb_build_object(
                    \'pagina\', cast(:pagina as int),
                    \'por_pagina\', cast(:tamanho_pagina as int),
                    \'total\', (select count(*) from servicos_filtrados)
                ),
                \'servicos\', coalesce((
                    select jsonb_agg(to_jsonb(s) order by s.ativo desc, s.nome)
                    from servicos_pagina s
                ), \'[]\'::jsonb),
                \'categorias\', coalesce((
                    select jsonb_agg(to_jsonb(c) order by c.nome)
                    from categorias_ativas c
                ), \'[]\'::jsonb),
                \'resumo\', (select to_jsonb(r) from resumo r)
             )',
            [
                'barbearia_id' => $identificadorBarbearia,
                'pagina' => $paginacao['pagina'],
                'tamanho_pagina' => $paginacao['tamanho_pagina'],
                'limite' => $paginacao['limite'],
                'deslocamento' => $paginacao['deslocamento'],
                'busca' => $busca,
                'termo' => $termo,
                'categoria' => $categoria,
            ]
        );
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();

    if ($metodo === 'DELETE') {
        $identificador = exigirUuid($dados);
        $desativacao = $pdo->prepare(
            'update servicos
             set ativo = false
             where id = :id and barbearia_id = :barbearia_id
             returning id'
        );
        $desativacao->execute([
            'id' => $identificador,
            'barbearia_id' => $identificadorBarbearia,
        ]);

        if (!$desativacao->fetch()) {
            throw new ExcecaoApi('Serviço não encontrado.', 404, 'servico_nao_encontrado');
        }

        return ['id' => $identificador, 'ativo' => false];
    }

    $nome = exigirTexto($dados, 'nome', 'nome', 160);
    $descricao = textoOpcional($dados, 'descricao', 1500);
    $preco = numeroDecimal($dados, 'preco', 'preço', 0, 1000000);
    $duracao = numeroInteiro($dados, 'duracao_minutos', 'duração', 5, 1440);
    $comissao = numeroDecimal($dados, 'comissao_percentual', 'comissão', 0, 100);
    $imagem = urlOpcional($dados, 'imagem_url');
    $categoria = textoOpcional($dados, 'categoria', 100);
    $ativo = valorBooleano($dados['ativo'] ?? null);

    $pdo->beginTransaction();

    try {
        $identificadorCategoria = obterCategoriaServico(
            $pdo,
            $identificadorBarbearia,
            $categoria
        );

        if ($metodo === 'POST') {
            $gravacao = $pdo->prepare(
                'insert into servicos (
                    barbearia_id, categoria_id, nome, descricao, preco,
                    duracao_minutos, comissao_percentual, imagem_url, ativo
                 ) values (
                    :barbearia_id, :categoria_id, :nome, :descricao, :preco,
                    :duracao_minutos, :comissao_percentual, :imagem_url, :ativo
                 )
                 returning id'
            );
            $parametros = [];
        } else {
            $identificador = exigirUuid($dados);
            $gravacao = $pdo->prepare(
                'update servicos
                 set categoria_id = :categoria_id,
                     nome = :nome,
                     descricao = :descricao,
                     preco = :preco,
                     duracao_minutos = :duracao_minutos,
                     comissao_percentual = :comissao_percentual,
                     imagem_url = :imagem_url,
                     ativo = :ativo
                 where id = :id and barbearia_id = :barbearia_id
                 returning id'
            );
            $parametros = ['id' => $identificador];
        }

        $gravacao->execute(array_merge($parametros, [
            'barbearia_id' => $identificadorBarbearia,
            'categoria_id' => $identificadorCategoria,
            'nome' => $nome,
            'descricao' => $descricao,
            'preco' => $preco,
            'duracao_minutos' => $duracao,
            'comissao_percentual' => $comissao,
            'imagem_url' => $imagem,
            'ativo' => $ativo ? 'true' : 'false',
        ]));
        $identificadorServico = $gravacao->fetchColumn();

        if ($identificadorServico === false) {
            throw new ExcecaoApi('Serviço não encontrado.', 404, 'servico_nao_encontrado');
        }

        $pdo->commit();
        return ['id' => $identificadorServico];
    } catch (Throwable $excecao) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $excecao;
    }
});
