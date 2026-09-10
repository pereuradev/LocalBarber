-- Mudanças aditivas: preserva registros e a tabela antiga.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = locaalbarber, extensions, public;

ALTER TABLE locaalbarber.usuarios ADD COLUMN versao_sessao bigint NOT NULL DEFAULT 1;
CREATE FUNCTION locaalbarber.revogar_sessoes_apos_senha() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.senha_hash IS DISTINCT FROM OLD.senha_hash THEN
        NEW.versao_sessao := OLD.versao_sessao + 1;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER usuarios_revogar_sessoes BEFORE UPDATE OF senha_hash ON locaalbarber.usuarios
FOR EACH ROW EXECUTE FUNCTION locaalbarber.revogar_sessoes_apos_senha();

ALTER TABLE locaalbarber.agendamentos
    ADD CONSTRAINT agendamentos_intervalo_valido CHECK (horario_fim > horario_inicio),
    ADD CONSTRAINT agendamentos_sem_sobreposicao EXCLUDE USING gist (
        barbearia_id WITH =,
        funcionario_id WITH =,
        tsrange(data_agendamento + horario_inicio, data_agendamento + horario_fim, '[)') WITH &&
    ) WHERE (status <> 'cancelado' AND funcionario_id IS NOT NULL);

CREATE FUNCTION locaalbarber.validar_expediente_agendamento() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
    -- Alterar observações ou concluir um atendimento antigo não reescreve seu expediente.
    IF TG_OP = 'UPDATE' AND OLD.status <> 'cancelado'
       AND (NEW.barbearia_id, NEW.funcionario_id, NEW.data_agendamento, NEW.horario_inicio, NEW.horario_fim)
           IS NOT DISTINCT FROM
           (OLD.barbearia_id, OLD.funcionario_id, OLD.data_agendamento, OLD.horario_inicio, OLD.horario_fim)
    THEN RETURN NEW; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM locaalbarber.horarios_funcionamento h
        WHERE h.barbearia_id = NEW.barbearia_id
          AND h.dia_semana = extract(dow FROM NEW.data_agendamento)::int
          AND h.ativo AND NEW.horario_inicio >= h.abertura AND NEW.horario_fim <= h.fechamento
    ) THEN
        RAISE EXCEPTION 'Agendamento fora do horário de funcionamento.'
            USING ERRCODE = '23514', CONSTRAINT = 'agendamentos_expediente';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER agendamentos_validar_expediente BEFORE INSERT OR UPDATE ON locaalbarber.agendamentos
FOR EACH ROW EXECUTE FUNCTION locaalbarber.validar_expediente_agendamento();

ALTER TABLE locaalbarber.transacoes
    ADD COLUMN chave_idempotencia uuid,
    ADD COLUMN requisicao_hash text;
CREATE UNIQUE INDEX transacoes_idempotencia_uniq
ON locaalbarber.transacoes (barbearia_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;

-- Métricas derivadas: cancelamentos, pagamentos e troca de cliente refletem na próxima consulta.
CREATE VIEW locaalbarber.clientes_com_metricas WITH (security_invoker = true) AS
SELECT c.id, c.barbearia_id, c.nome, c.cpf, c.email, c.telefone, c.cidade,
       c.observacoes, c.ativo, c.created_at, c.updated_at,
       a.ultima_visita, coalesce(a.total_visitas, 0)::int AS total_visitas,
       coalesce(t.total_gasto, 0)::numeric AS total_gasto
FROM locaalbarber.clientes c
LEFT JOIN (
    SELECT barbearia_id, cliente_id, max(data_agendamento) AS ultima_visita, count(*) AS total_visitas
    FROM locaalbarber.agendamentos WHERE status = 'concluido' GROUP BY barbearia_id, cliente_id
) a ON a.barbearia_id = c.barbearia_id AND a.cliente_id = c.id
LEFT JOIN (
    SELECT barbearia_id, cliente_id, sum(valor) AS total_gasto
    FROM locaalbarber.transacoes WHERE tipo = 'entrada' AND status = 'concluido'
    GROUP BY barbearia_id, cliente_id
) t ON t.barbearia_id = c.barbearia_id AND t.cliente_id = c.id;

CREATE FUNCTION locaalbarber.cnpj_valido(documento text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = '' AS $$
DECLARE
    digitos text := regexp_replace(documento, '[^0-9]', '', 'g');
    pesos int[]; soma int; resto int; digito int; etapa int; posicao int;
BEGIN
    IF documento !~ '^(\d{14}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$'
       OR length(digitos) <> 14 OR digitos ~ '^([0-9])\1{13}$' THEN RETURN false; END IF;
    FOR etapa IN 1..2 LOOP
        pesos := CASE WHEN etapa = 1 THEN ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]
                      ELSE ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2] END;
        soma := 0;
        FOR posicao IN 1..array_length(pesos,1) LOOP
            soma := soma + substr(digitos,posicao,1)::int * pesos[posicao];
        END LOOP;
        resto := soma % 11;
        digito := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;
        IF substr(digitos,12+etapa,1)::int <> digito THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
