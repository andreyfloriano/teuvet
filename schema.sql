-- =====================================================================
-- TeuVet · Seu guia veterinário
-- Banco de dados da Etapa 1 (Supabase / PostgreSQL)
--
-- Como usar: no Supabase, abra "SQL Editor", cole este arquivo inteiro
-- e clique em "Run". Rode uma única vez, num projeto novo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis de acesso: criador, editor, usuario
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text,
  role        text not null default 'usuario' check (role in ('criador','editor','usuario')),
  created_at  timestamptz not null default now()
);

create table public.app_config (
  id               int primary key default 1 check (id = 1),
  editors_publish  boolean not null default true,
  updated_at       timestamptz not null default now()
);
insert into public.app_config (id) values (1);

-- ---------------------------------------------------------------------
-- Categorias fixas (pequenos, grandes, naoconv) e espécies editáveis
-- ---------------------------------------------------------------------
create table public.species (
  id          text primary key default ('sp' || substr(md5(gen_random_uuid()::text), 1, 12)),
  name        text not null check (length(trim(name)) > 0),
  scientific  text not null default '',
  category    text not null check (category in ('pequenos','grandes','naoconv')),
  parent_id   text references public.species(id) on delete restrict,
  sort_order  int  not null default 0,
  chars       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------
-- Patologias, conteúdo compartilhado e conteúdo por espécie
-- ---------------------------------------------------------------------
create table public.diseases (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  scientific     text not null default '',
  synonyms       text not null default '',
  popular        text not null default '',
  agent          text not null default '',
  hide_agent     boolean not null default false,
  system         text not null default '',
  etiology_type  text not null default '',
  kind           text not null default '',
  specialty      text not null default '',
  zoonotic       boolean not null default false,
  surgical       boolean not null default false,
  procedures     jsonb not null default '[]'::jsonb,
  shared         jsonb not null default '{}'::jsonb,
  status         text not null default 'rascunho' check (status in ('rascunho','revisao','publicado','arquivado')),
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);

-- Relação patologia × espécie, com o conteúdo clínico próprio de cada espécie
create table public.disease_species (
  disease_id  uuid not null references public.diseases(id) on delete cascade,
  species_id  text not null references public.species(id) on delete restrict,
  content     jsonb not null default '{}'::jsonb,
  primary key (disease_id, species_id)
);
create index disease_species_species_idx on public.disease_species (species_id);

-- Histórico de versões (para restaurar)
create table public.disease_versions (
  id          uuid primary key default gen_random_uuid(),
  disease_id  uuid not null references public.diseases(id) on delete cascade,
  label       text not null default '',
  snapshot    jsonb not null,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index disease_versions_idx on public.disease_versions (disease_id, created_at desc);

-- Sugestões de correção enviadas pelos usuários
create table public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  disease_id  uuid not null references public.diseases(id) on delete cascade,
  species_id  text references public.species(id) on delete set null,
  kind        text not null,
  text        text not null check (length(text) between 1 and 4000),
  status      text not null default 'aberta' check (status in ('aberta','resolvida')),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- Favoritos e histórico de cada usuário
create table public.favorites (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disease_id  uuid not null references public.diseases(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, disease_id)
);

create table public.recent_views (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disease_id  uuid not null references public.diseases(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (user_id, disease_id)
);

-- ---------------------------------------------------------------------
-- Funções de permissão (conferidas pelo banco em toda leitura e gravação)
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('criador','editor') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_criador() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'criador' from public.profiles where id = auth.uid()), false)
$$;

-- Nomes para "atualizado por", sem expor e-mails
create or replace function public.profile_names(ids uuid[])
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name from public.profiles p where p.id = any(ids) and auth.uid() is not null
$$;

-- Cria o perfil quando alguém se cadastra
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Só o Criador muda perfis; sempre sobra ao menos um Criador
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role and not public.is_criador() then
      raise exception 'Só o Criador pode mudar perfis de acesso';
    end if;
    new.email := old.email;
    new.id := old.id;
  end if;
  if old.role = 'criador' and new.role <> 'criador'
     and (select count(*) from public.profiles where role = 'criador') <= 1 then
    raise exception 'É preciso manter ao menos um Criador';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- Autoria, datas e regra de aprovação dos editores
create or replace function public.guard_disease() returns trigger
language plpgsql security definer set search_path = public as $$
declare pub boolean;
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.created_at := now();
    else
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    end if;
    if new.status = 'publicado' and not public.is_criador() then
      select editors_publish into pub from public.app_config where id = 1;
      if not coalesce(pub, true) then
        new.status := 'revisao';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger diseases_guard before insert or update on public.diseases
  for each row execute function public.guard_disease();

create or replace function public.touch_species() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger species_touch before insert or update on public.species
  for each row execute function public.touch_species();

-- Para promover alguém a Criador pelo SQL Editor:
--   select public.tornar_criador('email@exemplo.com');
create or replace function public.tornar_criador(user_email text) returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles set role = 'criador' where lower(email) = lower(user_email);
  get diagnostics n = row_count;
  if n = 0 then
    return 'Nenhuma conta com esse e-mail. A pessoa precisa se cadastrar no app primeiro.';
  end if;
  return 'Pronto: ' || user_email || ' agora é Criador.';
end $$;
revoke all on function public.tornar_criador(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Regras de acesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.app_config       enable row level security;
alter table public.species          enable row level security;
alter table public.diseases         enable row level security;
alter table public.disease_species  enable row level security;
alter table public.disease_versions enable row level security;
alter table public.suggestions      enable row level security;
alter table public.favorites        enable row level security;
alter table public.recent_views     enable row level security;

create policy "perfil: ver o próprio ou Criador vê todos" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_criador());
create policy "perfil: editar o próprio ou Criador edita" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_criador())
  with check (id = auth.uid() or public.is_criador());

