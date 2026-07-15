<?php

declare(strict_types=1);

final class BrasilApiException extends RuntimeException
{
    public function __construct(string $message, private readonly int $httpStatus = 502)
    {
        parent::__construct($message);
    }

    public function getHttpStatus(): int
    {
        return $this->httpStatus;
    }
}

function somenteDigitos(string $valor): string
{
    return preg_replace('/\D+/', '', $valor) ?? '';
}

function cnpjEhValido(string $valor): bool
{
    $cnpj = somenteDigitos($valor);

    if (strlen($cnpj) !== 14 || preg_match('/^(\d)\1{13}$/', $cnpj) === 1) {
        return false;
    }

    $pesos = [
        [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
        [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    ];

    foreach ($pesos as $indiceDigito => $pesosDoDigito) {
        $soma = 0;

        foreach ($pesosDoDigito as $indice => $peso) {
            $soma += ((int)$cnpj[$indice]) * $peso;
        }

        $resto = $soma % 11;
        $digitoCalculado = $resto < 2 ? 0 : 11 - $resto;
        $posicaoDigito = 12 + $indiceDigito;

        if ((int)$cnpj[$posicaoDigito] !== $digitoCalculado) {
            return false;
        }
    }

    return true;
}

function formatarCnpj(string $valor): string
{
    $cnpj = somenteDigitos($valor);

    if (strlen($cnpj) !== 14) {
        return $valor;
    }

    return substr($cnpj, 0, 2) . '.'
        . substr($cnpj, 2, 3) . '.'
        . substr($cnpj, 5, 3) . '/'
        . substr($cnpj, 8, 4) . '-'
        . substr($cnpj, 12, 2);
}

/**
 * @return array<string, mixed>
 */
function consultarCnpjNaBrasilApi(string $valor): array
{
    $cnpj = somenteDigitos($valor);

    if (!cnpjEhValido($cnpj)) {
        throw new BrasilApiException('Informe um CNPJ válido com 14 dígitos.', 422);
    }

    $curl = curl_init('https://brasilapi.com.br/api/cnpj/v1/' . rawurlencode($cnpj));

    if ($curl === false) {
        throw new BrasilApiException('Não foi possível iniciar a consulta do CNPJ.', 503);
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'LocalBarber/1.0 (consulta de CNPJ)',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $resposta = curl_exec($curl);
    $statusHttp = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $erroCurl = curl_error($curl);
    curl_close($curl);

    if ($resposta === false) {
        error_log('[LocalBarber] Falha ao consultar a BrasilAPI: ' . $erroCurl);
        throw new BrasilApiException('A consulta de CNPJ está temporariamente indisponível.', 503);
    }

    if ($statusHttp === 400) {
        throw new BrasilApiException('O CNPJ informado é inválido.', 422);
    }

    if ($statusHttp === 404) {
        throw new BrasilApiException('CNPJ não encontrado na base da Receita Federal.', 404);
    }

    if ($statusHttp === 429 || $statusHttp >= 500) {
        throw new BrasilApiException('A consulta de CNPJ está temporariamente indisponível.', 503);
    }

    if ($statusHttp !== 200) {
        throw new BrasilApiException('Não foi possível validar o CNPJ informado.', 502);
    }

    try {
        $empresa = json_decode($resposta, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        error_log('[LocalBarber] Resposta inválida da BrasilAPI: ' . $exception->getMessage());
        throw new BrasilApiException('A BrasilAPI retornou uma resposta inválida.', 502);
    }

    if (!is_array($empresa)) {
        throw new BrasilApiException('A BrasilAPI retornou uma resposta inválida.', 502);
    }

    if (somenteDigitos((string)($empresa['cnpj'] ?? '')) !== $cnpj) {
        throw new BrasilApiException('A BrasilAPI retornou dados inconsistentes para o CNPJ.', 502);
    }

    return $empresa;
}