END;
$$;
CREATE UNIQUE INDEX barbearias_cnpj_normalizado_uniq
ON locaalbarber.barbearias ((regexp_replace(documento, '[^0-9]', '', 'g')));

CREATE TABLE locaalbarber.contas_legadas_migradas (
    origem_id bigint PRIMARY KEY,
    barbearia_id uuid NOT NULL REFERENCES locaalbarber.barbearias(id),
    usuario_id uuid NOT NULL REFERENCES locaalbarber.usuarios(id),
    migrado_em timestamptz NOT NULL DEFAULT now()
);
-- Copia apenas contas que ainda não possuem correspondência; nunca sobrepõe conta atual.
DO $$
DECLARE legado record; nova_barbearia uuid; novo_usuario uuid;
BEGIN
    IF to_regclass('public.barbearias') IS NULL THEN RETURN; END IF;
    FOR legado IN EXECUTE 'SELECT * FROM public.barbearias ORDER BY id' LOOP
        IF EXISTS (SELECT 1 FROM locaalbarber.contas_legadas_migradas WHERE origem_id = legado.id) THEN
            CONTINUE;
        END IF;
        IF EXISTS (SELECT 1 FROM locaalbarber.usuarios WHERE lower(email) = lower(legado.email))
           OR EXISTS (SELECT 1 FROM locaalbarber.barbearias
                      WHERE regexp_replace(documento,'[^0-9]','','g') = regexp_replace(legado.cnpj,'[^0-9]','','g')) THEN
            RAISE EXCEPTION 'Conta legada requer conciliação antes da migração: origem %', legado.id;
        END IF;
        IF legado.senha IS NULL OR legado.senha !~ '^\$2[aby]\$[0-9]{2}\$.{53}$' THEN
            RAISE EXCEPTION 'Hash legado não suportado: origem %', legado.id;
        END IF;
        INSERT INTO locaalbarber.barbearias (razao_social,nome_fantasia,documento,email,telefone,status)
        VALUES (legado.razao_social,legado.nome_fantasia,legado.cnpj,lower(legado.email),legado.telefone,'ativa')
        RETURNING id INTO nova_barbearia;
        INSERT INTO locaalbarber.enderecos_barbearia
            (barbearia_id,cep,logradouro,numero,bairro,cidade,uf)
        VALUES (nova_barbearia,legado.cep,legado.endereco,legado.numero,legado.bairro,legado.cidade,legado.uf);
        INSERT INTO locaalbarber.usuarios (barbearia_id,nome,email,telefone,senha_hash,papel,ativo)
        VALUES (nova_barbearia,coalesce(nullif(legado.nome_representante,''),legado.nome_fantasia),
                lower(legado.email),legado.telefone_representante,legado.senha,'admin',true)
        RETURNING id INTO novo_usuario;
        INSERT INTO locaalbarber.contas_legadas_migradas (origem_id,barbearia_id,usuario_id)
        VALUES (legado.id,nova_barbearia,novo_usuario);
    END LOOP;
END;
$$;

-- O legado pode conter documento inválido. Preservamos o original; novas inscrições
-- e alterações do documento precisam passar pela validação, sem bloquear edições de outros campos.
CREATE FUNCTION locaalbarber.validar_documento_barbearia() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.documento IS NOT DISTINCT FROM OLD.documento THEN RETURN NEW; END IF;
    IF NEW.documento IS NULL OR NOT locaalbarber.cnpj_valido(NEW.documento) THEN
        RAISE EXCEPTION 'Informe um CNPJ válido.'
            USING ERRCODE = '23514', CONSTRAINT = 'barbearias_cnpj_valido';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER barbearias_validar_documento BEFORE INSERT OR UPDATE OF documento
ON locaalbarber.barbearias FOR EACH ROW EXECUTE FUNCTION locaalbarber.validar_documento_barbearia();

-- Somente o backend via PostgreSQL acessa este schema; não é liberado à Data API.
REVOKE ALL ON SCHEMA locaalbarber FROM PUBLIC;
REVOKE ALL ON locaalbarber.contas_legadas_migradas FROM PUBLIC;
REVOKE ALL ON FUNCTION locaalbarber.cnpj_valido(text) FROM PUBLIC;
ALTER FUNCTION locaalbarber.set_updated_at() SET search_path = '';
