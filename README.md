# LocalBarber

Portal de gestão de barbearias em PHP, JavaScript e PostgreSQL/Supabase. O navegador acessa as APIs PHP; os dados de negócio ficam no schema privado `locaalbarber` (grafia original).

## Ambiente local

1. Use PHP 8.0 ou superior com `pdo_pgsql`, `curl` e `mbstring`. A compatibilidade foi testada no PHP 8.0.30 do XAMPP. Para produção, use uma versão PHP ainda mantida e repita os testes.
2. Copie `.env.example` para `.env` e preencha a conexão PostgreSQL localmente. Não envie nem versione senhas. Se a conexão direta não funcionar em sua rede, use os dados do **Session pooler** fornecidos pelo painel Supabase.
3. Sirva esta pasta pelo Apache/XAMPP, com `AllowOverride All` para respeitar os `.htaccess`. Não use `file://`. O servidor PHP embutido não aplica essas proteções: não o exponha à rede.
4. Execute `C:\xampp\php\php.exe tools/verificar-conexao.php`. O schema/migração abaixo precisa estar instalado antes de usar as APIs.
5. Acesse `index.html`, entre e configure o expediente em **Minha Barbearia** antes de agendar.

Nesta máquina, `C:\xampp\htdocs\LocalBarber` é uma junção para `C:\Users\pietro.pereira\Documents\LocalBarber`. O site está em `http://localhost/LocalBarber/`: editar o repositório atualiza diretamente a pasta servida, sem copiar arquivos. A cópia anterior do XAMPP foi preservada em `C:\Users\pietro.pereira\Documents\LocalBarber-xampp-backup-20260910-163443`, fora da pasta pública. Mantenha o Apache ativo e não mova a pasta de destino da junção sem atualizar o vínculo.

As configurações do Google/Supabase Auth continuam em `config/supabase-auth.php` e `assets/js/supabase-auth.js`. Não coloque uma chave `service_role` no navegador. Nesta cópia local, o `.env` foi configurado e a conexão pelo Session pooler foi validada em 10/09/2026, incluindo as oito consultas GET via PDO, em transação somente de leitura. O login real e o OAuth ainda precisam ser validados com uma conta da aplicação; a senha do banco não é a senha de login do portal.

## Banco de dados

Em 10/09/2026, a migração `20260910190149_corrigir_integridade_localbarber.sql` foi aplicada ao projeto Supabase LocalBarber conectado. A conta legada foi migrada, com hash de senha e tabela de origem preservados. O arquivo local corresponde à versão registrada pelo Supabase; não o reaplique nesse banco.

- `database/schema.sql`: estrutura inicial, sem dados. Execute **somente em um banco vazio**, sem `locaalbarber`.
- `supabase/migrations/`: alterações versionadas, em ordem de nome. Para uma instalação nova, aplique a estrutura inicial e depois as migrações. Em banco existente, nunca reaplique a estrutura inicial nem uma migração já registrada.
- Faça backup e confira conflitos antes de migrar outra instalação. A alteração da agenda cria constraints e pode exigir uma janela de manutenção em bases grandes.
- A migração de integridade preserva a tabela antiga `public.barbearias`, copia suas contas compatíveis para UUIDs e mantém os hashes de senha. Correspondências ambíguas interrompem a migração, sem mesclar usuários automaticamente.
- Documentos inválidos do legado são preservados e sinalizados na tela; novos CNPJs e alterações devem ser válidos. Não substitua um documento antigo por um número inventado.
- O schema de negócio permanece privado, sem acesso para `anon`/`authenticated`. Se usar um usuário PostgreSQL próprio para o backend, conceda somente os privilégios necessários, incluindo acesso à nova view de métricas.

## Regras corrigidas

- Agenda: intervalos sobrepostos do mesmo profissional são bloqueados inclusive em gravações concorrentes; horários adjacentes são permitidos. Novos agendamentos, remarcações e reativações respeitam o expediente. Cancelados não ocupam horário.
- Editar um agendamento mantém preço, nome do serviço e duração contratados. Trocar o serviço aplica as condições atuais. Atendimentos não atravessam a meia-noite.
- Financeiro: entrada/saída e filtros usam `America/Sao_Paulo`. Os registros históricos não foram deslocados automaticamente, pois não é possível inferir quais foram gravados com fuso errado.
- `total_visitas` e `ultima_visita` são derivados de agendamentos concluídos; `total_gasto` soma entradas concluídas vinculadas ao cliente. Cancelamentos deixam de compor os indicadores. Concluir um agendamento não cria um pagamento automaticamente.
- POST de `api/transacoes.php` exige `Idempotency-Key` UUID. Repetir a chave com os mesmos dados retorna a operação original; outros dados retornam 409. O navegador reaproveita a chave após falha de rede enquanto a página permanece aberta. Recarregar a página não preserva essa chave.
- Alterar senha revoga outras sessões na próxima requisição. A sessão usada na troca continua ativa. As sessões anteriores à migração precisam entrar novamente.
- Clientes, serviços, equipe e transações têm paginação (`pagina`, `por_pagina`, máximo 100 por página). A busca de clientes nos formulários consulta a base completa e pede refinamento quando há mais de 50 resultados.
- Falha temporária ao verificar a sessão não redireciona para login. Resposta 401 continua encerrando o acesso visual.

## Testes

Com Node.js disponível:

```powershell
node tests/run.cjs
```

`PHP_BINARY` permite selecionar outro PHP. Os testes locais cobrem sintaxe, validações, revogação de sessão, handlers de gravação, proteção contra duplo envio, fuso e referências das telas. Também iniciam um servidor PHP temporário apenas em loopback para verificar respostas JSON 503, forçando uma configuração inválida antes de conectar. Os testes de handlers usam PDO simulado; não substituem integração com PostgreSQL.

Para testar a interface, disponibilize Playwright no ambiente de testes e seu navegador Chromium. Se necessário, configure `BROWSER_EXECUTABLE` com o caminho do Edge/Chrome instalado:

```powershell
$env:BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node tests/run.cjs --browser
```

Esse teste usa APIs simuladas, navegador em fuso UTC e larguras 1366/390 px. Verifica paginação, seleção histórica, busca de clientes, horário financeiro e aviso do CNPJ legado. Não autentica nem modifica dados reais.

Para o teste PostgreSQL, `node tests/montar-sql.cjs` imprime o SQL de ensaio. Execute a saída inteira, em uma única conexão de teste, com interrupção em erro (`psql -v ON_ERROR_STOP=1`). Ela cria um schema isolado, aplica estrutura/migrações, insere dados fictícios, executa as oito consultas GET reais e termina em `ROLLBACK`. A sessão precisa poder criar schemas e a extensão `btree_gist`. Em caso de erro, execute `ROLLBACK` ou feche a conexão. Não execute apenas trechos do ensaio.

O ensaio verifica CNPJ, versão de sessão, sobreposição parcial, expediente, reativação, cancelamentos, métricas, idempotência, fuso e paginação além de 250 clientes. Login real, OAuth Google e consultas externas de CNPJ continuam exigindo ambiente e credenciais configurados.
