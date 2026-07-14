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
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbearias_status_check check (status in ('ativa', 'inativa', 'suspensa'))
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
  constraint usuarios_papel_check check (papel in ('admin', 'gerente', 'barbeiro', 'recepcao'))
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

-- Dados iniciais para demonstracao do painel.

insert into locaalbarber.barbearias (
  razao_social, nome_fantasia, documento, categoria, email, telefone, descricao, status
) values (
  'LocalBarber JR LTDA',
  'LocalBarber JR',
  '12.345.678/0001-90',
  'Barbearia',
  'joao@localbarber.com.br',
  '(11) 9 9123-4567',
  'Barbearia premium no coracao da cidade, especializada em cortes modernos, degrade e barba.',
  'ativa'
) on conflict (documento) do update set
  razao_social = excluded.razao_social,
  nome_fantasia = excluded.nome_fantasia,
  categoria = excluded.categoria,
  email = excluded.email,
  telefone = excluded.telefone,
  descricao = excluded.descricao,
  status = excluded.status;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.enderecos_barbearia (
  barbearia_id, cep, logradouro, numero, complemento, bairro, cidade, uf, pais
)
select id, '13210-070', 'Rua XV de Novembro', '342', 'Loja 2', 'Centro', 'Jundiai', 'SP', 'Brasil'
from b
on conflict (barbearia_id) do update set
  cep = excluded.cep,
  logradouro = excluded.logradouro,
  numero = excluded.numero,
  complemento = excluded.complemento,
  bairro = excluded.bairro,
  cidade = excluded.cidade,
  uf = excluded.uf,
  pais = excluded.pais;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.usuarios (barbearia_id, nome, email, telefone, senha_hash, papel)
select id, 'Joao Rafael Silva', 'joao@localbarber.com.br', '(11) 9 9123-4567', crypt('123456', gen_salt('bf')), 'admin'
from b
on conflict (email) do update set
  nome = excluded.nome,
  telefone = excluded.telefone,
  senha_hash = coalesce(nullif(locaalbarber.usuarios.senha_hash, ''), excluded.senha_hash),
  papel = excluded.papel,
  ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.horarios_funcionamento (barbearia_id, dia_semana, abertura, fechamento, ativo)
select b.id, v.dia, v.abertura::time, v.fechamento::time, v.ativo
from b
cross join (values
  (0, '09:00', '14:00', false),
  (1, '09:00', '19:00', true),
  (2, '09:00', '19:00', true),
  (3, '09:00', '19:00', true),
  (4, '09:00', '19:00', true),
  (5, '09:00', '20:00', true),
  (6, '08:00', '18:00', true)
) as v(dia, abertura, fechamento, ativo)
on conflict (barbearia_id, dia_semana) do update set
  abertura = excluded.abertura,
  fechamento = excluded.fechamento,
  ativo = excluded.ativo;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.redes_sociais (barbearia_id, plataforma, identificador, url)
select b.id, v.plataforma, v.identificador, v.url
from b
cross join (values
  ('instagram', 'localbarber.jr', 'https://instagram.com/localbarber.jr'),
  ('facebook', 'localbarber.jr', 'https://facebook.com/localbarber.jr'),
  ('whatsapp', '5511991234567', 'https://wa.me/5511991234567'),
  ('site', 'localbarber.com.br', 'https://localbarber.com.br')
) as v(plataforma, identificador, url)
on conflict (barbearia_id, plataforma) do update set
  identificador = excluded.identificador,
  url = excluded.url,
  ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.categorias_servico (barbearia_id, nome, descricao)
