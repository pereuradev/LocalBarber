-- Cada conta controla sua propria aparencia. A cor antiga da barbearia serve
-- apenas para inicializar os usuarios existentes sem alterar o visual atual.
ALTER TABLE locaalbarber.usuarios ADD COLUMN cor_tema text;

UPDATE locaalbarber.usuarios u
SET cor_tema = coalesce(b.cor_tema, '#244BC5')
FROM locaalbarber.barbearias b
WHERE b.id = u.barbearia_id;

UPDATE locaalbarber.usuarios
SET cor_tema = '#244BC5'
WHERE cor_tema IS NULL;

ALTER TABLE locaalbarber.usuarios
    ALTER COLUMN cor_tema SET DEFAULT '#244BC5',
    ALTER COLUMN cor_tema SET NOT NULL,
    ADD CONSTRAINT usuarios_cor_tema_check CHECK (cor_tema ~* '^#[0-9a-f]{6}$');
