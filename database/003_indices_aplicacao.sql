-- Índices usados pelas consultas autenticadas do painel.
-- Não altera dados e não habilita RLS sem políticas previamente validadas.

create index if not exists clientes_barbearia_ativo_nome_idx
  on locaalbarber.clientes (barbearia_id, ativo, nome);

create index if not exists servicos_barbearia_ativo_nome_idx
  on locaalbarber.servicos (barbearia_id, ativo, nome);

create index if not exists servicos_categoria_id_idx
  on locaalbarber.servicos (categoria_id);

create index if not exists funcionarios_barbearia_ativo_nome_idx
  on locaalbarber.funcionarios (barbearia_id, ativo, nome);

create index if not exists agendamentos_barbearia_data_horario_idx
  on locaalbarber.agendamentos (barbearia_id, data_agendamento, horario_inicio);

create index if not exists agendamentos_cliente_id_idx
  on locaalbarber.agendamentos (cliente_id);

create index if not exists agendamentos_servico_id_idx
  on locaalbarber.agendamentos (servico_id);

create index if not exists agendamentos_funcionario_id_idx
  on locaalbarber.agendamentos (funcionario_id);

create index if not exists transacoes_barbearia_data_idx
  on locaalbarber.transacoes (barbearia_id, data_transacao desc);

create index if not exists transacoes_barbearia_status_tipo_data_idx
  on locaalbarber.transacoes (barbearia_id, status, tipo, data_transacao);

create index if not exists transacoes_cliente_id_idx
  on locaalbarber.transacoes (cliente_id);

create index if not exists transacoes_servico_id_idx
  on locaalbarber.transacoes (servico_id);

create index if not exists transacoes_funcionario_id_idx
  on locaalbarber.transacoes (funcionario_id);

create index if not exists avaliacoes_funcionario_id_idx
  on locaalbarber.avaliacoes (funcionario_id);

create index if not exists funcionario_servicos_servico_id_idx
  on locaalbarber.funcionario_servicos (servico_id);

create index if not exists notificacoes_agendamento_id_idx
  on locaalbarber.notificacoes (agendamento_id);

