-- LocalBarber - schema inicial do banco de dados
-- Projeto TCC: gestao de barbearia com agenda, clientes, equipe e financeiro.

begin;

create extension if not exists pgcrypto;

create schema if not exists locaalbarber;

create or replace function locaalbarber.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists locaalbarber.barbearias (
  id uuid primary key default gen_random_uuid(),
  razao_social text,
  nome_fantasia text not null,
  documento text unique,
  categoria text not null default 'Barbearia',
  email text,
  telefone text,
  descricao text,
  logo_url text,
  cor_tema text not null default '#244BC5',
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbearias_status_check check (status in ('ativa', 'inativa', 'suspensa')),
  constraint barbearias_cor_tema_check check (cor_tema ~* '^#[0-9a-f]{6}$')
);

create table if not exists locaalbarber.enderecos_barbearia (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null unique references locaalbarber.barbearias(id) on delete cascade,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf char(2),
  pais text not null default 'Brasil',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists locaalbarber.usuarios (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid references locaalbarber.barbearias(id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text,
  senha_hash text,
  papel text not null default 'admin',
  ativo boolean not null default true,
  ultimo_acesso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_papel_check check (papel in ('admin', 'colaborador', 'gerente', 'barbeiro', 'recepcao'))
);

create table if not exists locaalbarber.clientes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  nome text not null,
  email text,
  telefone text not null,
  cidade text,
  observacoes text,
  ultima_visita date,
  total_visitas integer not null default 0,
  total_gasto numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_total_visitas_check check (total_visitas >= 0),
  constraint clientes_total_gasto_check check (total_gasto >= 0),
  unique (barbearia_id, telefone)
);

create table if not exists locaalbarber.categorias_servico (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbearia_id, nome)
);

create table if not exists locaalbarber.servicos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  categoria_id uuid references locaalbarber.categorias_servico(id) on delete set null,
  nome text not null,
  descricao text,
  preco numeric(10,2) not null default 0,
  duracao_minutos integer not null default 30,
  comissao_percentual numeric(5,2) not null default 50,
  imagem_url text,
  ativo boolean not null default true,
  total_atendimentos integer not null default 0,
  avaliacao_media numeric(3,2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint servicos_preco_check check (preco >= 0),
  constraint servicos_duracao_check check (duracao_minutos > 0),
  constraint servicos_comissao_check check (comissao_percentual >= 0 and comissao_percentual <= 100),
  constraint servicos_avaliacao_check check (avaliacao_media >= 0 and avaliacao_media <= 5),
  unique (barbearia_id, nome)
);

create table if not exists locaalbarber.funcionarios (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  usuario_id uuid references locaalbarber.usuarios(id) on delete set null,
  nome text not null,
  telefone text,
  email text,
  funcao text not null default 'Barbeiro',
  status text not null default 'offline',
  comissao_padrao_percentual numeric(5,2) not null default 50,
  cortes_hoje integer not null default 0,
  cortes_mes integer not null default 0,
  desempenho_percentual numeric(5,2) not null default 0,
  avaliacao_media numeric(3,2) not null default 5,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funcionarios_status_check check (status in ('online', 'busy', 'offline')),
  constraint funcionarios_comissao_check check (comissao_padrao_percentual >= 0 and comissao_padrao_percentual <= 100),
  unique (barbearia_id, email)
);

create table if not exists locaalbarber.funcionario_servicos (
  funcionario_id uuid not null references locaalbarber.funcionarios(id) on delete cascade,
  servico_id uuid not null references locaalbarber.servicos(id) on delete cascade,
  preco_personalizado numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (funcionario_id, servico_id),
  constraint funcionario_servicos_preco_check check (preco_personalizado is null or preco_personalizado >= 0)
);

create table if not exists locaalbarber.horarios_funcionamento (
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  dia_semana smallint not null,
  abertura time,
  fechamento time,
  ativo boolean not null default true,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (barbearia_id, dia_semana),
  constraint horarios_dia_semana_check check (dia_semana between 0 and 6),
  constraint horarios_abertura_fechamento_check check (
    ativo = false or (abertura is not null and fechamento is not null and abertura < fechamento)
  )
);

create table if not exists locaalbarber.redes_sociais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  plataforma text not null,
  identificador text,
  url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbearia_id, plataforma)
);

