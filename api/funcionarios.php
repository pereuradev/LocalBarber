<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

function normalizarEspacosCampo(string $valor): string
{
    return preg_replace('/\s+/u', ' ', trim($valor)) ?? trim($valor);
}

function calcularDigitoCpfProfissional(string $base, int $pesoInicial): int
{
    $soma = 0;
    foreach (str_split($base) as $indice => $digito) {
        $soma += (int)$digito * ($pesoInicial - $indice);
    }

    $resto = $soma % 11;
    return $resto < 2 ? 0 : 11 - $resto;
}

function exigirCpfProfissionalValido(array $dados): string
{
    $valor = exigirTexto($dados, 'cpf', 'CPF', 14);
    if (preg_match('/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/', $valor) !== 1) {
        throw new ExcecaoApi('Informe um CPF válido.', 422, 'cpf_invalido');
    }

    $cpf = preg_replace('/\D+/', '', $valor) ?? '';
    if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf) === 1) {
        throw new ExcecaoApi('Informe um CPF válido.', 422, 'cpf_invalido');
    }

    $primeiroDigito = calcularDigitoCpfProfissional(substr($cpf, 0, 9), 10);
    $segundoDigito = calcularDigitoCpfProfissional(
        substr($cpf, 0, 9) . $primeiroDigito,
        11
    );

    if (!str_ends_with($cpf, (string)$primeiroDigito . $segundoDigito)) {
        throw new ExcecaoApi('Informe um CPF válido.', 422, 'cpf_invalido');
    }

    return $cpf;
}

function garantirCpfProfissionalDisponivel(
    PDO $pdo,
    string $identificadorBarbearia,
    string $cpf,
    ?string $funcionarioIgnorado = null
): void {
    $filtroFuncionario = $funcionarioIgnorado === null
        ? ''
        : 'and id <> :funcionario_ignorado';
    $consulta = $pdo->prepare(
        "select 1
         from funcionarios
         where barbearia_id = :barbearia_id
           and cpf = :cpf
           {$filtroFuncionario}
         limit 1"
    );
    $parametros = [
        'barbearia_id' => $identificadorBarbearia,
        'cpf' => $cpf,
    ];
    if ($funcionarioIgnorado !== null) {
        $parametros['funcionario_ignorado'] = $funcionarioIgnorado;
    }
    $consulta->execute($parametros);

    if ($consulta->fetchColumn()) {
        throw new ExcecaoApi(
            'Já existe um profissional cadastrado com este CPF.',
            409,
            'cpf_duplicado'
        );
    }
}

function executarGravacaoFuncionario(PDOStatement $comando, array $parametros): void
{
    try {
        $comando->execute($parametros);
    } catch (PDOException $excecao) {
        if (
            $excecao->getCode() === '23505'
            && str_contains(mb_strtolower($excecao->getMessage()), 'cpf')
        ) {
            throw new ExcecaoApi(
                'Já existe um profissional cadastrado com este CPF.',
                409,
                'cpf_duplicado'
            );
        }

        throw $excecao;
    }
}

function exigirNomeProfissional(array $dados): string
{
    $nome = normalizarEspacosCampo(exigirTexto($dados, 'nome', 'nome', 160));

    if (
        mb_strlen($nome) < 2
        || preg_match("~^[\p{L}](?:[\p{L}\s'’.-]*[\p{L}'’])?$~u", $nome) !== 1
    ) {
        throw new ExcecaoApi(
            'Informe um nome válido usando apenas letras e pontuação adequada.',
            422,
            'nome_invalido'
        );
    }

    return $nome;
}

function telefoneProfissionalOpcional(array $dados): ?string
{
    $telefone = textoOpcional($dados, 'telefone', 30);

    if ($telefone === null) {
        return null;
    }

    if (preg_match('/[^\d\s()+.-]/u', $telefone) === 1) {
        throw new ExcecaoApi(
            'O telefone deve conter apenas números e os caracteres da formatação.',
            422,
            'telefone_invalido'
        );
    }

    $digitos = preg_replace('/\D+/', '', $telefone) ?? '';
    $padraoTelefone =
        '/^(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[13-5]|6[1-9]|7[134579]|8[1-9]|9[1-9])\d{8,9}$/';

    if (preg_match($padraoTelefone, $digitos) !== 1) {
        throw new ExcecaoApi(
            'Informe um DDD válido e um telefone com 10 ou 11 dígitos.',
            422,
            'telefone_invalido'
        );
    }

    $ddd = substr($digitos, 0, 2);
    $numero = substr($digitos, 2);
    $tamanhoPrefixo = strlen($digitos) === 11 ? 5 : 4;
    $prefixo = substr($numero, 0, $tamanhoPrefixo);
    $sufixo = substr($numero, $tamanhoPrefixo);

    return sprintf('(%s) %s-%s', $ddd, $prefixo, $sufixo);
}