select b.id, v.nome, v.descricao
from b
cross join (values
  ('Corte', 'Servicos de corte masculino'),
  ('Barba', 'Aparagem, modelagem e tratamento de barba'),
  ('Combo', 'Combinacoes de corte e barba'),
  ('Tratamento', 'Tratamentos capilares e pigmentacao')
) as v(nome, descricao)
on conflict (barbearia_id, nome) do update set
  descricao = excluded.descricao,
  ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
), dados as (
  select * from (values
    ('Corte Simples', 'Corte tradicional com tesoura ou maquina, finalizacao com produto.', 40.00, 30, 'Corte', 50.00, true, 312, 4.8),
    ('Barba Completa', 'Aparagem e modelagem de barba com navalha, toalha quente e hidratacao.', 35.00, 25, 'Barba', 50.00, true, 248, 4.9),
    ('Corte + Barba', 'Combo completo de corte e barba com desconto especial.', 65.00, 55, 'Combo', 55.00, true, 489, 5.0),
    ('Degrade + Barba', 'Degrade moderno com acabamento perfeito e barba incluida.', 75.00, 60, 'Combo', 55.00, true, 201, 4.7),
    ('Pigmentacao de Barba', 'Coloracao e pigmentacao para disfarcar falhas e uniformizar a barba.', 80.00, 45, 'Tratamento', 60.00, true, 87, 4.6),
    ('Tratamento Capilar', 'Hidratacao profunda, reconstrucao e nutricao dos fios.', 90.00, 50, 'Tratamento', 60.00, false, 43, 4.5)
  ) as v(nome, descricao, preco, duracao, categoria, comissao, ativo, atendimentos, avaliacao)
)
insert into locaalbarber.servicos (
  barbearia_id, categoria_id, nome, descricao, preco, duracao_minutos,
  comissao_percentual, ativo, total_atendimentos, avaliacao_media
)
select
  b.id, c.id, d.nome, d.descricao, d.preco, d.duracao, d.comissao,
  d.ativo, d.atendimentos, d.avaliacao
from b
cross join dados d
left join locaalbarber.categorias_servico c on c.barbearia_id = b.id and c.nome = d.categoria
on conflict (barbearia_id, nome) do update set
  categoria_id = excluded.categoria_id,
  descricao = excluded.descricao,
  preco = excluded.preco,
  duracao_minutos = excluded.duracao_minutos,
  comissao_percentual = excluded.comissao_percentual,
  ativo = excluded.ativo,
  total_atendimentos = excluded.total_atendimentos,
  avaliacao_media = excluded.avaliacao_media;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
), dados as (
  select * from (values
    ('Rafael Mendes', 'rafael@email.com', '(11) 9 9123-4567', 'Jundiai', '2026-05-13'::date, 18, 1240.00),
    ('Lucas Silva', 'lucas@email.com', '(11) 9 8234-5678', 'Sao Paulo', '2026-05-12'::date, 9, 620.00),
    ('Pedro Oliveira', 'pedro@email.com', '(11) 9 7345-6789', 'Campinas', '2026-05-10'::date, 22, 1540.00),
    ('Matheus Costa', 'matheus@email.com', '(11) 9 6456-7890', 'Jundiai', '2026-05-08'::date, 5, 310.00),
    ('Bruno Ferreira', 'bruno@email.com', '(11) 9 5567-8901', 'Indaiatuba', '2026-05-07'::date, 14, 910.00),
    ('Gabriel Neves', 'gabriel@email.com', '(11) 9 4678-9012', 'Jundiai', '2026-05-06'::date, 7, 455.00),
    ('Henrique Lopes', 'henrique@email.com', '(11) 9 3789-0123', 'Vinhedo', '2026-05-05'::date, 31, 2170.00),
    ('Andre Castro', 'andre@email.com', '(11) 9 2890-1234', 'Jundiai', '2026-05-04'::date, 3, 175.00)
  ) as v(nome, email, telefone, cidade, ultima_visita, total_visitas, total_gasto)
)
insert into locaalbarber.clientes (
  barbearia_id, nome, email, telefone, cidade, ultima_visita, total_visitas, total_gasto
)
select b.id, d.nome, d.email, d.telefone, d.cidade, d.ultima_visita, d.total_visitas, d.total_gasto
from b
cross join dados d
on conflict (barbearia_id, telefone) do update set
  nome = excluded.nome,
  email = excluded.email,
  cidade = excluded.cidade,
  ultima_visita = excluded.ultima_visita,
  total_visitas = excluded.total_visitas,
  total_gasto = excluded.total_gasto,
  ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
), dados as (
  select * from (values
    ('Joao Rafael', '(11) 9 9000-0001', 'joao.rafael@localbarber.com.br', 'Barbeiro Senior', 'online', 55.00, 8, 142, 92.00, 4.9),
    ('Carlos Melo', '(11) 9 9000-0002', 'carlos.melo@localbarber.com.br', 'Barbeiro', 'busy', 50.00, 6, 118, 76.00, 4.7),
    ('Felipe Santos', '(11) 9 9000-0003', 'felipe.santos@localbarber.com.br', 'Aprendiz', 'online', 40.00, 4, 68, 52.00, 4.6),
    ('Ana Lima', '(11) 9 9000-0004', 'ana.lima@localbarber.com.br', 'Recepcao', 'offline', 0.00, 0, 0, 88.00, 4.8),
    ('Roberto Dias', '(11) 9 9000-0005', 'roberto.dias@localbarber.com.br', 'Barbeiro', 'online', 50.00, 4, 98, 62.00, 4.5),
    ('Marcos Souza', '(11) 9 9000-0006', 'marcos.souza@localbarber.com.br', 'Barbeiro', 'busy', 50.00, 5, 112, 70.00, 4.8)
  ) as v(nome, telefone, email, funcao, status, comissao, cortes_hoje, cortes_mes, desempenho, avaliacao)
)
insert into locaalbarber.funcionarios (
  barbearia_id, nome, telefone, email, funcao, status, comissao_padrao_percentual,
  cortes_hoje, cortes_mes, desempenho_percentual, avaliacao_media
)
select b.id, d.nome, d.telefone, d.email, d.funcao, d.status, d.comissao, d.cortes_hoje, d.cortes_mes, d.desempenho, d.avaliacao
from b
cross join dados d
on conflict (barbearia_id, email) do update set
  nome = excluded.nome,
  telefone = excluded.telefone,
  funcao = excluded.funcao,
  status = excluded.status,
  comissao_padrao_percentual = excluded.comissao_padrao_percentual,
  cortes_hoje = excluded.cortes_hoje,
  cortes_mes = excluded.cortes_mes,
  desempenho_percentual = excluded.desempenho_percentual,
  avaliacao_media = excluded.avaliacao_media,
  ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.funcionario_servicos (funcionario_id, servico_id)
