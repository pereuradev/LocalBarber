-- Somente o backend PHP acessa a fila, os limites e os hashes de recuperacao.
CREATE TABLE locaalbarber.recuperacoes_senha (
    token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    usuario_id uuid NOT NULL REFERENCES locaalbarber.usuarios(id) ON DELETE CASCADE,
    versao_sessao bigint NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
    utilizado_em timestamptz,
    CHECK (expira_em > criado_em)
);
CREATE INDEX recuperacoes_senha_usuario_idx ON locaalbarber.recuperacoes_senha(usuario_id);
CREATE INDEX recuperacoes_senha_expiracao_idx ON locaalbarber.recuperacoes_senha(expira_em);

CREATE TABLE locaalbarber.recuperacao_senha_limites (
    chave text PRIMARY KEY CHECK (chave ~ '^[a-f0-9]{64}$'),
    quantidade integer NOT NULL CHECK (quantidade > 0),
    expira_em timestamptz NOT NULL
);
CREATE INDEX recuperacao_senha_limites_expiracao_idx ON locaalbarber.recuperacao_senha_limites(expira_em);

-- A fila guarda o pedido, nunca o token. O token nasce somente no worker.
CREATE TABLE locaalbarber.recuperacao_senha_emails (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    tentativas smallint NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 3),
    criado_em timestamptz NOT NULL DEFAULT now(),
    disponivel_em timestamptz NOT NULL DEFAULT now(),
    reservado_ate timestamptz
);
CREATE INDEX recuperacao_senha_emails_pendentes_idx
    ON locaalbarber.recuperacao_senha_emails(disponivel_em, id) WHERE tentativas < 3;

REVOKE ALL ON locaalbarber.recuperacoes_senha, locaalbarber.recuperacao_senha_limites,
    locaalbarber.recuperacao_senha_emails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE locaalbarber.recuperacao_senha_emails_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE locaalbarber.recuperacoes_senha ENABLE ROW LEVEL SECURITY;
ALTER TABLE locaalbarber.recuperacao_senha_limites ENABLE ROW LEVEL SECURITY;
ALTER TABLE locaalbarber.recuperacao_senha_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY recuperacoes_backend ON locaalbarber.recuperacoes_senha TO postgres USING (true) WITH CHECK (true);
CREATE POLICY limites_backend ON locaalbarber.recuperacao_senha_limites TO postgres USING (true) WITH CHECK (true);
CREATE POLICY emails_backend ON locaalbarber.recuperacao_senha_emails TO postgres USING (true) WITH CHECK (true);
