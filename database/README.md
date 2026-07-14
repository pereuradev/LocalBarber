# Banco de dados LocalBarber

Este diretorio guarda a migracao inicial do schema `locaalbarber` do TCC.

No Supabase, o banco principal do projeto continua sendo o Postgres gerenciado pelo projeto. O nome `locaalbarber` foi criado como schema, que e onde ficam as tabelas do sistema.

- `001_create_localbarber_schema.sql`
- `002_repair_localbarber_schema.sql`

Ela cria as tabelas principais do sistema dentro do schema `locaalbarber`:

- `barbearias`
- `enderecos_barbearia`
- `usuarios`
- `clientes`
- `categorias_servico`
- `servicos`
- `funcionarios`
- `funcionario_servicos`
- `horarios_funcionamento`
- `redes_sociais`
- `agendamentos`
- `caixas`
- `categorias_financeiras`
- `transacoes`
- `produtos_estoque`
- `movimentacoes_estoque`
- `avaliacoes`
- `notificacoes`

Tambem cria views para dashboard/faturamento:

- `vw_faturamento_diario`
- `vw_rank_servicos`
- `vw_clientes_resumo`

O arquivo `002_repair_localbarber_schema.sql` deve ser usado quando o banco ja
existe e precisa ser corrigido sem apagar dados. Ele:

- completa colunas essenciais usadas por cadastro e login;
- garante usuario admin com senha hash para barbearias que tenham email;
- corrige usuarios ativos sem senha;
- cria indices auxiliares para email/documento;
- recria triggers de `updated_at`;
- adiciona as views `vw_dashboard_resumo` e `vw_agenda_dia`.

## Como aplicar no Supabase

1. Abra o projeto no Supabase.
2. Va em `SQL Editor`.
3. Abra o arquivo `database/001_create_localbarber_schema.sql`.
4. Copie o conteudo inteiro.
5. Cole no SQL Editor e clique em `Run`.

Para corrigir um banco que ja foi criado, rode depois o arquivo:

```txt
database/002_repair_localbarber_schema.sql
```

Senha inicial dos usuarios admin criados/corrigidos pelo reparo: `123456`.

## Observacao sobre conexao local

O host direto do Supabase costuma usar IPv6:

```txt
db.rkxqylhrwyxuockhsoad.supabase.co
```

Se a rede local for apenas IPv4, use a connection string `Session pooler` do Supabase Dashboard e configure estas variaveis antes de rodar o PHP:

```txt
SUPABASE_DB_HOST=aws-0-SUA-REGIAO.pooler.supabase.com
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.rkxqylhrwyxuockhsoad
SUPABASE_DB_PASSWORD=sua-senha-do-banco
SUPABASE_DB_SCHEMA=locaalbarber
```
