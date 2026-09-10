<?php

declare(strict_types=1);

require_once __DIR__ . '/_inicializacao.php';

executarApi(static function () use ($pdo): array {
    exigirMetodo('GET');
    $sessao = exigirAutenticacao($pdo);
    exigirPermissao($sessao, 'clientes.visualizar');
    $busca = parametroConsulta('busca');
    $digitos = preg_replace('/\D+/', '', $busca);
    $consulta = $pdo->prepare(
        "select id, nome, telefone from clientes
         where barbearia_id = :barbearia_id and ativo
           and (:busca = '' or nome ilike :nome
                or (:digitos <> '' and (cpf like :cpf
                    or regexp_replace(telefone, '[^0-9]', '', 'g') like :telefone)))
         order by nome, id limit 51"
    );
    $consulta->execute([
        'barbearia_id' => $sessao['barbearia_id'], 'busca' => $busca, 'nome' => '%' . $busca . '%',
        'digitos' => $digitos, 'cpf' => '%' . $digitos . '%', 'telefone' => '%' . $digitos . '%',
    ]);
    $clientes = $consulta->fetchAll();
    return ['clientes' => array_slice($clientes, 0, 50), 'tem_mais' => count($clientes) > 50];
});
