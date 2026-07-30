<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'POST', 'PATCH', 'DELETE');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'clientes.visualizar' : 'clientes.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $busca = parametroConsulta('busca');
        $situacao = parametroConsulta('situacao');
        $termo = '%' . mb_strtolower($busca) . '%';
        $filtroSituacao = match ($situacao) {
            'ativos' => 'and c.ativo = true',
            'inativos' => 'and c.ativo = false',
            default => '',
        };

        return executarConsultaJson(
            $pdo,
            "with parametros as (
                select
                    cast(:barbearia_id as uuid) as barbearia_id,
                    cast(:busca as text) as busca,
                    cast(:termo as text) as termo
             ),
             clientes_filtrados as (
                select
                    c.id, c.nome, c.email, c.telefone, c.cidade, c.observacoes,
                    c.ultima_visita, c.total_visitas, c.total_gasto, c.ativo, c.created_at
                from clientes c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id
                  and (
                    p.busca = ''
                    or lower(c.nome) like p.termo
                    or lower(c.telefone) like p.termo
                    or lower(coalesce(c.email, '')) like p.termo
                  )
                  {$filtroSituacao}
                order by c.ativo desc, c.nome asc
                limit 250
             ),
             resumo as (
                select
                    count(*) as total,
                    count(*) filter (where c.ativo) as ativos,
                    count(*) filter (
                        where c.ultima_visita >= current_date - interval '30 days'
                    ) as recentes,
                    coalesce(sum(c.total_gasto), 0) as valor_total
                from clientes c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id
             )
             select jsonb_build_object(
                'clientes', coalesce((
                    select jsonb_agg(to_jsonb(c) order by c.ativo desc, c.nome)
                    from clientes_filtrados c
                ), '[]'::jsonb),
                'resumo', (select to_jsonb(r) from resumo r)
             )",
            [
                'barbearia_id' => $identificadorBarbearia,
                'busca' => $busca,
                'termo' => $termo,
            ]
        );
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();

    if ($metodo === 'POST') {
        $nome = exigirTexto($dados, 'nome', 'nome', 160);
        $telefone = exigirTexto($dados, 'telefone', 'telefone', 30);
        $email = emailOpcional($dados);
        $cidade = textoOpcional($dados, 'cidade', 120);
        $observacoes = textoOpcional($dados, 'observacoes', 1500);

        $insercao = $pdo->prepare(
            'insert into clientes (
                barbearia_id, nome, email, telefone, cidade, observacoes, ativo
             ) values (
                :barbearia_id, :nome, :email, :telefone, :cidade, :observacoes, true
             )
             returning id, nome, email, telefone, cidade, observacoes,
                       ultima_visita, total_visitas, total_gasto, ativo, created_at'
        );
        $insercao->execute([
            'barbearia_id' => $identificadorBarbearia,
            'nome' => $nome,
            'email' => $email,
            'telefone' => $telefone,
            'cidade' => $cidade,
            'observacoes' => $observacoes,
        ]);

        return ['cliente' => $insercao->fetch()];
    }

    $identificador = exigirUuid($dados);

    if ($metodo === 'DELETE') {
        $exclusaoLogica = $pdo->prepare(
            'update clientes
             set ativo = false
             where id = :id and barbearia_id = :barbearia_id
             returning id'
        );
        $exclusaoLogica->execute([
            'id' => $identificador,
            'barbearia_id' => $identificadorBarbearia,
        ]);

        if (!$exclusaoLogica->fetch()) {
            throw new ExcecaoApi('Cliente não encontrado.', 404, 'cliente_nao_encontrado');
        }

        return ['id' => $identificador, 'ativo' => false];
    }

    $nome = exigirTexto($dados, 'nome', 'nome', 160);
    $telefone = exigirTexto($dados, 'telefone', 'telefone', 30);
    $email = emailOpcional($dados);
    $cidade = textoOpcional($dados, 'cidade', 120);
    $observacoes = textoOpcional($dados, 'observacoes', 1500);
    $ativo = valorBooleano($dados['ativo'] ?? null);

    $atualizacao = $pdo->prepare(
        'update clientes
         set nome = :nome,
             email = :email,
             telefone = :telefone,
             cidade = :cidade,
             observacoes = :observacoes,
             ativo = :ativo
         where id = :id and barbearia_id = :barbearia_id
         returning id, nome, email, telefone, cidade, observacoes,
                   ultima_visita, total_visitas, total_gasto, ativo, created_at'
    );
    $atualizacao->execute([
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
        'nome' => $nome,
        'email' => $email,
        'telefone' => $telefone,
        'cidade' => $cidade,
        'observacoes' => $observacoes,
        'ativo' => $ativo ? 'true' : 'false',
    ]);
    $cliente = $atualizacao->fetch();

    if (!$cliente) {
        throw new ExcecaoApi('Cliente não encontrado.', 404, 'cliente_nao_encontrado');
    }

    return ['cliente' => $cliente];
});
