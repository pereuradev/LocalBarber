<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

function calcularDigitoCpf(string $base, int $pesoInicial): int
{
    $soma = 0;
    foreach (str_split($base) as $indice => $digito) {
        $soma += (int)$digito * ($pesoInicial - $indice);
    }

    $resto = $soma % 11;
    return $resto < 2 ? 0 : 11 - $resto;
}

function exigirCpfValido(array $dados): string
{
    $valor = exigirTexto($dados, 'cpf', 'CPF', 14);
    if (preg_match('/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/', $valor) !== 1) {
        throw new ExcecaoApi('Informe um CPF válido.', 422, 'cpf_invalido');
    }

    $cpf = preg_replace('/\D+/', '', $valor) ?? '';

    if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf) === 1) {
        throw new ExcecaoApi('Informe um CPF válido.', 422, 'cpf_invalido');
    }

    $primeiroDigito = calcularDigitoCpf(substr($cpf, 0, 9), 10);
    $segundoDigito = calcularDigitoCpf(substr($cpf, 0, 9) . $primeiroDigito, 11);

    if (!str_ends_with($cpf, (string)$primeiroDigito . $segundoDigito)) {
        throw new ExcecaoApi('Informe um CPF válido.', 422, 'cpf_invalido');
    }

    return $cpf;
}

function garantirCpfDisponivel(
    PDO $pdo,
    string $barbeariaId,
    string $cpf,
    ?string $clienteIgnorado = null
): void {
    $filtroCliente = $clienteIgnorado === null ? '' : 'and id <> :cliente_ignorado';
    $consulta = $pdo->prepare(
        "select 1
         from clientes
         where barbearia_id = :barbearia_id
           and cpf = :cpf
           {$filtroCliente}
         limit 1"
    );
    $parametros = [
        'barbearia_id' => $barbeariaId,
        'cpf' => $cpf,
    ];
    if ($clienteIgnorado !== null) {
        $parametros['cliente_ignorado'] = $clienteIgnorado;
    }
    $consulta->execute($parametros);

    if ($consulta->fetchColumn()) {
        throw new ExcecaoApi(
            'Já existe um cliente cadastrado com este CPF.',
            409,
            'cpf_duplicado'
        );
    }
}

function executarGravacaoCliente(PDOStatement $comando, array $parametros): void
{
    try {
        $comando->execute($parametros);
    } catch (PDOException $excecao) {
        if (
            $excecao->getCode() === '23505'
            && str_contains(mb_strtolower($excecao->getMessage()), 'cpf')
        ) {
            throw new ExcecaoApi(
                'Já existe um cliente cadastrado com este CPF.',
                409,
                'cpf_duplicado'
            );
        }

        throw $excecao;
    }
}

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'POST', 'PATCH', 'DELETE');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'clientes.visualizar' : 'clientes.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $paginacao = parametrosPaginacao();
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
                    cast(:termo as text) as termo,
                    cast(:cpf_busca as text) as cpf_busca,
                    cast(:cpf_termo as text) as cpf_termo
             ),
             clientes_filtrados as (
                select
                    c.id, c.nome, c.cpf, c.email, c.telefone, c.cidade, c.observacoes,
                    c.ultima_visita, c.total_visitas, c.total_gasto, c.ativo, c.created_at
                from clientes_com_metricas c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id
                  and (
                    p.busca = ''
                    or lower(c.nome) like p.termo
                    or lower(c.telefone) like p.termo
                    or lower(coalesce(c.email, '')) like p.termo
                    or (p.cpf_busca <> '' and coalesce(c.cpf, '') like p.cpf_termo)
                  )
                  {$filtroSituacao}
                order by c.ativo desc, c.nome asc
             ),
             clientes_pagina as (
                 select * from clientes_filtrados order by ativo desc, nome, id limit :limite offset :deslocamento
             ),
             resumo as (
                select
                    count(*) as total,
                    count(*) filter (where c.ativo) as ativos,
                    count(*) filter (
                        where c.ultima_visita >= current_date - interval '30 days'
                    ) as recentes,
                    coalesce(sum(c.total_gasto), 0) as valor_total
                from clientes_com_metricas c
                cross join parametros p
                where c.barbearia_id = p.barbearia_id
             )
             select jsonb_build_object(
                'paginacao', jsonb_build_object(
                    'pagina', cast(:pagina as int),
                    'por_pagina', cast(:tamanho_pagina as int),
                    'total', (select count(*) from clientes_filtrados)
                ),
                'clientes', coalesce((
                    select jsonb_agg(to_jsonb(c) order by c.ativo desc, c.nome)
                    from clientes_pagina c
                ), '[]'::jsonb),
                'resumo', (select to_jsonb(r) from resumo r)
             )",
            [
                'barbearia_id' => $identificadorBarbearia,
                'pagina' => $paginacao['pagina'],
                'tamanho_pagina' => $paginacao['tamanho_pagina'],
                'limite' => $paginacao['limite'],
                'deslocamento' => $paginacao['deslocamento'],
                'busca' => $busca,
                'termo' => $termo,
                'cpf_busca' => preg_replace('/\D+/', '', $busca) ?? '',
                'cpf_termo' => '%' . (preg_replace('/\D+/', '', $busca) ?? '') . '%',
            ]
        );
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();

    if ($metodo === 'POST') {
        $nome = exigirTexto($dados, 'nome', 'nome', 160);
        $cpf = exigirCpfValido($dados);
        $telefone = exigirTexto($dados, 'telefone', 'telefone', 30);
        $email = emailOpcional($dados);
        $cidade = textoOpcional($dados, 'cidade', 120);
        $observacoes = textoOpcional($dados, 'observacoes', 1500);
        garantirCpfDisponivel($pdo, $identificadorBarbearia, $cpf);

        $insercao = $pdo->prepare(
            'insert into clientes (
                barbearia_id, nome, cpf, email, telefone, cidade, observacoes, ativo
             ) values (
                :barbearia_id, :nome, :cpf, :email, :telefone, :cidade, :observacoes, true
             )
             returning id, nome, cpf, email, telefone, cidade, observacoes,
                       ultima_visita, total_visitas, total_gasto, ativo, created_at'
        );
        executarGravacaoCliente($insercao, [
            'barbearia_id' => $identificadorBarbearia,
            'nome' => $nome,
            'cpf' => $cpf,
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
    $cpf = exigirCpfValido($dados);
    $telefone = exigirTexto($dados, 'telefone', 'telefone', 30);
    $email = emailOpcional($dados);
    $cidade = textoOpcional($dados, 'cidade', 120);
    $observacoes = textoOpcional($dados, 'observacoes', 1500);
    $ativo = valorBooleano($dados['ativo'] ?? null);
    garantirCpfDisponivel($pdo, $identificadorBarbearia, $cpf, $identificador);

    $atualizacao = $pdo->prepare(
        'update clientes
         set nome = :nome,
             cpf = :cpf,
             email = :email,
             telefone = :telefone,
             cidade = :cidade,
             observacoes = :observacoes,
             ativo = :ativo
         where id = :id and barbearia_id = :barbearia_id
         returning id, nome, cpf, email, telefone, cidade, observacoes,
                   ultima_visita, total_visitas, total_gasto, ativo, created_at'
    );
    executarGravacaoCliente($atualizacao, [
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
        'nome' => $nome,
        'cpf' => $cpf,
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
