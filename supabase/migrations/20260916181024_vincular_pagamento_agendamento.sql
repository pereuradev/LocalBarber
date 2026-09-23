-- Um agendamento pode ter somente uma cobrança ativa; transações canceladas
-- liberam o agendamento para um novo pagamento.
CREATE UNIQUE INDEX IF NOT EXISTS transacoes_agendamento_ativo_uniq
ON locaalbarber.transacoes (barbearia_id, agendamento_id)
WHERE agendamento_id IS NOT NULL AND status <> 'cancelado';
