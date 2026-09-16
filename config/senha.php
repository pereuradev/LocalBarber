<?php

declare(strict_types=1);

function validarNovaSenha(string $senha): void
{
    // Bcrypt limita em bytes, nao em caracteres: evita truncamento silencioso de Unicode.
    if (mb_strlen($senha) < 8 || strlen($senha) > 72) {
        throw new ExcecaoApi('Use pelo menos 8 caracteres e no máximo 72 bytes (acentos ocupam mais espaço).', 422, 'senha_invalida');
    }
    if (preg_match('/\p{L}/u', $senha) !== 1 || preg_match('/\d/u', $senha) !== 1) {
        throw new ExcecaoApi('A nova senha deve ter pelo menos uma letra e um número.', 422, 'senha_invalida');
    }
}
