-- STRADA H&G · banco da versão de teste "testestrada"
-- Cole tudo no Supabase > SQL Editor > New query > Run. Pode rodar de novo sem problema.

-- 1) Logística da turnê (o que os ADM editam e todo mundo vê). Uma linha só: id = 'main'.
create table if not exists public.app_state (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- 2) Coleções do app: ao vivo, chat, reações, fotos do reconhecimento, recebidos.
create table if not exists public.docs (
  collection  text not null,
  id          text not null default gen_random_uuid()::text,
  data        jsonb not null default '{}'::jsonb,
  at          text generated always as (data->>'at') stored,
  created_at  timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_collection_at on public.docs (collection, at desc);

-- 3) Regra da produção: CPF fica fora do app. O banco recusa qualquer CPF no formato 000.000.000-00.
alter table public.app_state drop constraint if exists sem_cpf;
alter table public.app_state add constraint sem_cpf check (data::text !~ '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}');
alter table public.docs drop constraint if exists sem_cpf;
alter table public.docs add constraint sem_cpf check (data::text !~ '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}');

-- 4) Acesso. VERSÃO DE TESTE: quem tem o link lê e escreve (igual ao protótipo, login só pelo nome).
--    Na versão da empresa isso troca por login de verdade (Supabase Auth) e regras por pessoa.
alter table public.app_state enable row level security;
alter table public.docs enable row level security;

drop policy if exists teste_ler on public.app_state;
drop policy if exists teste_criar on public.app_state;
drop policy if exists teste_editar on public.app_state;
create policy teste_ler    on public.app_state for select to anon, authenticated using (true);
create policy teste_criar  on public.app_state for insert to anon, authenticated with check (true);
create policy teste_editar on public.app_state for update to anon, authenticated using (true) with check (true);

drop policy if exists teste_ler on public.docs;
drop policy if exists teste_criar on public.docs;
drop policy if exists teste_editar on public.docs;
drop policy if exists teste_apagar on public.docs;
create policy teste_ler    on public.docs for select to anon, authenticated using (true);
create policy teste_criar  on public.docs for insert to anon, authenticated with check (true);
create policy teste_editar on public.docs for update to anon, authenticated using (true) with check (true);
create policy teste_apagar on public.docs for delete to anon, authenticated using (true);

-- 5) Tempo real: toda edição aparece na hora para todo mundo.
alter table public.app_state replica identity full;
alter table public.docs replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.app_state; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.docs; exception when duplicate_object then null; end;
end $$;

-- 6) Fotos do reconhecimento do local (pasta pública "recon").
insert into storage.buckets (id, name, public) values ('recon', 'recon', true) on conflict (id) do nothing;
drop policy if exists recon_ler on storage.objects;
drop policy if exists recon_enviar on storage.objects;
drop policy if exists recon_apagar on storage.objects;
create policy recon_ler    on storage.objects for select to anon, authenticated using (bucket_id = 'recon');
create policy recon_enviar on storage.objects for insert to anon, authenticated with check (bucket_id = 'recon');
create policy recon_apagar on storage.objects for delete to anon, authenticated using (bucket_id = 'recon');