function exigirFuncaoProfissional(array $dados): string
{
    $funcao = normalizarEspacosCampo(
        exigirTexto($dados, 'funcao', 'função', 100)
    );

    if (
        mb_strlen($funcao) < 2
        || preg_match("~^[\p{L}\s'’().&/-]+$~u", $funcao) !== 1
        || preg_match('/\p{L}/u', $funcao) !== 1
    ) {
        throw new ExcecaoApi(
            'Informe uma função válida usando letras e pontuação adequada.',
            422,
            'funcao_invalida'
        );
    }

    return $funcao;
}

function exigirEmailAcesso(array $dados): string
{
    $email = emailOpcional($dados);

    if ($email === null) {
        throw new ExcecaoApi(
            'Informe o e-mail usado pelo profissional para entrar no sistema.',
            422,
            'email_obrigatorio'
        );
    }

    return $email;
}

function validarSenhaAcesso(array $dados, bool $obrigatoria): ?string
{
    $senha = (string)($dados['senha'] ?? '');

    if ($senha === '') {
        if ($obrigatoria) {
            throw new ExcecaoApi(
                'Crie uma senha com pelo menos 8 caracteres para o profissional.',
                422,
                'senha_obrigatoria'
            );
        }

        return null;
    }

    $tamanho = mb_strlen($senha);
    if ($tamanho < 8 || $tamanho > 72) {
        throw new ExcecaoApi(
            'A senha deve ter entre 8 e 72 caracteres.',
            422,
            'senha_invalida'
        );
    }

    if (
        preg_match('/\p{L}/u', $senha) !== 1
        || preg_match('/\d/', $senha) !== 1
    ) {
        throw new ExcecaoApi(
            'A senha deve ter pelo menos uma letra e um número.',
            422,
            'senha_invalida'
        );
    }

    return $senha;
}

function obterFuncionarioComConta(
    PDO $pdo,
    string $identificador,
    string $identificadorBarbearia
): array {
    $consulta = $pdo->prepare(
        'select
            f.id, f.usuario_id, f.nome, f.cpf, f.email, f.ativo,
            u.papel as papel_usuario, u.ativo as usuario_ativo
         from funcionarios f
         left join usuarios u
           on u.id = f.usuario_id and u.barbearia_id = f.barbearia_id
         where f.id = :id and f.barbearia_id = :barbearia_id
         limit 1
         for update of f'
    );
    $consulta->execute([
        'id' => $identificador,
        'barbearia_id' => $identificadorBarbearia,
    ]);
    $funcionario = $consulta->fetch();

    if (!$funcionario) {
        throw new ExcecaoApi(
            'Profissional não encontrado.',
            404,
            'funcionario_nao_encontrado'
        );
    }

    if (!empty($funcionario['usuario_id'])) {
        $bloqueioUsuario = $pdo->prepare(
            'select id
             from usuarios
             where id = :id and barbearia_id = :barbearia_id
             for update'
        );
        $bloqueioUsuario->execute([
            'id' => $funcionario['usuario_id'],
            'barbearia_id' => $identificadorBarbearia,
        ]);
    }

    return $funcionario;
}

function garantirAdministradorRestante(
    PDO $pdo,
    string $identificadorBarbearia,
    array $funcionario,
    string $novoPapel,
    bool $continuaraAtivo
): void {
    if (
        ($funcionario['papel_usuario'] ?? null) !== 'admin'
        || ($novoPapel === 'admin' && $continuaraAtivo)
    ) {
        return;
    }

    $consulta = $pdo->prepare(
        'select count(*)
         from usuarios
         where barbearia_id = :barbearia_id
           and papel = \'admin\'
           and ativo
           and id <> :usuario_id'
    );
    $consulta->execute([
        'barbearia_id' => $identificadorBarbearia,
        'usuario_id' => $funcionario['usuario_id'],
    ]);

    if ((int)$consulta->fetchColumn() === 0) {
        throw new ExcecaoApi(
            'A barbearia precisa manter pelo menos um administrador ativo.',
            422,
            'administrador_obrigatorio'
        );
    }
}

