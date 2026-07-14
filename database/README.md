# Banco de dados LocalBarber

Este diretório contém as migrações do schema `locaalbarber` usado pelo TCC. O banco principal é PostgreSQL hospedado no Supabase; as tabelas da aplicação ficam isoladas nesse schema.

## Arquivos

- `001_create_localbarber_schema.sql`: cria a estrutura inicial do banco;
- `002_repair_localbarber_schema.sql`: completa e corrige um banco existente sem apagar os dados.

## Estrutura criada

As migrações incluem as tabelas:

- `barbearias`;
- `enderecos_barbearia`;
- `usuarios`;
- `clientes`;
- `categorias_servico`;
- `servicos`;
- `funcionarios`;
- `funcionario_servicos`;
- `horarios_funcionamento`;
- `redes_sociais`;
- `agendamentos`;
- `caixas`;
- `categorias_financeiras`;
- `transacoes`;
- `produtos_estoque`;
- `movimentacoes_estoque`;
- `avaliacoes`;
- `notificacoes`.

Também são criadas views de apoio ao dashboard, à agenda e ao faturamento.

## Como aplicar no Supabase

1. Abra o projeto no Supabase.
2. Entre no **SQL Editor**.
3. Copie todo o conteúdo de `001_create_localbarber_schema.sql`.
4. Execute o script.
5. Para corrigir um banco já existente, execute depois `002_repair_localbarber_schema.sql`.

Por segurança, a migração de reparo não cria usuários com senha padrão. Crie o primeiro administrador pelo formulário `cadastro-empresa.php`, que gera a senha com `password_hash()`.

## Configuração da conexão

Os dados reais da conexão devem existir somente no arquivo `.env` localizado na raiz do projeto. Use `../.env.example` como modelo e nunca envie o `.env` ao GitHub.

Quando a rede local não oferecer IPv6, use os dados de **Session Pooler** exibidos no painel do seu próprio projeto Supabase.