select f.id, s.id
from b
join locaalbarber.funcionarios f on f.barbearia_id = b.id and f.funcao <> 'Recepcao'
join locaalbarber.servicos s on s.barbearia_id = b.id
on conflict (funcionario_id, servico_id) do update set ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.categorias_financeiras (barbearia_id, nome, tipo)
select b.id, v.nome, v.tipo
from b
cross join (values
  ('Atendimento', 'entrada'),
  ('Produto', 'entrada'),
  ('Estoque', 'saida'),
  ('Comissao', 'saida'),
  ('Operacional', 'saida')
) as v(nome, tipo)
on conflict (barbearia_id, nome, tipo) do update set ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
), u as (
  select u.id from locaalbarber.usuarios u join b on b.id = u.barbearia_id where u.email = 'joao@localbarber.com.br'
)
insert into locaalbarber.caixas (barbearia_id, aberto_por, data_abertura, saldo_inicial, status)
select b.id, u.id, '2026-05-13 08:00:00-03'::timestamptz, 150.00, 'aberto'
from b cross join u
where not exists (
  select 1 from locaalbarber.caixas c where c.barbearia_id = b.id and c.status = 'aberto'
);

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
), dados as (
  select * from (values
    ('AG-0001', 'Rafael Mendes', '(11) 9 9123-4567', 'Corte + Barba', 'Joao Rafael', '2026-05-13'::date, '09:00'::time, 'confirmado', 65.00),
    ('AG-0002', 'Lucas Silva', '(11) 9 8234-5678', 'Corte Simples', 'Carlos Melo', '2026-05-13'::date, '10:00'::time, 'confirmado', 40.00),
    ('AG-0003', 'Pedro Oliveira', '(11) 9 7345-6789', 'Barba Completa', 'Felipe Santos', '2026-05-13'::date, '10:20'::time, 'concluido', 35.00),
    ('AG-0004', 'Matheus Costa', '(11) 9 6456-7890', 'Corte + Barba', 'Joao Rafael', '2026-05-13'::date, '11:30'::time, 'pendente', 65.00),
    ('AG-0005', 'Bruno Ferreira', '(11) 9 5567-8901', 'Corte Simples', 'Roberto Dias', '2026-05-13'::date, '13:00'::time, 'confirmado', 40.00),
    ('AG-0006', 'Gabriel Neves', '(11) 9 4678-9012', 'Degrade + Barba', 'Marcos Souza', '2026-05-13'::date, '14:30'::time, 'pendente', 75.00)
  ) as v(codigo, cliente, telefone, servico, funcionario, data_agendamento, horario_inicio, status, valor)
)
insert into locaalbarber.agendamentos (
  barbearia_id, codigo, cliente_id, servico_id, funcionario_id, nome_cliente_snapshot,
  telefone_cliente_snapshot, servico_snapshot, data_agendamento, horario_inicio,
  horario_fim, status, valor_previsto
)
select
  b.id,
  d.codigo,
  c.id,
  s.id,
  f.id,
  d.cliente,
  d.telefone,
  d.servico,
  d.data_agendamento,
  d.horario_inicio,
  d.horario_inicio + make_interval(mins => coalesce(s.duracao_minutos, 30)),
  d.status,
  d.valor
