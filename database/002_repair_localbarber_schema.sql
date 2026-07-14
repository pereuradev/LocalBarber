-- LocalBarber - reparo seguro do banco
-- Rode depois do 001_create_localbarber_schema.sql.
-- Nao apaga dados: apenas completa estrutura, indices, views e usuarios admin.

begin;

create extension if not exists pgcrypto;
create schema if not exists locaalbarber;
set search_path to locaalbarber, public;

create or replace function locaalbarber.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Colunas essenciais usadas pelo cadastro/login.
alter table locaalbarber.barbearias
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists documento text,
  add column if not exists categoria text not null default 'Barbearia',
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists descricao text,
  add column if not exists logo_url text,
  add column if not exists status text not null default 'ativa',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table locaalbarber.enderecos_barbearia
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf char(2),
  add column if not exists pais text not null default 'Brasil',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table locaalbarber.usuarios
  add column if not exists barbearia_id uuid references locaalbarber.barbearias(id) on delete cascade,
  add column if not exists nome text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists senha_hash text,
  add column if not exists papel text not null default 'admin',
  add column if not exists ativo boolean not null default true,
  add column if not exists ultimo_acesso_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Defaults importantes caso alguma tabela tenha sido criada manualmente.
alter table locaalbarber.barbearias alter column id set default gen_random_uuid();
alter table locaalbarber.enderecos_barbearia alter column id set default gen_random_uuid();
alter table locaalbarber.usuarios alter column id set default gen_random_uuid();

-- Normalizacao leve de dados para evitar falhas no login e cadastro.
update locaalbarber.barbearias
set
  nome_fantasia = coalesce(nullif(trim(nome_fantasia), ''), 'Barbearia'),
  categoria = coalesce(nullif(trim(categoria), ''), 'Barbearia'),
  status = coalesce(nullif(trim(status), ''), 'ativa')
where nome_fantasia is null
   or trim(nome_fantasia) = ''
   or categoria is null
   or trim(categoria) = ''
   or status is null
   or trim(status) = '';

update locaalbarber.usuarios
set
  nome = coalesce(nullif(trim(nome), ''), 'Administrador'),
  papel = coalesce(nullif(trim(papel), ''), 'admin'),
  ativo = coalesce(ativo, true)
where nome is null
   or trim(nome) = ''
   or papel is null
   or trim(papel) = ''
   or ativo is null;

-- Garante um usuario admin para barbearias que possuem email.
-- Senha inicial: 123456. O PHP consegue validar esse hash com password_verify().
insert into locaalbarber.usuarios (barbearia_id, nome, email, telefone, senha_hash, papel, ativo)
select
  b.id,
  coalesce(nullif(trim(b.nome_fantasia), ''), 'Administrador'),
  lower(trim(b.email)),
  b.telefone,
  crypt('123456', gen_salt('bf')),
  'admin',
  true
from locaalbarber.barbearias b
where b.email is not null
  and trim(b.email) <> ''
  and not exists (
    select 1
    from locaalbarber.usuarios u
    where lower(u.email) = lower(b.email)
  );

-- Corrige usuarios sem senha, incluindo o usuario demo do seed antigo.
update locaalbarber.usuarios
set senha_hash = crypt('123456', gen_salt('bf'))
where ativo = true
  and email is not null
  and (senha_hash is null or trim(senha_hash) = '');

-- Indices usados pelo login/cadastro. Os unicos case-insensitive so sao criados
-- quando nao ha duplicados; assim o reparo nao quebra bancos que ja tenham dados.
create index if not exists idx_barbearias_email_lower
  on locaalbarber.barbearias (lower(email))
  where email is not null;

create index if not exists idx_usuarios_email_lower
  on locaalbarber.usuarios (lower(email))
  where email is not null;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'locaalbarber'
      and indexname = 'usuarios_email_lower_uniq'
  ) and not exists (
    select lower(email)
    from locaalbarber.usuarios
    where email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    execute 'create unique index usuarios_email_lower_uniq on locaalbarber.usuarios (lower(email)) where email is not null';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'locaalbarber'
      and indexname = 'barbearias_documento_uniq'
  ) and not exists (
    select documento
    from locaalbarber.barbearias
    where documento is not null
    group by documento
    having count(*) > 1
  ) then
    execute 'create unique index barbearias_documento_uniq on locaalbarber.barbearias (documento) where documento is not null';
  end if;
end;
$$;

-- Recria triggers de updated_at nas tabelas principais.
drop trigger if exists trg_barbearias_updated_at on locaalbarber.barbearias;
create trigger trg_barbearias_updated_at before update on locaalbarber.barbearias
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_enderecos_barbearia_updated_at on locaalbarber.enderecos_barbearia;
create trigger trg_enderecos_barbearia_updated_at before update on locaalbarber.enderecos_barbearia
for each row execute function locaalbarber.set_updated_at();

drop trigger if exists trg_usuarios_updated_at on locaalbarber.usuarios;
create trigger trg_usuarios_updated_at before update on locaalbarber.usuarios
for each row execute function locaalbarber.set_updated_at();

-- Views que ajudam as telas do painel a consumir dados consolidados.
create or replace view locaalbarber.vw_dashboard_resumo as
with clientes as (
  select barbearia_id, count(*) as total
  from locaalbarber.clientes
  where ativo
  group by barbearia_id
), servicos as (
  select barbearia_id, count(*) as total
  from locaalbarber.servicos
  where ativo
  group by barbearia_id
), funcionarios as (
  select barbearia_id, count(*) as total
  from locaalbarber.funcionarios
  where ativo
  group by barbearia_id
), agenda as (
  select barbearia_id, count(*) as total
  from locaalbarber.agendamentos
  where data_agendamento = current_date
    and status <> 'cancelado'
  group by barbearia_id
), financeiro as (
  select
    barbearia_id,
    coalesce(sum(valor) filter (where tipo = 'entrada' and status = 'concluido'), 0) as faturamento_mes,
    coalesce(sum(valor) filter (where tipo = 'saida' and status = 'concluido'), 0) as despesas_mes
  from locaalbarber.transacoes
  where date_trunc('month', data_transacao) = date_trunc('month', now())
  group by barbearia_id
)
select
  b.id as barbearia_id,
  b.nome_fantasia,
  coalesce(clientes.total, 0) as clientes_ativos,
  coalesce(servicos.total, 0) as servicos_ativos,
  coalesce(funcionarios.total, 0) as funcionarios_ativos,
  coalesce(agenda.total, 0) as agendamentos_hoje,
  coalesce(financeiro.faturamento_mes, 0) as faturamento_mes,
  coalesce(financeiro.despesas_mes, 0) as despesas_mes,
  coalesce(financeiro.faturamento_mes, 0) - coalesce(financeiro.despesas_mes, 0) as lucro_mes
from locaalbarber.barbearias b
left join clientes on clientes.barbearia_id = b.id
left join servicos on servicos.barbearia_id = b.id
left join funcionarios on funcionarios.barbearia_id = b.id
left join agenda on agenda.barbearia_id = b.id
left join financeiro on financeiro.barbearia_id = b.id;

create or replace view locaalbarber.vw_agenda_dia as
select
  a.id,
  a.barbearia_id,
  a.codigo,
  a.data_agendamento,
  a.horario_inicio,
  a.horario_fim,
  a.status,
  a.nome_cliente_snapshot as cliente,
  a.telefone_cliente_snapshot as telefone,
  a.servico_snapshot as servico,
  f.nome as funcionario,
  a.valor_previsto
from locaalbarber.agendamentos a
left join locaalbarber.funcionarios f on f.id = a.funcionario_id;

commit;
