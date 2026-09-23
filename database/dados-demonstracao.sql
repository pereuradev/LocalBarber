-- Dados fictícios e idempotentes para a barbearia com acesso mais recente.
-- Execute com psql -v ON_ERROR_STOP=1. O script respeita expediente e conflitos.
BEGIN;
SET LOCAL time zone 'America/Sao_Paulo';

DO $dados_demo$
DECLARE
    barbearia_alvo uuid;
    nomes text[] := ARRAY[
        'André Martins', 'Bruno Almeida', 'Caio Ferreira', 'Daniel Ribeiro',
        'Eduardo Costa', 'Felipe Nogueira', 'Gustavo Rocha', 'Henrique Lima',
        'Igor Carvalho', 'João Mendes'
    ];
    cpfs text[] := ARRAY[
        '31415926166', '31415926247', '31415926328', '31415926409',
        '31415926590', '31415926670', '31415926751', '31415926832',
        '31415926913', '31415927057'
    ];
    telefones text[] := ARRAY[
        '11970001001', '11970001002', '11970001003', '11970001004',
        '11970001005', '11970001006', '11970001007', '11970001008',
        '11970001009', '11970001010'
    ];
    metodos text[] := ARRAY['pix', 'credito', 'debito', 'dinheiro'];
    indice integer;
    cliente_demo record;
    servico_demo record;
    funcionario_demo record;
    agendamento_demo record;
    data_demo date;
    inicio_demo time;
    fim_demo time;
    codigo_demo text;