from b
cross join dados d
left join locaalbarber.clientes c on c.barbearia_id = b.id and c.telefone = d.telefone
left join locaalbarber.servicos s on s.barbearia_id = b.id and s.nome = d.servico
left join locaalbarber.funcionarios f on f.barbearia_id = b.id and f.nome = d.funcionario
on conflict (barbearia_id, codigo) do update set
  cliente_id = excluded.cliente_id,
  servico_id = excluded.servico_id,
  funcionario_id = excluded.funcionario_id,
  nome_cliente_snapshot = excluded.nome_cliente_snapshot,
  telefone_cliente_snapshot = excluded.telefone_cliente_snapshot,
  servico_snapshot = excluded.servico_snapshot,
  data_agendamento = excluded.data_agendamento,
  horario_inicio = excluded.horario_inicio,
  horario_fim = excluded.horario_fim,
  status = excluded.status,
  valor_previsto = excluded.valor_previsto;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
), dados as (
  select * from (values
    ('#0041', 'AG-0001', 'Rafael Mendes', 'Corte + Barba', 'Joao Rafael', 'Atendimento', 'entrada', 'pix', 65.00, 'concluido', '2026-05-13 09:00:00-03'::timestamptz),
    ('#0040', 'AG-0002', 'Lucas Silva', 'Corte Simples', 'Carlos Melo', 'Atendimento', 'entrada', 'credito', 40.00, 'concluido', '2026-05-13 10:00:00-03'::timestamptz),
    ('#0039', 'AG-0003', 'Pedro Oliveira', 'Barba Completa', 'Felipe Santos', 'Atendimento', 'entrada', 'pix', 35.00, 'concluido', '2026-05-13 10:20:00-03'::timestamptz),
    ('#0038', 'AG-0004', 'Matheus Costa', 'Corte + Barba', 'Joao Rafael', 'Atendimento', 'entrada', 'dinheiro', 65.00, 'pendente', '2026-05-13 11:30:00-03'::timestamptz),
    ('#0037', 'AG-0005', 'Bruno Ferreira', 'Corte Simples', 'Roberto Dias', 'Atendimento', 'entrada', 'debito', 40.00, 'confirmado', '2026-05-13 13:00:00-03'::timestamptz),
    ('#0036', 'AG-0006', 'Gabriel Neves', 'Degrade + Barba', 'Marcos Souza', 'Atendimento', 'entrada', 'pix', 75.00, 'pendente', '2026-05-13 14:30:00-03'::timestamptz),
    ('#0035', null, null, 'Reposicao Estoque', null, 'Estoque', 'saida', 'credito', 120.00, 'concluido', '2026-05-13 09:15:00-03'::timestamptz)
  ) as v(codigo, agendamento_codigo, cliente, servico, funcionario, categoria, tipo, metodo, valor, status, data_transacao)
), caixa_aberto as (
  select c.id, c.barbearia_id
  from locaalbarber.caixas c
  join b on b.id = c.barbearia_id
  where c.status = 'aberto'
  order by c.data_abertura desc
  limit 1
)
insert into locaalbarber.transacoes (
  barbearia_id, caixa_id, categoria_financeira_id, agendamento_id, cliente_id,
  servico_id, funcionario_id, codigo, tipo, descricao, metodo_pagamento,
  valor, status, data_transacao
)
select
  b.id,
  caixa_aberto.id,
  cf.id,
  a.id,
  c.id,
  s.id,
  f.id,
  d.codigo,
  d.tipo,
  d.servico,
  d.metodo,
  d.valor,
  d.status,
  d.data_transacao
