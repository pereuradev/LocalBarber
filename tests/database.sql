-- Execute dentro de uma transação de teste e termine com ROLLBACK.
-- O executor de testes usa uma cópia temporária do schema; não usa dados de clientes reais.
SET LOCAL time zone 'America/Sao_Paulo';
DO $tests$
DECLARE
    b uuid := '11111111-1111-4111-8111-111111111111';
    u uuid := '22222222-2222-4222-8222-222222222222';
    u2 uuid := '22222222-2222-4222-8222-222222222223';
    c uuid; f uuid; s uuid; a uuid; cancelado uuid; t uuid;
    chave uuid := gen_random_uuid();
    metricas record; quantidade int; versao bigint; cor_um text; cor_dois text;
BEGIN
    IF NOT locaalbarber.cnpj_valido('11222333000181') OR locaalbarber.cnpj_valido('11222333000182') THEN
        RAISE EXCEPTION 'Falha na validação dos dígitos do CNPJ';
    END IF;
    INSERT INTO locaalbarber.barbearias (id,razao_social,nome_fantasia,documento)
    VALUES (b,'Teste automatizado','Teste automatizado','11222333000181');
    BEGIN
        INSERT INTO locaalbarber.barbearias (razao_social,nome_fantasia,documento)
        VALUES ('Duplicado','Duplicado','11.222.333/0001-81');
        RAISE EXCEPTION 'CNPJ duplicado por máscara foi aceito';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO locaalbarber.barbearias (razao_social,nome_fantasia,documento)
        VALUES ('Inválido','Inválido','11222333000182');
        RAISE EXCEPTION 'CNPJ inválido foi aceito';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO locaalbarber.usuarios (id,barbearia_id,nome,email,senha_hash)
    VALUES (u,b,'Teste','teste-automatizado@example.invalid','hash-inicial');
    UPDATE locaalbarber.usuarios SET cor_tema='#0F766E' WHERE id=u;
    INSERT INTO locaalbarber.usuarios (id,barbearia_id,nome,email,senha_hash)
    VALUES (u2,b,'Outro usuário','outro-usuario@example.invalid','hash-inicial');
    SELECT cor_tema INTO cor_um FROM locaalbarber.usuarios WHERE id=u;
    SELECT cor_tema INTO cor_dois FROM locaalbarber.usuarios WHERE id=u2;
    IF cor_um<>'#0F766E' OR cor_dois<>'#244BC5' THEN
        RAISE EXCEPTION 'Preferências de cor não estão separadas por usuário';
    END IF;
    UPDATE locaalbarber.usuarios SET cor_tema='#7C3AED' WHERE id=u2;
    SELECT cor_tema INTO cor_um FROM locaalbarber.usuarios WHERE id=u;
    IF cor_um<>'#0F766E' THEN RAISE EXCEPTION 'A cor de outro usuário foi alterada'; END IF;
    BEGIN
        UPDATE locaalbarber.usuarios SET cor_tema='vermelho' WHERE id=u2;
        RAISE EXCEPTION 'Cor de usuário inválida foi aceita';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE locaalbarber.usuarios SET senha_hash='hash-modificado' WHERE id=u;
    SELECT versao_sessao INTO versao FROM locaalbarber.usuarios WHERE id=u;
    IF versao<>2 THEN RAISE EXCEPTION 'Alteração de senha não revogou sessões'; END IF;
    UPDATE locaalbarber.usuarios SET nome='Nome atualizado',senha_hash='hash-modificado' WHERE id=u;
    SELECT versao_sessao INTO versao FROM locaalbarber.usuarios WHERE id=u;
    IF versao<>2 THEN RAISE EXCEPTION 'Sessão revogada sem mudança de senha'; END IF;

    INSERT INTO locaalbarber.clientes (barbearia_id,nome,telefone) VALUES (b,'Cliente de teste','11900000000') RETURNING id INTO c;
    INSERT INTO locaalbarber.funcionarios (barbearia_id,nome) VALUES (b,'Profissional de teste') RETURNING id INTO f;
    INSERT INTO locaalbarber.servicos (barbearia_id,nome,preco,duracao_minutos)
    VALUES (b,'Corte de teste',50,60) RETURNING id INTO s;
    INSERT INTO locaalbarber.horarios_funcionamento (barbearia_id,dia_semana,abertura,fechamento,ativo)
    SELECT b,dia,'08:00'::time,'18:00'::time,true FROM generate_series(0,6) dia;
    INSERT INTO locaalbarber.agendamentos
        (barbearia_id,codigo,cliente_id,funcionario_id,servico_id,nome_cliente_snapshot,servico_snapshot,data_agendamento,horario_inicio,horario_fim,valor_previsto)
    VALUES (b,'TESTE-A',c,f,s,'Cliente de teste','Corte de teste','2030-01-07','10:00','11:00',50) RETURNING id INTO a;
    BEGIN
        INSERT INTO locaalbarber.agendamentos
            (barbearia_id,codigo,funcionario_id,nome_cliente_snapshot,servico_snapshot,data_agendamento,horario_inicio,horario_fim)
        VALUES (b,'TESTE-CONFLITO',f,'Teste','Corte','2030-01-07','10:30','11:30');
        RAISE EXCEPTION 'Sobreposição parcial foi aceita';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;
    INSERT INTO locaalbarber.agendamentos
        (barbearia_id,codigo,funcionario_id,nome_cliente_snapshot,servico_snapshot,data_agendamento,horario_inicio,horario_fim)
    VALUES (b,'TESTE-ADJACENTE',f,'Teste','Corte','2030-01-07','11:00','12:00');
    BEGIN
        INSERT INTO locaalbarber.agendamentos
            (barbearia_id,codigo,funcionario_id,nome_cliente_snapshot,servico_snapshot,data_agendamento,horario_inicio,horario_fim)
        VALUES (b,'TESTE-FECHADO',f,'Teste','Corte','2030-01-07','07:00','08:00');
        RAISE EXCEPTION 'Atendimento fora do expediente foi aceito';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO locaalbarber.agendamentos
        (barbearia_id,codigo,funcionario_id,nome_cliente_snapshot,servico_snapshot,data_agendamento,horario_inicio,horario_fim,status)
    VALUES (b,'TESTE-CANCELADO',f,'Teste','Corte','2030-01-07','10:15','11:15','cancelado') RETURNING id INTO cancelado;
    BEGIN
        UPDATE locaalbarber.agendamentos SET status='confirmado' WHERE id=cancelado;
        RAISE EXCEPTION 'Reativação ignorou conflito de horário';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;

    UPDATE locaalbarber.agendamentos SET status='concluido' WHERE id=a;
    INSERT INTO locaalbarber.transacoes (barbearia_id,codigo,cliente_id,tipo,descricao,valor,status,data_transacao,chave_idempotencia,requisicao_hash)
    VALUES (b,'TESTE-TX',c,'entrada','Teste',50,'concluido','2030-01-07 10:00:00-03',chave,'hash-teste') RETURNING id INTO t;
    INSERT INTO locaalbarber.transacoes (barbearia_id,codigo,cliente_id,tipo,descricao,valor,status,chave_idempotencia,requisicao_hash)
    VALUES (b,'TESTE-TX-REPETIDO',c,'entrada','Teste',50,'concluido',chave,'hash-teste')
    ON CONFLICT (barbearia_id,chave_idempotencia) WHERE chave_idempotencia IS NOT NULL DO NOTHING;
    SELECT count(*) INTO quantidade FROM locaalbarber.transacoes WHERE barbearia_id=b AND chave_idempotencia=chave;
    IF quantidade<>1 THEN RAISE EXCEPTION 'Transação duplicada'; END IF;
    SELECT * INTO metricas FROM locaalbarber.clientes_com_metricas WHERE id=c;
    IF metricas.total_visitas<>1 OR metricas.ultima_visita<>date '2030-01-07' OR metricas.total_gasto<>50 THEN
        RAISE EXCEPTION 'Indicadores não refletiram atendimento e pagamento';
    END IF;
    UPDATE locaalbarber.transacoes SET status='cancelado' WHERE id=t;
    UPDATE locaalbarber.agendamentos SET status='cancelado' WHERE id=a;
    SELECT * INTO metricas FROM locaalbarber.clientes_com_metricas WHERE id=c;
    IF metricas.total_visitas<>0 OR metricas.ultima_visita IS NOT NULL OR metricas.total_gasto<>0 THEN
        RAISE EXCEPTION 'Cancelamentos não refletiram nos indicadores';
    END IF;
    IF ('2026-09-10 10:00:00-03'::timestamptz AT TIME ZONE 'America/Sao_Paulo')::time <> time '10:00'
       OR '2026-09-09 23:59:59-03'::timestamptz >= date '2026-09-10'
       OR '2026-09-10 00:00:00-03'::timestamptz < date '2026-09-10' THEN
        RAISE EXCEPTION 'Fuso/limites diários inconsistentes';
    END IF;
    INSERT INTO locaalbarber.clientes (barbearia_id,nome,telefone)
    SELECT b,'Cliente extra '||lpad(n::text,3,'0'),'11'||lpad(n::text,9,'0') FROM generate_series(1,260) n;
END;
$tests$;
