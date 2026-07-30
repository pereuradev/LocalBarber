begin;

alter table locaalbarber.usuarios
  drop constraint if exists usuarios_papel_check;

alter table locaalbarber.usuarios
  add constraint usuarios_papel_check
  check (papel in ('admin', 'colaborador', 'gerente', 'barbeiro', 'recepcao'));

commit;