create table if not exists locaalbarber.agendamentos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  codigo text,
  cliente_id uuid references locaalbarber.clientes(id) on delete set null,
  servico_id uuid references locaalbarber.servicos(id) on delete set null,
  funcionario_id uuid references locaalbarber.funcionarios(id) on delete set null,
  nome_cliente_snapshot text not null,
  telefone_cliente_snapshot text,
  servico_snapshot text not null,
  data_agendamento date not null,
  horario_inicio time not null,
  horario_fim time,
  status text not null default 'pendente',
  observacoes text,
  valor_previsto numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agendamentos_status_check check (status in ('pendente', 'confirmado', 'parcial', 'concluido', 'cancelado')),
  constraint agendamentos_valor_check check (valor_previsto >= 0),
  unique (barbearia_id, codigo)
);

create unique index if not exists agendamentos_horario_funcionario_uniq
on locaalbarber.agendamentos (barbearia_id, funcionario_id, data_agendamento, horario_inicio)
where status <> 'cancelado' and funcionario_id is not null;

create table if not exists locaalbarber.caixas (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  aberto_por uuid references locaalbarber.usuarios(id) on delete set null,
  fechado_por uuid references locaalbarber.usuarios(id) on delete set null,
  data_abertura timestamptz not null default now(),
  data_fechamento timestamptz,
  saldo_inicial numeric(12,2) not null default 0,
  saldo_final numeric(12,2),
  status text not null default 'aberto',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caixas_status_check check (status in ('aberto', 'fechado'))
);

create table if not exists locaalbarber.categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  nome text not null,
  tipo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categorias_financeiras_tipo_check check (tipo in ('entrada', 'saida')),
  unique (barbearia_id, nome, tipo)
);

create table if not exists locaalbarber.transacoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  caixa_id uuid references locaalbarber.caixas(id) on delete set null,
  categoria_financeira_id uuid references locaalbarber.categorias_financeiras(id) on delete set null,
  agendamento_id uuid references locaalbarber.agendamentos(id) on delete set null,
  cliente_id uuid references locaalbarber.clientes(id) on delete set null,
  servico_id uuid references locaalbarber.servicos(id) on delete set null,
  funcionario_id uuid references locaalbarber.funcionarios(id) on delete set null,
  codigo text,
  tipo text not null default 'entrada',
  descricao text not null,
  metodo_pagamento text not null default 'pix',
  valor numeric(12,2) not null,
  status text not null default 'concluido',
  data_transacao timestamptz not null default now(),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transacoes_tipo_check check (tipo in ('entrada', 'saida')),
  constraint transacoes_metodo_check check (metodo_pagamento in ('pix', 'credito', 'debito', 'dinheiro', 'outro')),
  constraint transacoes_status_check check (status in ('pendente', 'confirmado', 'concluido', 'cancelado')),
  constraint transacoes_valor_check check (valor >= 0),
  unique (barbearia_id, codigo)
);

create table if not exists locaalbarber.produtos_estoque (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  nome text not null,
  categoria text,
  quantidade_atual numeric(10,2) not null default 0,
  quantidade_minima numeric(10,2) not null default 0,
  custo_unitario numeric(10,2) not null default 0,
  preco_venda numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtos_quantidade_check check (quantidade_atual >= 0 and quantidade_minima >= 0),
  constraint produtos_valor_check check (custo_unitario >= 0 and (preco_venda is null or preco_venda >= 0)),
  unique (barbearia_id, nome)
);

create table if not exists locaalbarber.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references locaalbarber.produtos_estoque(id) on delete cascade,
  tipo text not null,
  quantidade numeric(10,2) not null,
  valor_unitario numeric(10,2),
  motivo text,
  data_movimentacao timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint movimentacoes_estoque_tipo_check check (tipo in ('entrada', 'saida', 'ajuste')),
  constraint movimentacoes_estoque_quantidade_check check (quantidade > 0),
  constraint movimentacoes_estoque_valor_check check (valor_unitario is null or valor_unitario >= 0)
);

create table if not exists locaalbarber.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  cliente_id uuid references locaalbarber.clientes(id) on delete set null,
  funcionario_id uuid references locaalbarber.funcionarios(id) on delete set null,
  servico_id uuid references locaalbarber.servicos(id) on delete set null,
  agendamento_id uuid references locaalbarber.agendamentos(id) on delete set null,
  nota smallint not null,
  comentario text,
  created_at timestamptz not null default now(),
  constraint avaliacoes_nota_check check (nota between 1 and 5)
);

create table if not exists locaalbarber.notificacoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references locaalbarber.barbearias(id) on delete cascade,
  cliente_id uuid references locaalbarber.clientes(id) on delete cascade,
  agendamento_id uuid references locaalbarber.agendamentos(id) on delete cascade,
  canal text not null default 'whatsapp',
  mensagem text not null,
  status text not null default 'pendente',
  agendada_para timestamptz,
  enviada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notificacoes_canal_check check (canal in ('email', 'sms', 'whatsapp', 'sistema')),
  constraint notificacoes_status_check check (status in ('pendente', 'enviada', 'erro', 'cancelada'))
);

