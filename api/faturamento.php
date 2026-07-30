<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

executarApi(static function () use ($pdo): array {
    exigirMetodo('GET');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao($sessao, 'financeiro.visualizar');
    $identificadorBarbearia = $sessao['barbearia_id'];
    $inicio = parametroConsulta('inicio', 10);
    $fim = parametroConsulta('fim', 10);

    if (!dataIsoValida($inicio) || !dataIsoValida($fim)) {
        throw new ExcecaoApi('Informe um período válido.', 422, 'periodo_invalido');
    }

    $dataInicio = new DateTimeImmutable($inicio);
    $dataFim = new DateTimeImmutable($fim);
    if ($dataFim < $dataInicio || $dataInicio->diff($dataFim)->days > 730) {
        throw new ExcecaoApi('O relatório aceita um período de até dois anos.', 422, 'periodo_invalido');
    }

    $fimExclusivo = $dataFim->modify('+1 day')->format('Y-m-d');

    return executarConsultaJson(
        $pdo,
        'with parametros as (
            select
                cast(:barbearia_id as uuid) as barbearia_id,
                cast(:inicio as date) as inicio,
                cast(:fim as date) as fim
         ),
         resumo as (
            select
                coalesce(sum(t.valor) filter (
                    where t.tipo = \'entrada\' and t.status = \'concluido\'
                ), 0) as faturamento,
                coalesce(sum(t.valor) filter (
                    where t.tipo = \'saida\' and t.status = \'concluido\'
                ), 0) as despesas,
                coalesce(sum(
                    case when t.status = \'concluido\'
                        then case when t.tipo = \'entrada\' then t.valor else -t.valor end
                        else 0
                    end
                ), 0) as saldo,
                count(*) filter (where t.status = \'concluido\') as transacoes_concluidas,
                coalesce(avg(t.valor) filter (
                    where t.tipo = \'entrada\' and t.status = \'concluido\'
                ), 0) as ticket_medio
            from transacoes t
            cross join parametros p
            where t.barbearia_id = p.barbearia_id
              and t.data_transacao >= p.inicio
              and t.data_transacao < p.fim
         ),
         dias as (
            select generate_series(p.inicio, p.fim - 1, interval \'1 day\')::date as data
            from parametros p
         ),
         serie as (
            select
                d.data,
                coalesce(sum(t.valor) filter (
                    where t.tipo = \'entrada\' and t.status = \'concluido\'
                ), 0) as entradas,
                coalesce(sum(t.valor) filter (
                    where t.tipo = \'saida\' and t.status = \'concluido\'
                ), 0) as saidas
            from dias d
            cross join parametros p
            left join transacoes t
              on (t.data_transacao at time zone \'America/Sao_Paulo\')::date = d.data
             and t.barbearia_id = p.barbearia_id
            group by d.data
         ),
         metodos as (
            select
                t.metodo_pagamento,
                count(*) as quantidade,
                coalesce(sum(t.valor), 0) as valor
            from transacoes t
            cross join parametros p
            where t.barbearia_id = p.barbearia_id
              and t.tipo = \'entrada\' and t.status = \'concluido\'
              and t.data_transacao >= p.inicio and t.data_transacao < p.fim
            group by t.metodo_pagamento
         ),
         servicos_relatorio as (
            select
                coalesce(s.nome, t.descricao) as nome,
                count(*) as quantidade,
                coalesce(sum(t.valor), 0) as valor
            from transacoes t
            cross join parametros p
            left join servicos s
              on s.id = t.servico_id and s.barbearia_id = t.barbearia_id
            where t.barbearia_id = p.barbearia_id
              and t.tipo = \'entrada\' and t.status = \'concluido\'
              and t.data_transacao >= p.inicio and t.data_transacao < p.fim
            group by coalesce(s.nome, t.descricao)
            order by valor desc
            limit 8
         )
         select jsonb_build_object(
            \'resumo\', (select to_jsonb(r) from resumo r),
            \'serie\', coalesce((
                select jsonb_agg(to_jsonb(s) order by s.data) from serie s
            ), \'[]\'::jsonb),
            \'metodos\', coalesce((
                select jsonb_agg(to_jsonb(m) order by m.valor desc) from metodos m
            ), \'[]\'::jsonb),
            \'servicos\', coalesce((
                select jsonb_agg(to_jsonb(s) order by s.valor desc)
                from servicos_relatorio s
            ), \'[]\'::jsonb)
         )',
        [
            'barbearia_id' => $identificadorBarbearia,
            'inicio' => $inicio,
            'fim' => $fimExclusivo,
        ]
    );
});