from b
cross join dados d
left join caixa_aberto on caixa_aberto.barbearia_id = b.id
left join locaalbarber.categorias_financeiras cf on cf.barbearia_id = b.id and cf.nome = d.categoria and cf.tipo = d.tipo
left join locaalbarber.agendamentos a on a.barbearia_id = b.id and a.codigo = d.agendamento_codigo
left join locaalbarber.clientes c on c.barbearia_id = b.id and c.nome = d.cliente
left join locaalbarber.servicos s on s.barbearia_id = b.id and s.nome = d.servico
left join locaalbarber.funcionarios f on f.barbearia_id = b.id and f.nome = d.funcionario
on conflict (barbearia_id, codigo) do update set
  caixa_id = excluded.caixa_id,
  categoria_financeira_id = excluded.categoria_financeira_id,
  agendamento_id = excluded.agendamento_id,
  cliente_id = excluded.cliente_id,
  servico_id = excluded.servico_id,
  funcionario_id = excluded.funcionario_id,
  tipo = excluded.tipo,
  descricao = excluded.descricao,
  metodo_pagamento = excluded.metodo_pagamento,
  valor = excluded.valor,
  status = excluded.status,
  data_transacao = excluded.data_transacao;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.produtos_estoque (
  barbearia_id, nome, categoria, quantidade_atual, quantidade_minima, custo_unitario, preco_venda
)
select b.id, v.nome, v.categoria, v.quantidade_atual, v.quantidade_minima, v.custo_unitario, v.preco_venda
from b
cross join (values
  ('Pomada modeladora', 'Finalizacao', 18, 5, 12.00, 25.00),
  ('Shampoo profissional', 'Tratamento', 10, 3, 28.00, 55.00),
  ('LoÃ§Ã£o pos-barba', 'Barba', 14, 4, 18.00, 39.00)
) as v(nome, categoria, quantidade_atual, quantidade_minima, custo_unitario, preco_venda)
on conflict (barbearia_id, nome) do update set
  categoria = excluded.categoria,
  quantidade_atual = excluded.quantidade_atual,
  quantidade_minima = excluded.quantidade_minima,
  custo_unitario = excluded.custo_unitario,
  preco_venda = excluded.preco_venda,
  ativo = true;

with b as (
  select id from locaalbarber.barbearias where documento = '12.345.678/0001-90'
)
insert into locaalbarber.avaliacoes (
  barbearia_id, cliente_id, funcionario_id, servico_id, agendamento_id, nota, comentario
)
select
  b.id,
  c.id,
  f.id,
  s.id,
  a.id,
  v.nota,
  v.comentario
from b
cross join (values
  ('Rafael Mendes', 'Joao Rafael', 'Corte + Barba', 'AG-0001', 5, 'Atendimento excelente.'),
  ('Lucas Silva', 'Carlos Melo', 'Corte Simples', 'AG-0002', 5, 'Rapido e bem feito.'),
  ('Pedro Oliveira', 'Felipe Santos', 'Barba Completa', 'AG-0003', 4, 'Gostei do acabamento.')
) as v(cliente, funcionario, servico, agendamento_codigo, nota, comentario)
left join locaalbarber.clientes c on c.barbearia_id = b.id and c.nome = v.cliente
left join locaalbarber.funcionarios f on f.barbearia_id = b.id and f.nome = v.funcionario
left join locaalbarber.servicos s on s.barbearia_id = b.id and s.nome = v.servico
left join locaalbarber.agendamentos a on a.barbearia_id = b.id and a.codigo = v.agendamento_codigo
where not exists (
  select 1
  from locaalbarber.avaliacoes av
  where av.barbearia_id = b.id
    and av.agendamento_id = a.id
    and av.cliente_id = c.id
);

commit;