function prepararFuncionarioParaResposta(array $funcionario): array
{
    $funcionario['tem_acesso'] = !empty($funcionario['usuario_id']);
    $funcionario['perfil_acesso'] = $funcionario['tem_acesso']
        ? tipoAcessoPorPapel((string)($funcionario['papel_usuario'] ?? 'colaborador'))
        : null;
    unset($funcionario['papel_usuario']);

    return $funcionario;
}

executarApi(static function () use ($pdo): array {
    $metodo = exigirMetodo('GET', 'POST', 'PATCH', 'DELETE');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao(
        $sessao,
        $metodo === 'GET' ? 'equipe.visualizar' : 'equipe.gerenciar'
    );
    $identificadorBarbearia = $sessao['barbearia_id'];

    if ($metodo === 'GET') {
        $paginacao = parametrosPaginacao();
        $busca = parametroConsulta('busca');
        $situacao = parametroConsulta('situacao');
        $funcao = parametroConsulta('funcao');
        $termo = '%' . mb_strtolower($busca) . '%';
        $cpfBusca = preg_replace('/\D+/', '', $busca) ?? '';

        $resultado = executarConsultaJson(
            $pdo,
            'with parametros as (
                select
                    cast(:barbearia_id as uuid) as barbearia_id,
                    cast(:busca as text) as busca,
                    cast(:termo as text) as termo,
                    cast(:cpf_busca as text) as cpf_busca,
                    cast(:cpf_termo as text) as cpf_termo,
                    cast(:situacao as text) as situacao,
                    cast(:funcao as text) as funcao
             ),
             funcionarios_filtrados as (
                select
                    f.id, f.usuario_id, f.nome, f.cpf, f.telefone, f.email, f.funcao, f.status,
                    f.comissao_padrao_percentual, f.ativo,
                    u.papel as papel_usuario, u.ativo as usuario_ativo,
                    (
                        select count(*)
                        from agendamentos a
                        where a.funcionario_id = f.id
                          and a.barbearia_id = f.barbearia_id
                          and a.data_agendamento = current_date
                          and a.status <> \'cancelado\'
                    ) as atendimentos_hoje,
                    (
                        select count(*)
                        from agendamentos a
                        where a.funcionario_id = f.id
                          and a.barbearia_id = f.barbearia_id
                          and date_trunc(\'month\', a.data_agendamento)
                              = date_trunc(\'month\', current_date)
                          and a.status = \'concluido\'
                    ) as atendimentos_mes,
                    (
                        select coalesce(round(avg(av.nota), 1), 0)
                        from avaliacoes av
                        where av.funcionario_id = f.id
                          and av.barbearia_id = f.barbearia_id
                    ) as avaliacao_media
                from funcionarios f
                cross join parametros p
                left join usuarios u
                  on u.id = f.usuario_id and u.barbearia_id = f.barbearia_id
                where f.barbearia_id = p.barbearia_id
                  and (
                    p.busca = \'\'
                    or lower(f.nome) like p.termo
                    or lower(coalesce(f.email, \'\')) like p.termo
                    or (p.cpf_busca <> \'\' and coalesce(f.cpf, \'\') like p.cpf_termo)
                  )
                  and (p.situacao = \'\' or f.status = p.situacao)
                  and (p.funcao = \'\' or f.funcao = p.funcao)
                order by f.ativo desc, f.nome
             ),
             funcionarios_pagina as (
                 select * from funcionarios_filtrados order by ativo desc, nome, id limit :limite offset :deslocamento
             ),
             resumo as (
                select
                    count(*) as total,
                    count(*) filter (where f.ativo) as ativos,
                    count(*) filter (where f.ativo and f.status = \'online\') as online,
                    coalesce(round(avg(f.comissao_padrao_percentual), 1), 0)
                        as comissao_media
                from funcionarios f
                cross join parametros p
                where f.barbearia_id = p.barbearia_id
             )
             select jsonb_build_object(
                \'paginacao\', jsonb_build_object(
                    \'pagina\', cast(:pagina as int),
                    \'por_pagina\', cast(:tamanho_pagina as int),
                    \'total\', (select count(*) from funcionarios_filtrados)
                ),
                \'funcionarios\', coalesce((
                    select jsonb_agg(to_jsonb(f) order by f.ativo desc, f.nome)
                    from funcionarios_pagina f
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
                'cpf_busca' => $cpfBusca,
                'cpf_termo' => '%' . $cpfBusca . '%',
                'situacao' => $situacao,
                'funcao' => $funcao,
            ]
        );
        $resultado['funcionarios'] = array_map(
            'prepararFuncionarioParaResposta',
            $resultado['funcionarios'] ?? []
        );

        return $resultado;
    }

    exigirTokenCsrf();
    $dados = lerCorpoJson();

    if ($metodo === 'DELETE') {
        $identificador = exigirUuid($dados);
        $pdo->beginTransaction();

        try {
            $funcionario = obterFuncionarioComConta(
                $pdo,
                $identificador,
                $identificadorBarbearia
            );

            if (($funcionario['usuario_id'] ?? null) === $sessao['usuario_id']) {
                throw new ExcecaoApi(
                    'Você não pode desativar a própria conta.',
                    422,
                    'conta_propria'
                );
            }

            garantirAdministradorRestante(
                $pdo,
                $identificadorBarbearia,
                $funcionario,
                (string)($funcionario['papel_usuario'] ?? 'colaborador'),
                false
            );

            $desativacao = $pdo->prepare(
                'update funcionarios
                 set ativo = false, status = \'offline\', updated_at = now()
                 where id = :id and barbearia_id = :barbearia_id'
            );
            $desativacao->execute([
                'id' => $identificador,
                'barbearia_id' => $identificadorBarbearia,
            ]);

            if (!empty($funcionario['usuario_id'])) {
                $desativacaoUsuario = $pdo->prepare(
                    'update usuarios
                     set ativo = false, updated_at = now()
                     where id = :id and barbearia_id = :barbearia_id'
                );
                $desativacaoUsuario->execute([
                    'id' => $funcionario['usuario_id'],
                    'barbearia_id' => $identificadorBarbearia,
                ]);
            }

            $pdo->commit();
            return ['id' => $identificador, 'ativo' => false, 'acesso_ativo' => false];
        } catch (Throwable $excecao) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $excecao;
        }
    }

    $nome = exigirNomeProfissional($dados);
    $cpf = exigirCpfProfissionalValido($dados);
    $telefone = telefoneProfissionalOpcional($dados);
    $email = exigirEmailAcesso($dados);
    $funcao = exigirFuncaoProfissional($dados);
    $situacao = exigirOpcao($dados, 'status', 'status', ['online', 'busy', 'offline']);
    $comissao = numeroDecimal(
        $dados,
        'comissao_padrao_percentual',
        'comissão',
        0,
        100
    );
    $ativo = valorBooleano($dados['ativo'] ?? null);
    $tipoAcesso = normalizarTipoAcesso($dados['perfil_acesso'] ?? null);

    if ($tipoAcesso === '') {
        throw new ExcecaoApi(
            'Selecione se o profissional será administrador ou colaborador.',
            422,
            'perfil_acesso_invalido'
        );
    }

    $papel = papelPorTipoAcesso($tipoAcesso);
    $situacaoEfetiva = $ativo ? $situacao : 'offline';
    $identificador = $metodo === 'PATCH' ? exigirUuid($dados) : null;
    garantirCpfProfissionalDisponivel(
        $pdo,
        $identificadorBarbearia,
        $cpf,
        $identificador
    );
    $pdo->beginTransaction();

    try {
        $funcionarioAtual = $identificador === null
            ? null
            : obterFuncionarioComConta($pdo, $identificador, $identificadorBarbearia);
        $senha = validarSenhaAcesso(
            $dados,
            $metodo === 'POST' || empty($funcionarioAtual['usuario_id'])
        );

        if (
            $funcionarioAtual
            && ($funcionarioAtual['usuario_id'] ?? null) === $sessao['usuario_id']
            && (
                $papel !== $funcionarioAtual['papel_usuario']
                || !$ativo
            )
        ) {
            throw new ExcecaoApi(
                'Você não pode alterar o próprio perfil de acesso por esta tela.',
                422,
                'conta_propria'
            );
        }

        if ($funcionarioAtual) {
            garantirAdministradorRestante(
                $pdo,
                $identificadorBarbearia,
                $funcionarioAtual,
                $papel,
                $ativo
            );
        }

        $identificadorUsuario = (string)($funcionarioAtual['usuario_id'] ?? '');
        $senhaHash = $senha === null ? null : password_hash($senha, PASSWORD_DEFAULT);

        if ($identificadorUsuario === '') {
            $criacaoUsuario = $pdo->prepare(
                'insert into usuarios (
                    barbearia_id, nome, email, telefone, senha_hash, papel, ativo
                 ) values (
                    :barbearia_id, :nome, :email, :telefone, :senha_hash, :papel, :ativo
                 )
                 returning id'
            );
            $criacaoUsuario->execute([
                'barbearia_id' => $identificadorBarbearia,
                'nome' => $nome,
                'email' => $email,
                'telefone' => $telefone,
                'senha_hash' => $senhaHash,
                'papel' => $papel,
                'ativo' => $ativo ? 'true' : 'false',
            ]);
            $identificadorUsuario = (string)$criacaoUsuario->fetchColumn();
        } else {
            $atualizacaoSenha = $senhaHash === null
                ? ''
                : ', senha_hash = :senha_hash';
            $atualizacaoUsuario = $pdo->prepare(
                "update usuarios
                 set nome = :nome,
                     email = :email,
                     telefone = :telefone,
                     papel = :papel,
                     ativo = :ativo,
                     updated_at = now()
                     {$atualizacaoSenha}
                 where id = :id and barbearia_id = :barbearia_id"
            );
            $parametrosUsuario = [
                'id' => $identificadorUsuario,
                'barbearia_id' => $identificadorBarbearia,
                'nome' => $nome,
                'email' => $email,
                'telefone' => $telefone,
                'papel' => $papel,
                'ativo' => $ativo ? 'true' : 'false',
            ];
            if ($senhaHash !== null) {
                $parametrosUsuario['senha_hash'] = $senhaHash;
            }
            $atualizacaoUsuario->execute($parametrosUsuario);
        }

        if ($metodo === 'POST') {
            $gravacaoFuncionario = $pdo->prepare(
                'insert into funcionarios (
                    barbearia_id, usuario_id, nome, cpf, telefone, email, funcao, status,
                    comissao_padrao_percentual, ativo
                 ) values (
                    :barbearia_id, :usuario_id, :nome, :cpf, :telefone, :email, :funcao, :status,
                    :comissao, :ativo
                 )
                 returning id'
            );
            $parametrosFuncionario = [];
        } else {
            $gravacaoFuncionario = $pdo->prepare(
                'update funcionarios
                 set usuario_id = :usuario_id,
                     nome = :nome,
                     cpf = :cpf,
                     telefone = :telefone,
                     email = :email,
                     funcao = :funcao,
                     status = :status,
                     comissao_padrao_percentual = :comissao,
                     ativo = :ativo,
                     updated_at = now()
                 where id = :id and barbearia_id = :barbearia_id
                 returning id'
            );
            $parametrosFuncionario = ['id' => $identificador];
        }

        executarGravacaoFuncionario($gravacaoFuncionario, array_merge($parametrosFuncionario, [
            'barbearia_id' => $identificadorBarbearia,
            'usuario_id' => $identificadorUsuario,
            'nome' => $nome,
            'cpf' => $cpf,
            'telefone' => $telefone,
            'email' => $email,
            'funcao' => $funcao,
            'status' => $situacaoEfetiva,
            'comissao' => $comissao,
            'ativo' => $ativo ? 'true' : 'false',
        ]));
        $identificadorFuncionario = $gravacaoFuncionario->fetchColumn();

        if ($identificadorFuncionario === false) {
            throw new ExcecaoApi(
                'Profissional não encontrado.',
                404,
                'funcionario_nao_encontrado'
            );
        }

        $pdo->commit();
        return [
            'id' => $identificadorFuncionario,
            'usuario_id' => $identificadorUsuario,
            'perfil_acesso' => $tipoAcesso,
            'acesso_ativo' => $ativo,
        ];
    } catch (Throwable $excecao) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $excecao;
    }
});
