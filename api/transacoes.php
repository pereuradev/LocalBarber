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

function obterAgendamentoPendentePagamento(
    PDO $pdo,
    string $identificador,
    string $identificadorBarbearia,
    string $chaveIdempotencia
): array {
    $consulta = $pdo->prepare(
        'select a.id, a.codigo, a.cliente_id, a.servico_id, a.funcionario_id,
                a.nome_cliente_snapshot, a.servico_snapshot, a.valor_previsto
         from agendamentos a
         where a.id = :id
           and a.barbearia_id = :barbearia_id
           and a.status <> \'cancelado\'
           and not exists (
               select 1
               from transacoes t
               where t.barbearia_id = a.barbearia_id
                 and t.agendamento_id = a.id
                 and t.status <> \'cancelado\'
                 and t.chave_idempotencia is distinct from cast(:chave_idempotencia as uuid)
           )
         limit 1'
    );
    $consulta->execute([
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
        'chave_idempotencia' => $chaveIdempotencia,
    ]);
    $agendamento = $consulta->fetch();

    if (!$agendamento) {
        throw new ExcecaoApi(
            'Selecione um agendamento existente que ainda não possua pagamento.',
            422,
            'agendamento_indisponivel_pagamento'
        );
    }

    return $agendamento;
}

function obterVinculosAgendamentoDaTransacao(
    PDO $pdo,
    string $identificador,
    string $identificadorBarbearia
): ?array {
    $consulta = $pdo->prepare(
        'select t.agendamento_id, a.cliente_id, a.servico_id, a.funcionario_id
         from transacoes t
         left join agendamentos a
           on a.id = t.agendamento_id and a.barbearia_id = t.barbearia_id
         where t.id = :id and t.barbearia_id = :barbearia_id
         limit 1'
    );
    $consulta->execute([
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
    ]);
    $transacao = $consulta->fetch();

    if (!$transacao) {
        throw new ExcecaoApi('TransaÃ§Ã£o nÃ£o encontrada.', 404, 'transacao_nao_encontrada');
    }

    if (empty($transacao['agendamento_id'])) {
        return null;
    }

    return [
        'cliente_id' => $transacao['cliente_id'],
        'servico_id' => $transacao['servico_id'],
        'funcionario_id' => $transacao['funcionario_id'],
    ];
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
        $paginacao = parametrosPaginacao();
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
                    t.id, t.codigo, t.agendamento_id, t.cliente_id, t.servico_id, t.funcionario_id,
                    t.tipo, t.descricao, t.metodo_pagamento,
                    t.valor, t.status, t.data_transacao, t.observacoes,
                    c.nome as cliente, s.nome as servico, f.nome as funcionario,
                    a.codigo as agendamento_codigo
                from transacoes t
                cross join parametros p
                left join clientes c
                  on c.id = t.cliente_id and c.barbearia_id = t.barbearia_id
                left join servicos s
                  on s.id = t.servico_id and s.barbearia_id = t.barbearia_id
                left join funcionarios f
                  on f.id = t.funcionario_id and f.barbearia_id = t.barbearia_id
                left join agendamentos a
                  on a.id = t.agendamento_id and a.barbearia_id = t.barbearia_id
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
             ),
             transacoes_pagina as (
                 select * from transacoes_filtradas order by data_transacao desc, id desc limit :limite offset :deslocamento
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
                limit 50
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
             ),
             agendamentos_pendentes as (
                select
                    a.id, a.codigo, a.cliente_id, a.servico_id, a.funcionario_id,
                    a.nome_cliente_snapshot as cliente,
                    a.servico_snapshot as servico,
                    a.data_agendamento, a.horario_inicio, a.valor_previsto,
                    f.nome as funcionario
                from agendamentos a
                cross join parametros p
                left join funcionarios f
                  on f.id = a.funcionario_id and f.barbearia_id = a.barbearia_id
                where a.barbearia_id = p.barbearia_id
                  and a.status <> 'cancelado'
                  and not exists (
                      select 1
                      from transacoes t
                      where t.barbearia_id = a.barbearia_id
                        and t.agendamento_id = a.id
                        and t.status <> 'cancelado'
                  )
                order by a.data_agendamento desc, a.horario_inicio desc
                limit 200
             )
             select jsonb_build_object(
                'paginacao', jsonb_build_object(
                    'pagina', cast(:pagina as int),
                    'por_pagina', cast(:tamanho_pagina as int),
                    'total', (select count(*) from transacoes_filtradas)
                ),
                'transacoes', coalesce((
                    select jsonb_agg(to_jsonb(t) order by t.data_transacao desc, t.id desc)
                    from transacoes_pagina t
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
                ), '[]'::jsonb),
                'agendamentos_pendentes', coalesce((
                    select jsonb_agg(
                        to_jsonb(a) order by a.data_agendamento desc, a.horario_inicio desc
                    )
                    from agendamentos_pendentes a
                ), '[]'::jsonb)
             )",
            [
                'barbearia_id' => $identificadorBarbearia,
                'pagina' => $paginacao['pagina'],
                'tamanho_pagina' => $paginacao['tamanho_pagina'],
                'limite' => $paginacao['limite'],
                'deslocamento' => $paginacao['deslocamento'],
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

    $tipo = $metodo === 'POST'
        ? 'entrada'
        : exigirOpcao($dados, 'tipo', 'tipo', ['entrada', 'saida']);
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
    if ($metodo === 'POST' && $situacao === 'cancelado') {
        throw new ExcecaoApi(
            'Uma nova transação não pode ser cadastrada como cancelada.',
            422,
            'status_invalido'
        );
    }
    $dataTransacao = exigirTexto($dados, 'data_transacao', 'data', 16);
    $objetoData = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $dataTransacao, new DateTimeZone('America/Sao_Paulo'));

    if ($objetoData === false || $objetoData->format('Y-m-d\TH:i') !== $dataTransacao) {
        throw new ExcecaoApi('Informe uma data válida.', 422, 'data_invalida');
    }

    $identificadorAgendamento = null;
    $chaveIdempotencia = '';
    if ($metodo === 'POST') {
        $chaveIdempotencia = trim((string)($_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? ''));
        if (!identificadorUuidValido($chaveIdempotencia)) {
            throw new ExcecaoApi('Atualize a página antes de registrar uma transação.', 422, 'idempotencia_obrigatoria');
        }
    }
    if ($metodo === 'POST') {
        $identificadorAgendamento = exigirUuid($dados, 'agendamento_id');
        $agendamento = obterAgendamentoPendentePagamento(
            $pdo,
            $identificadorAgendamento,
            $identificadorBarbearia,
            $chaveIdempotencia
        );
        $identificadorCliente = $agendamento['cliente_id'];
        $identificadorServico = $agendamento['servico_id'];
        $identificadorFuncionario = $agendamento['funcionario_id'];
    } else {
        $vinculosAgendamento = obterVinculosAgendamentoDaTransacao(
            $pdo,
            $identificador,
            $identificadorBarbearia
        );

        if ($vinculosAgendamento !== null) {
            // Um pagamento vinculado sempre conserva as entidades do agendamento original.
            $identificadorCliente = $vinculosAgendamento['cliente_id'];
            $identificadorServico = $vinculosAgendamento['servico_id'];
            $identificadorFuncionario = $vinculosAgendamento['funcionario_id'];
        } else {
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
        }
    }
    $observacoes = textoOpcional($dados, 'observacoes', 1500);

    $dadosGravacao = [
        'barbearia_id' => $identificadorBarbearia,
        'cliente_id' => $identificadorCliente,
        'servico_id' => $identificadorServico,
        'funcionario_id' => $identificadorFuncionario,
        'tipo' => $tipo,
        'descricao' => $descricao,
        'metodo_pagamento' => $metodoPagamento,
        'valor' => $valor,
        'status' => $situacao,
        'data_transacao' => $objetoData->format('Y-m-d H:i:sP'),
        'observacoes' => $observacoes,
    ];
    $hashRequisicao = '';

    if ($metodo === 'POST') {
        $hashRequisicao = hash('sha256', $sessao['usuario_id'] . json_encode(
            array_merge($dadosGravacao, ['agendamento_id' => $identificadorAgendamento]),
            JSON_UNESCAPED_UNICODE
        ));
        $gravacao = $pdo->prepare(
            'insert into transacoes (
                barbearia_id, codigo, agendamento_id, cliente_id, servico_id, funcionario_id,
                tipo, descricao, metodo_pagamento, valor, status,
                data_transacao, observacoes, chave_idempotencia, requisicao_hash
             ) values (
                :barbearia_id,
                concat(\'TX-\', upper(substr(replace(gen_random_uuid()::text, \'-\', \'\'), 1, 8))),
                :agendamento_id, :cliente_id, :servico_id, :funcionario_id,
                :tipo, :descricao, :metodo_pagamento, :valor, :status,
                :data_transacao, :observacoes, :chave_idempotencia, :requisicao_hash
             )
             on conflict (barbearia_id, chave_idempotencia) where chave_idempotencia is not null do nothing
             returning id, codigo'
        );
        $parametros = [
            'agendamento_id' => $identificadorAgendamento,
            'chave_idempotencia' => $chaveIdempotencia,
            'requisicao_hash' => $hashRequisicao,
        ];
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

    $gravacao->execute(array_merge($parametros, $dadosGravacao));
    $transacao = $gravacao->fetch();

    if (!$transacao && $metodo === 'POST') {
        $consultaAnterior = $pdo->prepare(
            'select id, codigo, requisicao_hash from transacoes
             where barbearia_id = :barbearia_id and chave_idempotencia = :chave'
        );
        $consultaAnterior->execute(['barbearia_id' => $identificadorBarbearia, 'chave' => $chaveIdempotencia]);
        $transacao = $consultaAnterior->fetch();
        if (!$transacao || !hash_equals((string)$transacao['requisicao_hash'], $hashRequisicao)) {
            throw new ExcecaoApi('Esta solicitação já foi usada com outros dados.', 409, 'idempotencia_conflitante');
        }
        unset($transacao['requisicao_hash']);
    }
    if (!$transacao) {
        throw new ExcecaoApi('Transação não encontrada.', 404, 'transacao_nao_encontrada');
    }

    return ['transacao' => $transacao];
});