drop trigger if exists trg_barbearias_updated_at on locaalbarber.barbearias;
create trigger trg_barbearias_updated_at before update on locaalbarber.barbearias
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_enderecos_barbearia_updated_at on locaalbarber.enderecos_barbearia;
create trigger trg_enderecos_barbearia_updated_at before update on locaalbarber.enderecos_barbearia
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_usuarios_updated_at on locaalbarber.usuarios;
create trigger trg_usuarios_updated_at before update on locaalbarber.usuarios
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_clientes_updated_at on locaalbarber.clientes;
create trigger trg_clientes_updated_at before update on locaalbarber.clientes
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_categorias_servico_updated_at on locaalbarber.categorias_servico;
create trigger trg_categorias_servico_updated_at before update on locaalbarber.categorias_servico
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_servicos_updated_at on locaalbarber.servicos;
create trigger trg_servicos_updated_at before update on locaalbarber.servicos
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_funcionarios_updated_at on locaalbarber.funcionarios;
create trigger trg_funcionarios_updated_at before update on locaalbarber.funcionarios
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_horarios_funcionamento_updated_at on locaalbarber.horarios_funcionamento;
create trigger trg_horarios_funcionamento_updated_at before update on locaalbarber.horarios_funcionamento
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_redes_sociais_updated_at on locaalbarber.redes_sociais;
create trigger trg_redes_sociais_updated_at before update on locaalbarber.redes_sociais
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_agendamentos_updated_at on locaalbarber.agendamentos;
create trigger trg_agendamentos_updated_at before update on locaalbarber.agendamentos
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_caixas_updated_at on locaalbarber.caixas;
create trigger trg_caixas_updated_at before update on locaalbarber.caixas
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_categorias_financeiras_updated_at on locaalbarber.categorias_financeiras;
create trigger trg_categorias_financeiras_updated_at before update on locaalbarber.categorias_financeiras
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_transacoes_updated_at on locaalbarber.transacoes;
create trigger trg_transacoes_updated_at before update on locaalbarber.transacoes
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_produtos_estoque_updated_at on locaalbarber.produtos_estoque;
create trigger trg_produtos_estoque_updated_at before update on locaalbarber.produtos_estoque
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_notificacoes_updated_at on locaalbarber.notificacoes;
create trigger trg_notificacoes_updated_at before update on locaalbarber.notificacoes
for each row execute function locaalbarber.set_updated_at();

create or replace view locaalbarber.vw_faturamento_diario as
select
  barbearia_id,
  date_trunc('day', data_transacao)::date as data,
  sum(case when tipo = 'entrada' and status = 'concluido' then valor else 0 end) as faturamento,
  sum(case when tipo = 'saida' and status = 'concluido' then valor else 0 end) as despesas,
  count(*) filter (where tipo = 'entrada' and status = 'concluido') as total_transacoes,
  sum(case when tipo = 'entrada' and status = 'concluido' then valor else 0 end)
    - sum(case when tipo = 'saida' and status = 'concluido' then valor else 0 end) as lucro
from locaalbarber.transacoes
group by barbearia_id, date_trunc('day', data_transacao)::date;

create or replace view locaalbarber.vw_rank_servicos as
select
  s.barbearia_id,
  s.id as servico_id,
  s.nome,
  count(t.id) filter (where t.tipo = 'entrada' and t.status = 'concluido') as total_vendas,
  coalesce(sum(t.valor) filter (where t.tipo = 'entrada' and t.status = 'concluido'), 0) as faturamento
from locaalbarber.servicos s
left join locaalbarber.transacoes t on t.servico_id = s.id
group by s.barbearia_id, s.id, s.nome;

create or replace view locaalbarber.vw_clientes_resumo as
select
  c.id,
  c.barbearia_id,
  c.nome,
  c.email,
  c.telefone,
  c.cidade,
  count(a.id) filter (where a.status = 'concluido') as visitas_calculadas,
  coalesce(sum(t.valor) filter (where t.tipo = 'entrada' and t.status = 'concluido'), 0) as gasto_calculado,
  max(a.data_agendamento) filter (where a.status = 'concluido') as ultima_visita_calculada
from locaalbarber.clientes c
left join locaalbarber.agendamentos a on a.cliente_id = c.id
left join locaalbarber.transacoes t on t.cliente_id = c.id
group by c.id, c.barbearia_id, c.nome, c.email, c.telefone, c.cidade;

-- Esta migração cria apenas a estrutura. Os dados são cadastrados pela aplicação.
