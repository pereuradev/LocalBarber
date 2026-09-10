-- Estrutura inicial sem dados. Executar apenas em banco sem o schema locaalbarber.
BEGIN;
CREATE SCHEMA locaalbarber;
CREATE TABLE locaalbarber.agendamentos (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
codigo text,
cliente_id uuid,
servico_id uuid,
funcionario_id uuid,
nome_cliente_snapshot text NOT NULL,
telefone_cliente_snapshot text,
servico_snapshot text NOT NULL,
data_agendamento date NOT NULL,
horario_inicio time without time zone NOT NULL,
horario_fim time without time zone,
status text DEFAULT 'pendente'::text NOT NULL,
observacoes text,
valor_previsto numeric(10,2) DEFAULT 0 NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.avaliacoes (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
cliente_id uuid,
funcionario_id uuid,
servico_id uuid,
agendamento_id uuid,
nota smallint NOT NULL,
comentario text,
created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.barbearias (id uuid DEFAULT gen_random_uuid() NOT NULL,
razao_social text,
nome_fantasia text NOT NULL,
documento text,
categoria text DEFAULT 'Barbearia'::text NOT NULL,
email text,
telefone text,
descricao text,
logo_url text,
status text DEFAULT 'ativa'::text NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
cor_tema text DEFAULT '#244BC5'::text NOT NULL);

CREATE TABLE locaalbarber.caixas (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
aberto_por uuid,
fechado_por uuid,
data_abertura timestamp with time zone DEFAULT now() NOT NULL,
data_fechamento timestamp with time zone,
saldo_inicial numeric(12,2) DEFAULT 0 NOT NULL,
saldo_final numeric(12,2),
status text DEFAULT 'aberto'::text NOT NULL,
observacoes text,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.categorias_financeiras (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
nome text NOT NULL,
tipo text NOT NULL,
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.categorias_servico (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
nome text NOT NULL,
descricao text,
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.clientes (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
nome text NOT NULL,
email text,
telefone text NOT NULL,
cidade text,
observacoes text,
ultima_visita date,
total_visitas integer DEFAULT 0 NOT NULL,
total_gasto numeric(12,2) DEFAULT 0 NOT NULL,
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
cpf text);

CREATE TABLE locaalbarber.enderecos_barbearia (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
cep text,
logradouro text,
numero text,
complemento text,
bairro text,
cidade text,
uf character(2),
pais text DEFAULT 'Brasil'::text NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.funcionario_servicos (funcionario_id uuid NOT NULL,
servico_id uuid NOT NULL,
preco_personalizado numeric(10,2),
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.funcionarios (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
usuario_id uuid,
nome text NOT NULL,
telefone text,
email text,
funcao text DEFAULT 'Barbeiro'::text NOT NULL,
status text DEFAULT 'offline'::text NOT NULL,
comissao_padrao_percentual numeric(5,2) DEFAULT 50 NOT NULL,
cortes_hoje integer DEFAULT 0 NOT NULL,
cortes_mes integer DEFAULT 0 NOT NULL,
desempenho_percentual numeric(5,2) DEFAULT 0 NOT NULL,
avaliacao_media numeric(3,2) DEFAULT 5 NOT NULL,
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
cpf text);

CREATE TABLE locaalbarber.horarios_funcionamento (barbearia_id uuid NOT NULL,
dia_semana smallint NOT NULL,
abertura time without time zone,
fechamento time without time zone,
ativo boolean DEFAULT true NOT NULL,
observacao text,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.movimentacoes_estoque (id uuid DEFAULT gen_random_uuid() NOT NULL,
produto_id uuid NOT NULL,
tipo text NOT NULL,
quantidade numeric(10,2) NOT NULL,
valor_unitario numeric(10,2),
motivo text,
data_movimentacao timestamp with time zone DEFAULT now() NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.notificacoes (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
cliente_id uuid,
agendamento_id uuid,
canal text DEFAULT 'whatsapp'::text NOT NULL,
mensagem text NOT NULL,
status text DEFAULT 'pendente'::text NOT NULL,
agendada_para timestamp with time zone,
enviada_em timestamp with time zone,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.produtos_estoque (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
nome text NOT NULL,
categoria text,
quantidade_atual numeric(10,2) DEFAULT 0 NOT NULL,
quantidade_minima numeric(10,2) DEFAULT 0 NOT NULL,
custo_unitario numeric(10,2) DEFAULT 0 NOT NULL,
preco_venda numeric(10,2),
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.redes_sociais (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
plataforma text NOT NULL,
identificador text,
url text,
ativo boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.servicos (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
categoria_id uuid,
nome text NOT NULL,
descricao text,
preco numeric(10,2) DEFAULT 0 NOT NULL,
duracao_minutos integer DEFAULT 30 NOT NULL,
comissao_percentual numeric(5,2) DEFAULT 50 NOT NULL,
imagem_url text,
ativo boolean DEFAULT true NOT NULL,
total_atendimentos integer DEFAULT 0 NOT NULL,
avaliacao_media numeric(3,2) DEFAULT 5 NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.transacoes (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid NOT NULL,
caixa_id uuid,
categoria_financeira_id uuid,
agendamento_id uuid,
cliente_id uuid,
servico_id uuid,
funcionario_id uuid,
codigo text,
tipo text DEFAULT 'entrada'::text NOT NULL,
descricao text NOT NULL,
metodo_pagamento text DEFAULT 'pix'::text NOT NULL,
valor numeric(12,2) NOT NULL,
status text DEFAULT 'concluido'::text NOT NULL,
data_transacao timestamp with time zone DEFAULT now() NOT NULL,
observacoes text,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE locaalbarber.usuarios (id uuid DEFAULT gen_random_uuid() NOT NULL,
barbearia_id uuid,
nome text NOT NULL,
email text NOT NULL,
telefone text,
senha_hash text,
papel text DEFAULT 'admin'::text NOT NULL,
ativo boolean DEFAULT true NOT NULL,
ultimo_acesso_at timestamp with time zone,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_barbearia_id_codigo_key UNIQUE (barbearia_id, codigo);
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'confirmado'::text, 'parcial'::text, 'concluido'::text, 'cancelado'::text])));
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_valor_check CHECK ((valor_previsto >= (0)::numeric));
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_nota_check CHECK (((nota >= 1) AND (nota <= 5)));
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.barbearias ADD CONSTRAINT barbearias_cor_tema_check CHECK ((cor_tema ~* '^#[0-9a-f]{6}$'::text));
ALTER TABLE locaalbarber.barbearias ADD CONSTRAINT barbearias_documento_key UNIQUE (documento);
ALTER TABLE locaalbarber.barbearias ADD CONSTRAINT barbearias_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.barbearias ADD CONSTRAINT barbearias_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'inativa'::text, 'suspensa'::text])));
ALTER TABLE locaalbarber.caixas ADD CONSTRAINT caixas_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.caixas ADD CONSTRAINT caixas_status_check CHECK ((status = ANY (ARRAY['aberto'::text, 'fechado'::text])));
ALTER TABLE locaalbarber.categorias_financeiras ADD CONSTRAINT categorias_financeiras_barbearia_id_nome_tipo_key UNIQUE (barbearia_id, nome, tipo);
ALTER TABLE locaalbarber.categorias_financeiras ADD CONSTRAINT categorias_financeiras_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.categorias_financeiras ADD CONSTRAINT categorias_financeiras_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE locaalbarber.categorias_servico ADD CONSTRAINT categorias_servico_barbearia_id_nome_key UNIQUE (barbearia_id, nome);
ALTER TABLE locaalbarber.categorias_servico ADD CONSTRAINT categorias_servico_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.clientes ADD CONSTRAINT clientes_barbearia_id_telefone_key UNIQUE (barbearia_id, telefone);
ALTER TABLE locaalbarber.clientes ADD CONSTRAINT clientes_cpf_formato_check CHECK (((cpf IS NULL) OR (cpf ~ '^[0-9]{11}$'::text)));
ALTER TABLE locaalbarber.clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.clientes ADD CONSTRAINT clientes_total_gasto_check CHECK ((total_gasto >= (0)::numeric));
ALTER TABLE locaalbarber.clientes ADD CONSTRAINT clientes_total_visitas_check CHECK ((total_visitas >= 0));
ALTER TABLE locaalbarber.enderecos_barbearia ADD CONSTRAINT enderecos_barbearia_barbearia_id_key UNIQUE (barbearia_id);
ALTER TABLE locaalbarber.enderecos_barbearia ADD CONSTRAINT enderecos_barbearia_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.funcionario_servicos ADD CONSTRAINT funcionario_servicos_pkey PRIMARY KEY (funcionario_id, servico_id);
ALTER TABLE locaalbarber.funcionario_servicos ADD CONSTRAINT funcionario_servicos_preco_check CHECK (((preco_personalizado IS NULL) OR (preco_personalizado >= (0)::numeric)));
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_barbearia_id_email_key UNIQUE (barbearia_id, email);
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_comissao_check CHECK (((comissao_padrao_percentual >= (0)::numeric) AND (comissao_padrao_percentual <= (100)::numeric)));
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_cpf_formato_check CHECK (((cpf IS NULL) OR (cpf ~ '^[0-9]{11}$'::text)));
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_status_check CHECK ((status = ANY (ARRAY['online'::text, 'busy'::text, 'offline'::text])));
ALTER TABLE locaalbarber.horarios_funcionamento ADD CONSTRAINT horarios_abertura_fechamento_check CHECK (((ativo = false) OR ((abertura IS NOT NULL) AND (fechamento IS NOT NULL) AND (abertura < fechamento))));
ALTER TABLE locaalbarber.horarios_funcionamento ADD CONSTRAINT horarios_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)));
ALTER TABLE locaalbarber.horarios_funcionamento ADD CONSTRAINT horarios_funcionamento_pkey PRIMARY KEY (barbearia_id, dia_semana);
ALTER TABLE locaalbarber.movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_quantidade_check CHECK ((quantidade > (0)::numeric));
ALTER TABLE locaalbarber.movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text, 'ajuste'::text])));
ALTER TABLE locaalbarber.movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_valor_check CHECK (((valor_unitario IS NULL) OR (valor_unitario >= (0)::numeric)));
ALTER TABLE locaalbarber.notificacoes ADD CONSTRAINT notificacoes_canal_check CHECK ((canal = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'sistema'::text])));
ALTER TABLE locaalbarber.notificacoes ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.notificacoes ADD CONSTRAINT notificacoes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'enviada'::text, 'erro'::text, 'cancelada'::text])));
ALTER TABLE locaalbarber.produtos_estoque ADD CONSTRAINT produtos_estoque_barbearia_id_nome_key UNIQUE (barbearia_id, nome);
ALTER TABLE locaalbarber.produtos_estoque ADD CONSTRAINT produtos_estoque_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.produtos_estoque ADD CONSTRAINT produtos_quantidade_check CHECK (((quantidade_atual >= (0)::numeric) AND (quantidade_minima >= (0)::numeric)));
ALTER TABLE locaalbarber.produtos_estoque ADD CONSTRAINT produtos_valor_check CHECK (((custo_unitario >= (0)::numeric) AND ((preco_venda IS NULL) OR (preco_venda >= (0)::numeric))));
ALTER TABLE locaalbarber.redes_sociais ADD CONSTRAINT redes_sociais_barbearia_id_plataforma_key UNIQUE (barbearia_id, plataforma);
ALTER TABLE locaalbarber.redes_sociais ADD CONSTRAINT redes_sociais_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_avaliacao_check CHECK (((avaliacao_media >= (0)::numeric) AND (avaliacao_media <= (5)::numeric)));
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_barbearia_id_nome_key UNIQUE (barbearia_id, nome);
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_comissao_check CHECK (((comissao_percentual >= (0)::numeric) AND (comissao_percentual <= (100)::numeric)));
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_duracao_check CHECK ((duracao_minutos > 0));
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_preco_check CHECK ((preco >= (0)::numeric));
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_barbearia_id_codigo_key UNIQUE (barbearia_id, codigo);
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_metodo_check CHECK ((metodo_pagamento = ANY (ARRAY['pix'::text, 'credito'::text, 'debito'::text, 'dinheiro'::text, 'outro'::text])));
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'confirmado'::text, 'concluido'::text, 'cancelado'::text])));
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_valor_check CHECK ((valor >= (0)::numeric));
ALTER TABLE locaalbarber.usuarios ADD CONSTRAINT usuarios_email_key UNIQUE (email);
ALTER TABLE locaalbarber.usuarios ADD CONSTRAINT usuarios_papel_check CHECK ((papel = ANY (ARRAY['admin'::text, 'colaborador'::text, 'gerente'::text, 'barbeiro'::text, 'recepcao'::text])));
ALTER TABLE locaalbarber.usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES locaalbarber.clientes(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES locaalbarber.funcionarios(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.agendamentos ADD CONSTRAINT agendamentos_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES locaalbarber.servicos(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES locaalbarber.agendamentos(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES locaalbarber.clientes(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES locaalbarber.funcionarios(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.avaliacoes ADD CONSTRAINT avaliacoes_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES locaalbarber.servicos(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.caixas ADD CONSTRAINT caixas_aberto_por_fkey FOREIGN KEY (aberto_por) REFERENCES locaalbarber.usuarios(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.caixas ADD CONSTRAINT caixas_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.caixas ADD CONSTRAINT caixas_fechado_por_fkey FOREIGN KEY (fechado_por) REFERENCES locaalbarber.usuarios(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.categorias_financeiras ADD CONSTRAINT categorias_financeiras_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.categorias_servico ADD CONSTRAINT categorias_servico_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.clientes ADD CONSTRAINT clientes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.enderecos_barbearia ADD CONSTRAINT enderecos_barbearia_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.funcionario_servicos ADD CONSTRAINT funcionario_servicos_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES locaalbarber.funcionarios(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.funcionario_servicos ADD CONSTRAINT funcionario_servicos_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES locaalbarber.servicos(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.funcionarios ADD CONSTRAINT funcionarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES locaalbarber.usuarios(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.horarios_funcionamento ADD CONSTRAINT horarios_funcionamento_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES locaalbarber.produtos_estoque(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.notificacoes ADD CONSTRAINT notificacoes_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES locaalbarber.agendamentos(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.notificacoes ADD CONSTRAINT notificacoes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.notificacoes ADD CONSTRAINT notificacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES locaalbarber.clientes(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.produtos_estoque ADD CONSTRAINT produtos_estoque_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.redes_sociais ADD CONSTRAINT redes_sociais_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.servicos ADD CONSTRAINT servicos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES locaalbarber.categorias_servico(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES locaalbarber.agendamentos(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES locaalbarber.caixas(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_categoria_financeira_id_fkey FOREIGN KEY (categoria_financeira_id) REFERENCES locaalbarber.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES locaalbarber.clientes(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES locaalbarber.funcionarios(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.transacoes ADD CONSTRAINT transacoes_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES locaalbarber.servicos(id) ON DELETE SET NULL;
ALTER TABLE locaalbarber.usuarios ADD CONSTRAINT usuarios_barbearia_id_fkey FOREIGN KEY (barbearia_id) REFERENCES locaalbarber.barbearias(id) ON DELETE CASCADE;
CREATE INDEX agendamentos_barbearia_data_horario_idx ON locaalbarber.agendamentos USING btree (barbearia_id, data_agendamento, horario_inicio);
CREATE INDEX agendamentos_cliente_id_idx ON locaalbarber.agendamentos USING btree (cliente_id);
CREATE INDEX agendamentos_funcionario_id_idx ON locaalbarber.agendamentos USING btree (funcionario_id);
CREATE UNIQUE INDEX agendamentos_horario_funcionario_uniq ON locaalbarber.agendamentos USING btree (barbearia_id, funcionario_id, data_agendamento, horario_inicio) WHERE ((status <> 'cancelado'::text) AND (funcionario_id IS NOT NULL));
CREATE INDEX agendamentos_servico_id_idx ON locaalbarber.agendamentos USING btree (servico_id);
CREATE INDEX avaliacoes_funcionario_id_idx ON locaalbarber.avaliacoes USING btree (funcionario_id);
CREATE INDEX clientes_barbearia_ativo_nome_idx ON locaalbarber.clientes USING btree (barbearia_id, ativo, nome);
CREATE UNIQUE INDEX clientes_barbearia_cpf_uniq ON locaalbarber.clientes USING btree (barbearia_id, cpf) WHERE (cpf IS NOT NULL);
CREATE INDEX funcionario_servicos_servico_id_idx ON locaalbarber.funcionario_servicos USING btree (servico_id);
CREATE INDEX funcionarios_barbearia_ativo_nome_idx ON locaalbarber.funcionarios USING btree (barbearia_id, ativo, nome);
CREATE UNIQUE INDEX funcionarios_barbearia_cpf_uniq ON locaalbarber.funcionarios USING btree (barbearia_id, cpf) WHERE (cpf IS NOT NULL);
CREATE UNIQUE INDEX funcionarios_usuario_id_unique ON locaalbarber.funcionarios USING btree (usuario_id) WHERE (usuario_id IS NOT NULL);
CREATE INDEX notificacoes_agendamento_id_idx ON locaalbarber.notificacoes USING btree (agendamento_id);
CREATE INDEX servicos_barbearia_ativo_nome_idx ON locaalbarber.servicos USING btree (barbearia_id, ativo, nome);
CREATE INDEX servicos_categoria_id_idx ON locaalbarber.servicos USING btree (categoria_id);
CREATE INDEX transacoes_barbearia_data_idx ON locaalbarber.transacoes USING btree (barbearia_id, data_transacao DESC);
CREATE INDEX transacoes_barbearia_status_tipo_data_idx ON locaalbarber.transacoes USING btree (barbearia_id, status, tipo, data_transacao);
CREATE INDEX transacoes_cliente_id_idx ON locaalbarber.transacoes USING btree (cliente_id);
CREATE INDEX transacoes_funcionario_id_idx ON locaalbarber.transacoes USING btree (funcionario_id);
CREATE INDEX transacoes_servico_id_idx ON locaalbarber.transacoes USING btree (servico_id);
CREATE INDEX usuarios_barbearia_ativo_papel_idx ON locaalbarber.usuarios USING btree (barbearia_id, ativo, papel);
CREATE OR REPLACE FUNCTION locaalbarber.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE TRIGGER trg_barbearias_updated_at BEFORE UPDATE ON locaalbarber.barbearias FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_enderecos_barbearia_updated_at BEFORE UPDATE ON locaalbarber.enderecos_barbearia FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON locaalbarber.usuarios FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON locaalbarber.clientes FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_categorias_servico_updated_at BEFORE UPDATE ON locaalbarber.categorias_servico FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_servicos_updated_at BEFORE UPDATE ON locaalbarber.servicos FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_funcionarios_updated_at BEFORE UPDATE ON locaalbarber.funcionarios FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_horarios_funcionamento_updated_at BEFORE UPDATE ON locaalbarber.horarios_funcionamento FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_redes_sociais_updated_at BEFORE UPDATE ON locaalbarber.redes_sociais FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_agendamentos_updated_at BEFORE UPDATE ON locaalbarber.agendamentos FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_caixas_updated_at BEFORE UPDATE ON locaalbarber.caixas FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_categorias_financeiras_updated_at BEFORE UPDATE ON locaalbarber.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_transacoes_updated_at BEFORE UPDATE ON locaalbarber.transacoes FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_produtos_estoque_updated_at BEFORE UPDATE ON locaalbarber.produtos_estoque FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
CREATE TRIGGER trg_notificacoes_updated_at BEFORE UPDATE ON locaalbarber.notificacoes FOR EACH ROW EXECUTE FUNCTION locaalbarber.set_updated_at();
REVOKE ALL ON SCHEMA locaalbarber FROM PUBLIC;
COMMIT;
