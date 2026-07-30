create unique index if not exists funcionarios_usuario_id_unique
  on locaalbarber.funcionarios (usuario_id)
  where usuario_id is not null;

create index if not exists usuarios_barbearia_ativo_papel_idx
  on locaalbarber.usuarios (barbearia_id, ativo, papel);
