<?php

declare(strict_types=1);

const TIPOS_ACESSO_PERMITIDOS = ['administrador', 'colaborador'];
const PAPEIS_COLABORADOR = ['colaborador', 'gerente', 'barbeiro', 'recepcao'];

const PERMISSOES_ADMINISTRADOR = [
    'dashboard.visualizar',
    'agenda.visualizar',
    'agenda.gerenciar',
    'clientes.visualizar',
    'clientes.gerenciar',
    'servicos.visualizar',
    'servicos.gerenciar',
    'financeiro.visualizar',
    'financeiro.gerenciar',
    'equipe.visualizar',
    'equipe.gerenciar',
    'barbearia.visualizar',
    'barbearia.gerenciar',
];

const PERMISSOES_COLABORADOR = [
    'agenda.visualizar',
    'agenda.gerenciar',
    'clientes.visualizar',
    'clientes.gerenciar',
    'servicos.visualizar',
];

function normalizarTipoAcesso(mixed $valor): string
{
    $tipoAcesso = strtolower(trim((string)$valor));

    return in_array($tipoAcesso, TIPOS_ACESSO_PERMITIDOS, true)
        ? $tipoAcesso
        : '';
}

function papelCompativelComTipoAcesso(string $papel, string $tipoAcesso): bool
{
    $papelNormalizado = strtolower(trim($papel));

    if ($tipoAcesso === 'administrador') {
        return $papelNormalizado === 'admin';
    }

    if ($tipoAcesso === 'colaborador') {
        return in_array($papelNormalizado, PAPEIS_COLABORADOR, true);
    }

    return false;
}

function tipoAcessoPorPapel(string $papel): string
{
    return strtolower(trim($papel)) === 'admin'
        ? 'administrador'
        : 'colaborador';
}

function papelPorTipoAcesso(string $tipoAcesso): string
{
    return $tipoAcesso === 'administrador'
        ? 'admin'
        : 'colaborador';
}

function permissoesPorPapel(string $papel): array
{
    return tipoAcessoPorPapel($papel) === 'administrador'
        ? PERMISSOES_ADMINISTRADOR
        : PERMISSOES_COLABORADOR;
}

function possuiPermissao(string $papel, string $permissao): bool
{
    return in_array($permissao, permissoesPorPapel($papel), true);
}

function rotaInicialPorPapel(string $papel): string
{
    return tipoAcessoPorPapel($papel) === 'administrador'
        ? 'dashboard.php'
        : 'pages/agenda.html';
}