create policy "config: leitura" on public.app_config
  for select to authenticated using (true);
create policy "config: só Criador altera" on public.app_config
  for update to authenticated using (public.is_criador()) with check (public.is_criador());

create policy "espécies: leitura" on public.species
  for select to authenticated using (true);
create policy "espécies: editores cadastram" on public.species
  for insert to authenticated with check (public.is_editor());
create policy "espécies: editores alteram" on public.species
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "espécies: só Criador exclui" on public.species
  for delete to authenticated using (public.is_criador());

create policy "patologias: publicadas para todos, tudo para editores" on public.diseases
  for select to authenticated using (status = 'publicado' or public.is_editor());
create policy "patologias: editores cadastram" on public.diseases
  for insert to authenticated with check (public.is_editor());
create policy "patologias: editores alteram" on public.diseases
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "patologias: só Criador exclui" on public.diseases
  for delete to authenticated using (public.is_criador());

create policy "conteúdo por espécie: segue a patologia" on public.disease_species
  for select to authenticated using (
    exists (select 1 from public.diseases d where d.id = disease_id and (d.status = 'publicado' or public.is_editor()))
  );
create policy "conteúdo por espécie: editores gravam" on public.disease_species
  for insert to authenticated with check (public.is_editor());
create policy "conteúdo por espécie: editores alteram" on public.disease_species
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "conteúdo por espécie: editores removem" on public.disease_species
  for delete to authenticated using (public.is_editor());

create policy "versões: editores leem" on public.disease_versions
  for select to authenticated using (public.is_editor());
create policy "versões: editores gravam" on public.disease_versions
  for insert to authenticated with check (public.is_editor());
create policy "versões: editores limpam antigas" on public.disease_versions
  for delete to authenticated using (public.is_editor());

create policy "sugestões: qualquer usuário envia" on public.suggestions
  for insert to authenticated with check (created_by = auth.uid());
create policy "sugestões: autor e editores leem" on public.suggestions
  for select to authenticated using (created_by = auth.uid() or public.is_editor());
create policy "sugestões: editores mudam status" on public.suggestions
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "sugestões: Criador exclui" on public.suggestions
  for delete to authenticated using (public.is_criador());

create policy "favoritos: só os próprios" on public.favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "histórico: só o próprio" on public.recent_views
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Atualização ao vivo entre dispositivos
alter publication supabase_realtime add table public.species, public.diseases, public.disease_species, public.app_config;

-- ---------------------------------------------------------------------
-- Espécies iniciais (todas editáveis depois pelo Painel)
-- ---------------------------------------------------------------------
insert into public.species (id, name, scientific, category, parent_id, sort_order) values
  ('caes', 'Cães', 'Canis lupus familiaris', 'pequenos', null, 10),
  ('gatos', 'Gatos', 'Felis catus', 'pequenos', null, 20),
  ('bovinos', 'Bovinos', 'Bos taurus e Bos indicus', 'grandes', null, 10),
  ('equinos', 'Equinos', 'Equus caballus', 'grandes', null, 20),
  ('suinos', 'Suínos', 'Sus scrofa domesticus', 'grandes', null, 30),
  ('peqrum', 'Pequenos ruminantes', '', 'grandes', null, 40),
  ('aves', 'Aves', '', 'naoconv', null, 10),
  ('repteis', 'Répteis', '', 'naoconv', null, 20),
  ('mamiferos', 'Mamíferos', '', 'naoconv', null, 30),
  ('anfibios', 'Anfíbios', '', 'naoconv', null, 40),
  ('peixes', 'Peixes', '', 'naoconv', null, 50),
  ('artropodes', 'Artrópodes', '', 'naoconv', null, 60);

insert into public.species (id, name, scientific, category, parent_id, sort_order) values
  ('ovinos', 'Ovinos', 'Ovis aries', 'grandes', 'peqrum', 10),
  ('caprinos', 'Caprinos', 'Capra hircus', 'grandes', 'peqrum', 20),
  ('psitacideos', 'Psitacídeos', 'Psittaciformes', 'naoconv', 'aves', 10),
  ('passeriformes', 'Passeriformes', 'Passeriformes', 'naoconv', 'aves', 20),
  ('ratitas', 'Ratitas', '', 'naoconv', 'aves', 30),
  ('serpentes', 'Serpentes', 'Serpentes', 'naoconv', 'repteis', 10),
  ('quelonios', 'Quelônios', 'Testudines', 'naoconv', 'repteis', 20),
  ('lagartos', 'Lagartos', '', 'naoconv', 'repteis', 30),
  ('coelhos', 'Coelhos', 'Oryctolagus cuniculus', 'naoconv', 'mamiferos', 10),
  ('roedores', 'Roedores', 'Rodentia', 'naoconv', 'mamiferos', 20),
  ('furoes', 'Furões', 'Mustela putorius furo', 'naoconv', 'mamiferos', 30);
