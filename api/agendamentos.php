<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';
require_once __DIR__ . '/../config/agendamento.php';

function obterEntidadeDaBarbearia(
    PDO $pdo,
    string $tabela,
    string $identificador,
    string $identificadorBarbearia
): array {
    $tabelasPermitidas = ['clientes', 'servicos', 'funcionarios'];

    if (!in_array($tabela, $tabelasPermitidas, true)) {
        throw new LogicException('Tabela não permitida.');
    }

    $consulta = $pdo->prepare(
        "select * from {$tabela}
         where id = :id and barbearia_id = :barbearia_id and ativo
         limit 1"
    );
    $consulta->execute([
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
    ]);
    $registro = $consulta->fetch();

    if (!$registro) {
        throw new ExcecaoApi('Um dos registros selecionados não existe ou está inativo.', 422, 'relacao_invalida');
    }

    return $registro;
}

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'POST', 'PATCH', 'DELETE');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'agenda.visualizar' : 'agenda.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $inicio = parametroConsulta('inicio', 10);
        $fim = parametroConsulta('fim', 10);

        if (!dataIsoValida($inicio) || !dataIsoValida($fim)) {
            throw new ExcecaoApi('Informe um período válido.', 422, 'periodo_invalido');
        }

        $dataInicio = new DateTimeImmutable($inicio);
        $dataFim = new DateTimeImmutable($fim);

        if ($dataFim < $dataInicio || $dataInicio->diff($dataFim)->days > 62) {
            throw new ExcecaoApi('O período da agenda deve ter no máximo 63 dias.', 422, 'periodo_invalido');
        }

        return executarConsultaJson(
            $pdo,
            'with parametros as (
                select
                    cast(:barbearia_id as uuid) as barbearia_id,
                    cast(:inicio as date) as inicio,
                    cast(:fim as date) as fim
             ),
             agendamentos_periodo as (
                select
                    a.id, a.codigo, a.cliente_id, a.servico_id, a.funcionario_id,
                    a.nome_cliente_snapshot as cliente,
                    a.telefone_cliente_snapshot as telefone,
                    a.servico_snapshot as servico,
                    a.data_agendamento, a.horario_inicio, a.horario_fim,
                    a.status, a.observacoes, a.valor_previsto,
                    f.nome as funcionario
                from agendamentos a
                cross join parametros p
                left join funcionarios f
                  on f.id = a.funcionario_id and f.barbearia_id = a.barbearia_id
                where a.barbearia_id = p.barbearia_id
                  and a.data_agendamento between p.inicio and p.fim
             ),
             servicos_ativos as (
                select s.id, s.nome, s.preco, s.duracao_minutos
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
             clientes_ativos as (
                select c.id, c.nome, c.telefone
                from clientes c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id and c.ativo
                order by c.nome
                 limit 50
             ),
             horarios_configurados as (
                select h.dia_semana, h.abertura, h.fechamento, h.ativo
                from horarios_funcionamento h
                cross join parametros p
                where h.barbearia_id = p.barbearia_id
             )
             select jsonb_build_object(
                \'agendamentos\', coalesce((
                    select jsonb_agg(
                        to_jsonb(a) order by a.data_agendamento, a.horario_inicio
                    )
                    from agendamentos_periodo a
                ), \'[]\'::jsonb),
                \'servicos\', coalesce((
                    select jsonb_agg(to_jsonb(s) order by s.nome) from servicos_ativos s
                ), \'[]\'::jsonb),
                \'funcionarios\', coalesce((
                    select jsonb_agg(to_jsonb(f) order by f.nome)
                    from funcionarios_ativos f
                ), \'[]\'::jsonb),
                \'clientes\', coalesce((
                    select jsonb_agg(to_jsonb(c) order by c.nome) from clientes_ativos c
                ), \'[]\'::jsonb),
                \'horarios\', coalesce((
                    select jsonb_agg(to_jsonb(h) order by h.dia_semana)
                    from horarios_configurados h
                ), \'[]\'::jsonb)
             )',
            [
                'barbearia_id' => $identificadorBarbearia,
                'inicio' => $inicio,
                'fim' => $fim,
            ]
        );
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();
    $identificador = $metodo === 'POST' ? null : exigirUuid($dados);

    if ($metodo === 'DELETE') {
        $cancelamento = $pdo->prepare(
            'update agendamentos
             set status = \'cancelado\'
             where id = :id and barbearia_id = :barbearia_id
             returning id'
        );
        $cancelamento->execute([
            'id' => $identificador,
            'barbearia_id' => $identificadorBarbearia,
        ]);

        if (!$cancelamento->fetch()) {
            throw new ExcecaoApi('Agendamento não encontrado.', 404, 'agendamento_nao_encontrado');
        }

        return ['id' => $identificador, 'status' => 'cancelado'];
    }

    if ($metodo === 'PATCH' && count($dados) === 2 && array_key_exists('status', $dados)) {
        $situacao = exigirOpcao(
            $dados,
            'status',
            'status',
            ['pendente', 'confirmado', 'parcial', 'concluido', 'cancelado']
        );
        $atualizacao = $pdo->prepare(
            'update agendamentos
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
            throw new ExcecaoApi('Agendamento não encontrado.', 404, 'agendamento_nao_encontrado');
        }

        return ['id' => $identificador, 'status' => $situacao];
    }

    $nomeCliente = exigirTexto($dados, 'cliente', 'cliente', 160);
    $telefone = textoOpcional($dados, 'telefone', 30);
    $identificadorServico = exigirUuid($dados, 'servico_id');
    $identificadorFuncionario = exigirUuid($dados, 'funcionario_id');
    $data = exigirTexto($dados, 'data_agendamento', 'data', 10);
    $horario = exigirTexto($dados, 'horario_inicio', 'horário', 5);
    $observacoes = textoOpcional($dados, 'observacoes', 1500);
    if (!dataIsoValida($data) || !horarioValido($horario)) {
        throw new ExcecaoApi('Informe data e horário válidos.', 422, 'data_horario_invalido');
    }
    $identificadorCliente = textoOpcional($dados, 'cliente_id', 36);
    if ($identificadorCliente !== null && !identificadorUuidValido($identificadorCliente)) {
        throw new ExcecaoApi('Selecione um cliente válido.', 422, 'cliente_invalido');
    }

    $pdo->beginTransaction();
    try {
        $atual = null;
        if ($metodo === 'PATCH') {
            $consultaAtual = $pdo->prepare(
                'select * from agendamentos where id = :id and barbearia_id = :barbearia_id for update'
            );
            $consultaAtual->execute(['id' => $identificador, 'barbearia_id' => $identificadorBarbearia]);
            $atual = $consultaAtual->fetch();
            if (!$atual) {
                throw new ExcecaoApi('Agendamento não encontrado.', 404, 'agendamento_nao_encontrado');
            }
        }

        // Uma edição de observação/horário mantém o preço e a duração contratados.
        if ($atual && $atual['servico_id'] === $identificadorServico) {
            $nomeServico = $atual['servico_snapshot'];
            $preco = $atual['valor_previsto'];
            $duracao = minutosDoHorario($atual['horario_fim']) - minutosDoHorario($atual['horario_inicio']);
        } else {
            $servico = obterEntidadeDaBarbearia($pdo, 'servicos', $identificadorServico, $identificadorBarbearia);
            $nomeServico = $servico['nome'];
            $preco = $servico['preco'];
            $duracao = (int)$servico['duracao_minutos'];
        }
        if (!$atual || $atual['funcionario_id'] !== $identificadorFuncionario) {
            obterEntidadeDaBarbearia($pdo, 'funcionarios', $identificadorFuncionario, $identificadorBarbearia);
        }
        if ($identificadorCliente !== null && (!$atual || $atual['cliente_id'] !== $identificadorCliente)) {
            obterEntidadeDaBarbearia($pdo, 'clientes', $identificadorCliente, $identificadorBarbearia);
        }
        $horarioFim = calcularFimAgendamento($horario, $duracao);

        $parametros = [
            'barbearia_id' => $identificadorBarbearia, 'cliente_id' => $identificadorCliente,
            'servico_id' => $identificadorServico, 'funcionario_id' => $identificadorFuncionario,
            'cliente' => $nomeCliente, 'telefone' => $telefone, 'servico' => $nomeServico,
            'data_agendamento' => $data, 'horario_inicio' => $horario, 'horario_fim' => $horarioFim,
            'observacoes' => $observacoes, 'valor_previsto' => $preco,
        ];
        if ($metodo === 'POST') {
            $gravacao = $pdo->prepare(
                "insert into agendamentos (
                    barbearia_id, codigo, cliente_id, servico_id, funcionario_id,
                    nome_cliente_snapshot, telefone_cliente_snapshot, servico_snapshot,
                    data_agendamento, horario_inicio, horario_fim, status, observacoes, valor_previsto
                 ) values (
                    :barbearia_id, concat('AG-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
                    :cliente_id, :servico_id, :funcionario_id, :cliente, :telefone, :servico,
                    :data_agendamento, :horario_inicio, :horario_fim, 'pendente', :observacoes, :valor_previsto
                 ) returning id, codigo"
            );
        } else {
            $parametros['id'] = $identificador;
            $gravacao = $pdo->prepare(
                'update agendamentos set cliente_id = :cliente_id, servico_id = :servico_id,
                    funcionario_id = :funcionario_id, nome_cliente_snapshot = :cliente,
                    telefone_cliente_snapshot = :telefone, servico_snapshot = :servico,
                    data_agendamento = :data_agendamento, horario_inicio = :horario_inicio,
                    horario_fim = :horario_fim, observacoes = :observacoes, valor_previsto = :valor_previsto
                 where id = :id and barbearia_id = :barbearia_id returning id, codigo'
            );
        }
        $gravacao->execute($parametros);
        $agendamento = $gravacao->fetch();
        $pdo->commit();
        return ['agendamento' => $agendamento];
    } catch (Throwable $excecao) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $excecao;
    }
});
