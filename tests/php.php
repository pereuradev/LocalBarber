<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/brasil-api.php';
require_once __DIR__ . '/../config/agendamento.php';
require_once __DIR__ . '/../config/env.php';

$verificacoes = 0;
function verificar(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) throw new RuntimeException($mensagem);
    $verificacoes++;
}
function rejeita(callable $acao, string $codigo): void
{
    try { $acao(); } catch (ExcecaoApi $erro) {
        verificar($erro->codigo === $codigo, 'Código de rejeição incorreto: ' . $erro->codigo);
        return;
    }
    throw new RuntimeException('Entrada inválida foi aceita: ' . $codigo);
}

verificar(cnpjEhValido('11222333000181'), 'CNPJ válido sem máscara');
verificar(cnpjEhValido('11.222.333/0001-81'), 'CNPJ válido com máscara');
verificar(!cnpjEhValido('11.222.333/0001-82'), 'Dígito de CNPJ inválido');
verificar(!cnpjEhValido('abc11222333000181'), 'Letras não podem ser removidas silenciosamente');
verificar(!cnpjEhValido('00000000000000'), 'CNPJ repetido inválido');
verificar(formatarCnpj('11222333000181') === '11.222.333/0001-81', 'Formatação canônica');
verificar(dataIsoValida('2028-02-29'), 'Ano bissexto');
verificar(!dataIsoValida('2026-02-29'), 'Data inexistente');
verificar(!horarioValido('24:00'), 'Horário fora do dia');
verificar(calcularFimAgendamento('10:30', 60) === '11:30', 'Duração do agendamento');
verificar(calcularFimAgendamento('23:00', 59) === '23:59', 'Final do dia');
rejeita(static fn () => calcularFimAgendamento('23:30', 60), 'intervalo_invalido');
rejeita(static fn () => calcularFimAgendamento('10:00', 0), 'intervalo_invalido');
$_GET = ['pagina' => '6', 'por_pagina' => '50'];
verificar(parametrosPaginacao()['deslocamento'] === 250, 'Acesso além dos primeiros 250');
$_GET = ['pagina' => '0'];
rejeita('parametrosPaginacao', 'paginacao_invalida');
$_GET = ['por_pagina' => '1000'];
rejeita('parametrosPaginacao', 'paginacao_invalida');
verificar(!possuiPermissao('colaborador', 'financeiro.gerenciar'), 'Colaborador sem acesso financeiro');
verificar(possuiPermissao('admin', 'financeiro.gerenciar'), 'Administrador com acesso financeiro');
verificar(!identificadorUuidValido('legacy-1'), 'Identificador antigo rejeitado');
verificar(identificadorUuidValido('11111111-1111-4111-8111-111111111111'), 'UUID aceito');
$data = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', '2026-09-10T10:00', new DateTimeZone('America/Sao_Paulo'));
verificar($data->format('Y-m-d H:i:sP') === '2026-09-10 10:00:00-03:00', 'Fuso explícito ao gravar');
verificar(decodeEnvironmentValue('"abc"') === 'abc', 'Leitura de ambiente');
echo "PHP: {$verificacoes} verificações passaram.\n";
