begin;

alter table locaalbarber.barbearias
  add column if not exists cor_tema text not null default '#244BC5';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'barbearias_cor_tema_check'
      and conrelid = 'locaalbarber.barbearias'::regclass
  ) then
    alter table locaalbarber.barbearias
      add constraint barbearias_cor_tema_check
      check (cor_tema ~* '^#[0-9a-f]{6}$');
  end if;
end
$$;

commit;
