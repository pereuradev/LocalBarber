<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

executarApi(static function () use ($pdo): array {
    exigirMetodo('GET');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao($sessao, 'dashboard.visualizar');
    $identificadorBarbearia = $sessao['barbearia_id'];

    return executarConsultaJson(
        $pdo,
        'with parametros as (
            select cast(:barbearia_id as uuid) as barbearia_id
         ),
         resumo as (
            select
                (select count(*) from agendamentos a
                 where a.barbearia_id = p.barbearia_id
                   and a.data_agendamento = current_date
                   and a.status <> \'cancelado\') as agendamentos_hoje,
                (select coalesce(sum(t.valor), 0) from transacoes t
                 where t.barbearia_id = p.barbearia_id
                   and t.tipo = \'entrada\' and t.status = \'concluido\'
                   and (t.data_transacao at time zone \'America/Sao_Paulo\')::date = current_date)
                    as faturamento_hoje,
                (select count(*) from clientes c
                 where c.barbearia_id = p.barbearia_id and c.ativo) as clientes_ativos,
                (select count(*) from agendamentos a
                 where a.barbearia_id = p.barbearia_id
                   and a.data_agendamento >= current_date
                   and a.status = \'pendente\') as pendentes
            from parametros p
         ),
         agendamentos_dashboard as (
            select
                a.id, a.nome_cliente_snapshot as cliente, a.servico_snapshot as servico,
                a.horario_inicio, a.status, f.nome as funcionario
            from agendamentos a
            cross join parametros p
            left join funcionarios f
              on f.id = a.funcionario_id and f.barbearia_id = a.barbearia_id
            where a.barbearia_id = p.barbearia_id
              and a.data_agendamento = current_date
              and a.status <> \'cancelado\'
            order by a.horario_inicio
            limit 8
         ),
         dias as (
            select generate_series(
                current_date - interval \'6 days\',
                current_date,
                interval \'1 day\'
            )::date as data
         ),
         faturamento_dashboard as (
            select
                d.data,
                coalesce(sum(t.valor) filter (
                    where t.tipo = \'entrada\' and t.status = \'concluido\'
                ), 0) as valor
            from dias d
            cross join parametros p
            left join transacoes t
              on (t.data_transacao at time zone \'America/Sao_Paulo\')::date = d.data
             and t.barbearia_id = p.barbearia_id
            group by d.data
         ),
         transacoes_dashboard as (
            select t.id, t.tipo, t.descricao, t.valor, t.status, t.data_transacao
            from transacoes t
            cross join parametros p
            where t.barbearia_id = p.barbearia_id
            order by t.data_transacao desc
            limit 6
         ),
         equipe_dashboard as (
            select f.id, f.nome, f.funcao, f.status
            from funcionarios f
            cross join parametros p
            where f.barbearia_id = p.barbearia_id and f.ativo
            order by f.nome
            limit 6
         )
         select jsonb_build_object(
            \'resumo\', (select to_jsonb(r) from resumo r),
            \'agendamentos\', coalesce((
                select jsonb_agg(to_jsonb(a) order by a.horario_inicio)
                from agendamentos_dashboard a
            ), \'[]\'::jsonb),
            \'faturamento\', coalesce((
                select jsonb_agg(to_jsonb(f) order by f.data)
                from faturamento_dashboard f
            ), \'[]\'::jsonb),
            \'transacoes\', coalesce((
                select jsonb_agg(to_jsonb(t) order by t.data_transacao desc)
                from transacoes_dashboard t
            ), \'[]\'::jsonb),
            \'equipe\', coalesce((
                select jsonb_agg(to_jsonb(e) order by e.nome)
                from equipe_dashboard e
            ), \'[]\'::jsonb)
         )',
        ['barbearia_id' => $identificadorBarbearia]
    );
});
