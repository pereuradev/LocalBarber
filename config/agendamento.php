<?php

declare(strict_types=1);

function minutosDoHorario(string $horario): int
{
    return (int)substr($horario, 0, 2) * 60 + (int)substr($horario, 3, 2);
}

function calcularFimAgendamento(string $horario, int $duracao): string
{
    $fim = minutosDoHorario($horario) + $duracao;
    if ($duracao <= 0 || $fim >= 24 * 60) {
        throw new ExcecaoApi('O atendimento deve terminar no mesmo dia.', 422, 'intervalo_invalido');
    }
    return sprintf('%02d:%02d', intdiv($fim, 60), $fim % 60);
}
