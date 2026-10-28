-- Testes de permissão do TeuVet. Rodar com tests/db/run.sh
\set ON_ERROR_STOP on
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on function public.tornar_criador(text) from public, anon, authenticated;

-- Contas de teste
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000c', 'criador@teste.com', '{"name":"Criador"}'),
  ('00000000-0000-0000-0000-00000000000e', 'editor@teste.com',  '{"name":"Editor"}'),
  ('00000000-0000-0000-0000-00000000000a', 'aluno@teste.com',   '{"name":"Aluno"}');

-- 1. Cadastro cria perfil como usuário comum
do $$ begin
  if (select count(*) from public.profiles where role = 'usuario') <> 3 then raise exception 'FALHOU 1: perfis não criados como usuario'; end if;
end $$;

-- 2. Promover Criador pelo SQL Editor
select public.tornar_criador('criador@teste.com');
update public.profiles set role = 'editor' where email = 'editor@teste.com';
do $$ begin
  if (select role from public.profiles where email = 'criador@teste.com') <> 'criador' then raise exception 'FALHOU 2: tornar_criador'; end if;
end $$;

-- 3. Usuário comum não consegue se promover
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$ begin
  begin
    update public.profiles set role = 'criador' where id = auth.uid();
    raise exception 'FALHOU 3: usuário se promoveu';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- 4. Usuário comum não cadastra patologia nem espécie
do $$ begin
  begin
    insert into public.diseases (name, status) values ('Invasora', 'publicado');
    raise exception 'FALHOU 4a: usuário cadastrou patologia';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.species (name, category) values ('Invasora', 'pequenos');
    raise exception 'FALHOU 4b: usuário cadastrou espécie';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 5. Criador cadastra patologia em duas espécies com conteúdo individual
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.diseases (id, name, agent, status, shared)
  values ('11111111-1111-1111-1111-111111111111', 'Doença Teste', 'Agente X', 'publicado', '{"etiologia":"geral"}');
insert into public.disease_species (disease_id, species_id, content) values
  ('11111111-1111-1111-1111-111111111111', 'caes',  '{"sinais":"febre, anemia"}'),
  ('11111111-1111-1111-1111-111111111111', 'gatos', '{"sinais":"apatia"}');
insert into public.diseases (id, name, status)
  values ('22222222-2222-2222-2222-222222222222', 'Rascunho Teste', 'rascunho');
do $$ begin
  if (select created_by from public.diseases where name = 'Doença Teste') <> '00000000-0000-0000-0000-00000000000c' then raise exception 'FALHOU 5: autoria não registrada'; end if;
end $$;

-- 6. Editar a versão de uma espécie não altera a outra
update public.disease_species set content = '{"sinais":"febre alta"}' where species_id = 'caes';
do $$ begin
  if (select content->>'sinais' from public.disease_species where species_id = 'gatos') <> 'apatia' then raise exception 'FALHOU 6: versões por espécie se misturaram'; end if;
end $$;
reset role;

-- 7. Usuário comum vê só o publicado
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.diseases) <> 1 then raise exception 'FALHOU 7a: usuário viu rascunho'; end if;
  if (select count(*) from public.disease_species) <> 2 then raise exception 'FALHOU 7b: usuário não viu o conteúdo por espécie'; end if;
end $$;

-- 8. Usuário comum não altera nem exclui conteúdo oficial
update public.diseases set name = 'Alterada' where name = 'Doença Teste';
delete from public.diseases where name = 'Doença Teste';
reset role;
do $$ begin
  if not exists (select 1 from public.diseases where name = 'Doença Teste') then raise exception 'FALHOU 8: usuário alterou/excluiu conteúdo'; end if;
end $$;

-- 9. Usuário envia sugestão, salva favorito e não vê dados de outros
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.suggestions (disease_id, species_id, kind, text) values ('11111111-1111-1111-1111-111111111111', 'caes', 'Erro de digitação', 'Corrigir X');
insert into public.favorites (disease_id) values ('11111111-1111-1111-1111-111111111111');
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FALHOU 9a: usuário viu perfis de outros'; end if;
  if (select count(*) from public.app_config) <> 1 then raise exception 'FALHOU 9b: config ilegível'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.favorites) <> 0 then raise exception 'FALHOU 9c: editor viu favoritos de outro'; end if;
  if (select count(*) from public.suggestions) <> 1 then raise exception 'FALHOU 9d: editor não viu a sugestão'; end if;
end $$;

-- 10. Editor não exclui patologia nem muda configuração
delete from public.diseases where name = 'Doença Teste';
update public.app_config set editors_publish = false;
reset role;
do $$ begin
  if not exists (select 1 from public.diseases where name = 'Doença Teste') then raise exception 'FALHOU 10a: editor excluiu'; end if;
  if not (select editors_publish from public.app_config) then raise exception 'FALHOU 10b: editor mudou config'; end if;
end $$;

-- 11. Com aprovação ligada, editor que publica vai para revisão
update public.app_config set editors_publish = false;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
update public.diseases set status = 'publicado' where name = 'Rascunho Teste';
reset role;
do $$ begin
  if (select status from public.diseases where name = 'Rascunho Teste') <> 'revisao' then raise exception 'FALHOU 11: editor publicou sem aprovação'; end if;
end $$;

-- 12. Criador aprova (publica direto) e restaura versão
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
update public.diseases set status = 'publicado' where name = 'Rascunho Teste';
insert into public.disease_versions (disease_id, label, snapshot) values ('11111111-1111-1111-1111-111111111111', 'v1', '{"name":"Doença Teste"}');
reset role;
do $$ begin
  if (select status from public.diseases where name = 'Rascunho Teste') <> 'publicado' then raise exception 'FALHOU 12a: Criador não publicou'; end if;
  if (select count(*) from public.disease_versions) <> 1 then raise exception 'FALHOU 12b: versão não salva'; end if;
end $$;

-- 13. Espécie em uso não pode ser excluída; sempre sobra um Criador
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$ begin
  begin
    delete from public.species where id = 'caes';
    raise exception 'FALHOU 13a: espécie em uso foi excluída';
  exception when foreign_key_violation then null; end;
  begin
    update public.profiles set role = 'usuario' where id = auth.uid();
    raise exception 'FALHOU 13b: removeu o último Criador';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;

-- 14. Criador muda o perfil de outra pessoa; nomes aparecem sem e-mail
update public.profiles set role = 'editor' where email = 'aluno@teste.com';
do $$ begin
  if (select role from public.profiles where email = 'aluno@teste.com') <> 'editor' then raise exception 'FALHOU 14a: Criador não mudou perfil'; end if;
  if (select name from public.profile_names(array['00000000-0000-0000-0000-00000000000e'::uuid])) <> 'Editor' then raise exception 'FALHOU 14b: profile_names'; end if;
end $$;
reset role;

-- 15. Visitante sem login não lê nada
set role anon;
do $$ begin
  if (select count(*) from public.diseases) <> 0 or (select count(*) from public.species) <> 0 then raise exception 'FALHOU 15: visitante leu conteúdo'; end if;
end $$;
reset role;

-- 16. tornar_criador não pode ser chamado pelo app
set role authenticated;
do $$ begin
  begin
    perform public.tornar_criador('aluno@teste.com');
    raise exception 'FALHOU 16: usuário chamou tornar_criador';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'Todos os testes de permissão passaram.'