BEGIN
    SELECT u.barbearia_id
      INTO barbearia_alvo
      FROM locaalbarber.usuarios u
     WHERE u.ativo AND u.barbearia_id IS NOT NULL
     ORDER BY u.ultimo_acesso_at DESC NULLS LAST, u.created_at DESC
     LIMIT 1;

    IF barbearia_alvo IS NULL THEN
        RAISE EXCEPTION 'Nenhuma barbearia ativa foi encontrada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM locaalbarber.servicos
         WHERE barbearia_id = barbearia_alvo AND ativo
    ) OR NOT EXISTS (
        SELECT 1 FROM locaalbarber.funcionarios
         WHERE barbearia_id = barbearia_alvo AND ativo
    ) OR NOT EXISTS (
        SELECT 1 FROM locaalbarber.horarios_funcionamento
         WHERE barbearia_id = barbearia_alvo AND ativo
    ) THEN
        RAISE EXCEPTION 'Configure serviços, profissionais e expediente antes de gerar dados.';
    END IF;

    FOR indice IN 1..array_length(nomes, 1) LOOP
        INSERT INTO locaalbarber.clientes (
            barbearia_id, nome, cpf, email, telefone, cidade, observacoes, ativo
        ) VALUES (
            barbearia_alvo,
            nomes[indice],
            cpfs[indice],
            format('cliente.demo.%s@localbarber.example', lpad(indice::text, 2, '0')),
            telefones[indice],
            'Jundiaí',
            'Registro fictício criado para demonstração do sistema.',
            true
        )
        ON CONFLICT DO NOTHING;
    END LOOP;

    FOR indice IN 1..16 LOOP
        codigo_demo := format('DEMO-V1-AG-%s', lpad(indice::text, 2, '0'));
        IF EXISTS (
            SELECT 1 FROM locaalbarber.agendamentos
             WHERE barbearia_id = barbearia_alvo AND codigo = codigo_demo
        ) THEN
            CONTINUE;
        END IF;

        SELECT c.id, c.nome, c.telefone
          INTO STRICT cliente_demo
          FROM locaalbarber.clientes c
         WHERE c.barbearia_id = barbearia_alvo
           AND c.cpf = cpfs[((indice - 1) % array_length(cpfs, 1)) + 1];

        SELECT s.id, s.nome, s.preco, s.duracao_minutos
          INTO STRICT servico_demo
          FROM locaalbarber.servicos s
         WHERE s.barbearia_id = barbearia_alvo AND s.ativo
         ORDER BY s.nome, s.id
         OFFSET ((indice - 1) % (
             SELECT count(*) FROM locaalbarber.servicos
              WHERE barbearia_id = barbearia_alvo AND ativo
         )) LIMIT 1;

        SELECT f.id, f.nome
          INTO STRICT funcionario_demo
          FROM locaalbarber.funcionarios f
         WHERE f.barbearia_id = barbearia_alvo AND f.ativo
         ORDER BY f.nome, f.id
         OFFSET ((indice - 1) % (
             SELECT count(*) FROM locaalbarber.funcionarios
              WHERE barbearia_id = barbearia_alvo AND ativo
         )) LIMIT 1;

        IF indice <= 8 THEN
            SELECT dia::date,
                   faixa.inicio,
                   faixa.inicio + make_interval(mins => servico_demo.duracao_minutos)
              INTO data_demo, inicio_demo, fim_demo
              FROM generate_series(
                       current_date - interval '20 days',
                       current_date - interval '1 day',
                       interval '1 day'
                   ) AS dias(dia)
              JOIN locaalbarber.horarios_funcionamento h
                ON h.barbearia_id = barbearia_alvo
               AND h.dia_semana = extract(dow FROM dia)::integer
               AND h.ativo
             CROSS JOIN unnest(ARRAY[
                 time '09:00', time '10:30', time '13:00',
                 time '14:30', time '16:00', time '17:30'
             ]) AS faixa(inicio)
             WHERE faixa.inicio >= h.abertura
               AND faixa.inicio + make_interval(mins => servico_demo.duracao_minutos) <= h.fechamento
               AND NOT EXISTS (
                   SELECT 1
                     FROM locaalbarber.agendamentos a
                    WHERE a.barbearia_id = barbearia_alvo
                      AND a.funcionario_id = funcionario_demo.id
                      AND a.data_agendamento = dia::date
                      AND a.status <> 'cancelado'
                      AND a.horario_inicio < faixa.inicio + make_interval(mins => servico_demo.duracao_minutos)
                      AND a.horario_fim > faixa.inicio
               )
             ORDER BY dia DESC, faixa.inicio
             LIMIT 1;
        ELSE
            SELECT dia::date,
                   faixa.inicio,
                   faixa.inicio + make_interval(mins => servico_demo.duracao_minutos)
              INTO data_demo, inicio_demo, fim_demo
              FROM generate_series(
                       current_date,
                       current_date + interval '30 days',
                       interval '1 day'
                   ) AS dias(dia)
              JOIN locaalbarber.horarios_funcionamento h
                ON h.barbearia_id = barbearia_alvo
               AND h.dia_semana = extract(dow FROM dia)::integer
               AND h.ativo
             CROSS JOIN unnest(ARRAY[
                 time '09:00', time '10:30', time '13:00',
                 time '14:30', time '16:00', time '17:30'
             ]) AS faixa(inicio)
             WHERE faixa.inicio >= h.abertura
               AND faixa.inicio + make_interval(mins => servico_demo.duracao_minutos) <= h.fechamento
               AND NOT EXISTS (
                   SELECT 1
                     FROM locaalbarber.agendamentos a
                    WHERE a.barbearia_id = barbearia_alvo
                      AND a.funcionario_id = funcionario_demo.id
                      AND a.data_agendamento = dia::date
                      AND a.status <> 'cancelado'
                      AND a.horario_inicio < faixa.inicio + make_interval(mins => servico_demo.duracao_minutos)
                      AND a.horario_fim > faixa.inicio
               )
             ORDER BY dia, faixa.inicio
             LIMIT 1;
        END IF;

        IF data_demo IS NULL THEN
            RAISE EXCEPTION 'Não foi encontrado horário livre para o agendamento %.', codigo_demo;
        END IF;

        INSERT INTO locaalbarber.agendamentos (
            barbearia_id, codigo, cliente_id, servico_id, funcionario_id,
            nome_cliente_snapshot, telefone_cliente_snapshot, servico_snapshot,
            data_agendamento, horario_inicio, horario_fim, status,
            observacoes, valor_previsto
        ) VALUES (
            barbearia_alvo, codigo_demo, cliente_demo.id, servico_demo.id, funcionario_demo.id,
            cliente_demo.nome, cliente_demo.telefone, servico_demo.nome,
            data_demo, inicio_demo, fim_demo,
            CASE
                WHEN indice <= 8 THEN 'concluido'
                WHEN indice % 2 = 0 THEN 'confirmado'
                ELSE 'pendente'
            END,
            'Agendamento fictício criado para demonstração.',
            servico_demo.preco
        );
    END LOOP;

    FOR indice IN 1..8 LOOP
        SELECT a.*
          INTO STRICT agendamento_demo
          FROM locaalbarber.agendamentos a
         WHERE a.barbearia_id = barbearia_alvo
           AND a.codigo = format('DEMO-V1-AG-%s', lpad(indice::text, 2, '0'));

        INSERT INTO locaalbarber.transacoes (
            barbearia_id, codigo, agendamento_id, cliente_id, servico_id, funcionario_id,
            tipo, descricao, metodo_pagamento, valor, status, data_transacao, observacoes
        ) VALUES (
            barbearia_alvo,
            format('DEMO-V1-TX-%s', lpad(indice::text, 2, '0')),
            agendamento_demo.id,
            agendamento_demo.cliente_id,
            agendamento_demo.servico_id,
            agendamento_demo.funcionario_id,
            'entrada',
            'Pagamento demonstrativo - ' || agendamento_demo.servico_snapshot,
            metodos[((indice - 1) % array_length(metodos, 1)) + 1],
            agendamento_demo.valor_previsto,
            'concluido',
            (agendamento_demo.data_agendamento + agendamento_demo.horario_fim)
                AT TIME ZONE 'America/Sao_Paulo',
            'Transação fictícia vinculada ao agendamento demonstrativo.'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Dados demonstrativos processados na barbearia %.', barbearia_alvo;
END;
$dados_demo$;

COMMIT;
