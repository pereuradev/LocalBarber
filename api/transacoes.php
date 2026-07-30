<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

function periodoTransacoes(string $periodo): array
{
    return match ($periodo) {
        'hoje' => ['current_date', 'current_date + interval \'1 day\''],
        'semana' => ['current_date - interval \'6 days\'', 'current_date + interval \'1 day\''],
        'mes' => ['date_trunc(\'month\', current_date)', 'date_trunc(\'month\', current_date) + interval \'1 month\''],
        default => ['timestamp \'1970-01-01\'', 'timestamp \'9999-12-31\''],
    };
}

function validarRelacaoFinanceira(
    PDO $pdo,
    string $tabela,
    ?string $identificador,
    string $identificadorBarbearia
): ?string {
    if ($identificador === null || $identificador === '') {
        return null;
    }

    if (!identificadorUuidValido($identificador)) {
        throw new ExcecaoApi('Seleção inválida.', 422, 'relacao_invalida');
    }

    $tabelasPermitidas = ['clientes', 'servicos', 'funcionarios'];
    if (!in_array($tabela, $tabelasPermitidas, true)) {
        throw new LogicException('Tabela não permitida.');
    }

    $consulta = $pdo->prepare(
        "select id from {$tabela}
         where id = :id and barbearia_id = :barbearia_id
         limit 1"
    );
    $consulta->execute([
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
    ]);

    if (!$consulta->fetchColumn()) {
        throw new ExcecaoApi('O registro selecionado não pertence a esta barbearia.', 422, 'relacao_invalida');
    }

    return $identificador;
}

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'POST', 'PATCH', 'DELETE');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'financeiro.visualizar' : 'financeiro.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $busca = parametroConsulta('busca');
        $metodoPagamento = parametroConsulta('metodo');
        $situacao = parametroConsulta('situacao');
        $periodo = parametroConsulta('periodo') ?: 'hoje';
        [$inicioSql, $fimSql] = periodoTransacoes($periodo);
        $termo = '%' . mb_strtolower($busca) . '%';

        return executarConsultaJson(
            $pdo,
            "with parametros as (
                select
                    cast(:barbearia_id as uuid) as barbearia_id,
                    cast(:busca as text) as busca,
                    cast(:termo as text) as termo,
                    cast(:metodo as text) as metodo,
                    cast(:situacao as text) as situacao
             ),
             transacoes_filtradas as (
                select
                    t.id, t.codigo, t.cliente_id, t.servico_id, t.funcionario_id,
                    t.tipo, t.descricao, t.metodo_pagamento,
                    t.valor, t.status, t.data_transacao, t.observacoes,
                    c.nome as cliente, s.nome as servico, f.nome as funcionario
                from transacoes t
                cross join parametros p
                left join clientes c
                  on c.id = t.cliente_id and c.barbearia_id = t.barbearia_id
                left join servicos s
                  on s.id = t.servico_id and s.barbearia_id = t.barbearia_id
                left join funcionarios f
                  on f.id = t.funcionario_id and f.barbearia_id = t.barbearia_id
                where t.barbearia_id = p.barbearia_id
                  and t.data_transacao >= {$inicioSql}
                  and t.data_transacao < {$fimSql}
                  and (
                    p.busca = ''
                    or lower(t.descricao) like p.termo
                    or lower(coalesce(c.nome, '')) like p.termo
                    or lower(coalesce(s.nome, '')) like p.termo
                  )
                  and (p.metodo = '' or t.metodo_pagamento = p.metodo)
                  and (p.situacao = '' or t.status = p.situacao)
                order by t.data_transacao desc, t.id desc
                limit 250
             ),
             resumo as (
                select
                    coalesce(sum(t.valor) filter (
                        where t.tipo = 'entrada' and t.status = 'concluido'
                    ), 0) as entradas,
                    coalesce(sum(t.valor) filter (
                        where t.tipo = 'saida' and t.status = 'concluido'
                    ), 0) as saidas,
                    coalesce(sum(
                        case when t.status = 'concluido'
                            then case when t.tipo = 'entrada' then t.valor else -t.valor end
                            else 0
                        end
                    ), 0) as saldo,
                    count(*) as total
                from transacoes t
                cross join parametros p
                where t.barbearia_id = p.barbearia_id
                  and t.data_transacao >= {$inicioSql}
                  and t.data_transacao < {$fimSql}
             ),
             clientes_ativos as (
                select c.id, c.nome
                from clientes c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id and c.ativo
                order by c.nome
                limit 500
             ),
             servicos_ativos as (
                select s.id, s.nome
                from servicos s
                cross join parametros p
                where s.barbearia_id = p.barbearia_id and s.ativo
             ),
             funcionarios_ativos as (
                select f.id, f.nome
                from funcionarios f
                cross join parametros p
                where f.barbearia_id = p.barbearia_id and f.ativo
             )
             select jsonb_build_object(
                'transacoes', coalesce((
                    select jsonb_agg(to_jsonb(t) order by t.data_transacao desc, t.id desc)
                    from transacoes_filtradas t
                ), '[]'::jsonb),
                'resumo', (select to_jsonb(r) from resumo r),
                'clientes', coalesce((
                    select jsonb_agg(to_jsonb(c) order by c.nome)
                    from clientes_ativos c
                ), '[]'::jsonb),
                'servicos', coalesce((
                    select jsonb_agg(to_jsonb(s) order by s.nome)
                    from servicos_ativos s
                ), '[]'::jsonb),
                'funcionarios', coalesce((
                    select jsonb_agg(to_jsonb(f) order by f.nome)
                    from funcionarios_ativos f
                ), '[]'::jsonb)
             )",
            [
                'barbearia_id' => $identificadorBarbearia,
                'busca' => $busca,
                'termo' => $termo,
                'metodo' => $metodoPagamento,
                'situacao' => $situacao,
            ]
        );
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();
    $identificador = $metodo === 'POST' ? null : exigirUuid($dados);

    if ($metodo === 'DELETE') {
        $cancelamento = $pdo->prepare(
            'update transacoes
             set status = \'cancelado\'
             where id = :id and barbearia_id = :barbearia_id
             returning id'
        );
        $cancelamento->execute([
            'id' => $identificador,
            'barbearia_id' => $identificadorBarbearia,
        ]);

        if (!$cancelamento->fetch()) {
            throw new ExcecaoApi('Transação não encontrada.', 404, 'transacao_nao_encontrada');
        }

        return ['id' => $identificador, 'status' => 'cancelado'];
    }

    if ($metodo === 'PATCH' && count($dados) <= 2 && isset($dados['status'])) {
        $situacao = exigirOpcao(
            $dados,
            'status',
            'status',
            ['pendente', 'confirmado', 'concluido', 'cancelado']
        );
        $atualizacao = $pdo->prepare(
            'update transacoes
             set status = :status
             where id = :id and barbearia_id = :barbearia_id
             returning id'
        );
        $atualizacao->execute([
            'id' => $identificador,
            'barbearia_id' => $identificadorBarbearia,
            'status' => $situacao,
        ]);

        if (!$atualizacao->fetch()) {
            throw new ExcecaoApi('Transação não encontrada.', 404, 'transacao_nao_encontrada');
        }

        return ['id' => $identificador, 'status' => $situacao];
    }

    $tipo = exigirOpcao($dados, 'tipo', 'tipo', ['entrada', 'saida']);
    $descricao = exigirTexto($dados, 'descricao', 'descrição', 255);
    $metodoPagamento = exigirOpcao(
        $dados,
        'metodo_pagamento',
        'método de pagamento',
        ['pix', 'credito', 'debito', 'dinheiro', 'outro']
    );
    $valor = numeroDecimal($dados, 'valor', 'valor', 0.01, 100000000);
    $situacao = exigirOpcao(
        $dados,
        'status',
        'status',
        ['pendente', 'confirmado', 'concluido', 'cancelado']
    );
    $dataTransacao = exigirTexto($dados, 'data_transacao', 'data', 16);
    $objetoData = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $dataTransacao);

    if ($objetoData === false || $objetoData->format('Y-m-d\TH:i') !== $dataTransacao) {
        throw new ExcecaoApi('Informe uma data válida.', 422, 'data_invalida');
    }

    $identificadorCliente = validarRelacaoFinanceira(
        $pdo,
        'clientes',
        textoOpcional($dados, 'cliente_id', 36),
        $identificadorBarbearia
    );
    $identificadorServico = validarRelacaoFinanceira(
        $pdo,
        'servicos',
        textoOpcional($dados, 'servico_id', 36),
        $identificadorBarbearia
    );
    $identificadorFuncionario = validarRelacaoFinanceira(
        $pdo,
        'funcionarios',
        textoOpcional($dados, 'funcionario_id', 36),
        $identificadorBarbearia
    );
    $observacoes = textoOpcional($dados, 'observacoes', 1500);

    if ($metodo === 'POST') {
        $gravacao = $pdo->prepare(
            'insert into transacoes (
                barbearia_id, codigo, cliente_id, servico_id, funcionario_id,
                tipo, descricao, metodo_pagamento, valor, status,
                data_transacao, observacoes
             ) values (
                :barbearia_id,
                concat(\'TX-\', upper(substr(replace(gen_random_uuid()::text, \'-\', \'\'), 1, 8))),
                :cliente_id, :servico_id, :funcionario_id,
                :tipo, :descricao, :metodo_pagamento, :valor, :status,
                :data_transacao, :observacoes
             )
             returning id, codigo'
        );
        $parametros = [];
    } else {
        $gravacao = $pdo->prepare(
            'update transacoes
             set cliente_id = :cliente_id,
                 servico_id = :servico_id,
                 funcionario_id = :funcionario_id,
                 tipo = :tipo,
                 descricao = :descricao,
                 metodo_pagamento = :metodo_pagamento,
                 valor = :valor,
                 status = :status,
                 data_transacao = :data_transacao,
                 observacoes = :observacoes
             where id = :id and barbearia_id = :barbearia_id
             returning id, codigo'
        );
        $parametros = ['id' => $identificador];
    }

    $gravacao->execute(array_merge($parametros, [
        'barbearia_id' => $identificadorBarbearia,
        'cliente_id' => $identificadorCliente,
        'servico_id' => $identificadorServico,
        'funcionario_id' => $identificadorFuncionario,
        'tipo' => $tipo,
        'descricao' => $descricao,
        'metodo_pagamento' => $metodoPagamento,
        'valor' => $valor,
        'status' => $situacao,
        'data_transacao' => $objetoData->format('Y-m-d H:i:s'),
        'observacoes' => $observacoes,
    ]));
    $transacao = $gravacao->fetch();

    if (!$transacao) {
        throw new ExcecaoApi('Transação não encontrada.', 404, 'transacao_nao_encontrada');
    }

    return ['transacao' => $transacao];
});
