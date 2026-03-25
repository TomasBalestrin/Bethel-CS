-- Etapa 2: Stream Chat — colunas em mentees + tabela chat_metrics

-- 1. Adicionar colunas de chat em mentees (idempotente)
alter table public.mentees
  add column if not exists chat_token uuid default gen_random_uuid() unique not null,
  add column if not exists stream_channel_id text;

-- 2. Tabela de métricas diárias de chat
create table if not exists public.chat_metrics (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.mentees(id) on delete cascade,
  specialist_id uuid references public.profiles(id),
  date date not null,
  messages_from_mentee integer not null default 0,
  messages_from_specialist integer not null default 0,
  first_response_minutes integer,
  avg_response_minutes integer,
  created_at timestamptz not null default now(),
  unique(mentee_id, date)
);

-- 3. RLS para chat_metrics
alter table public.chat_metrics enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can read chat_metrics') then
    create policy "Authenticated users can read chat_metrics"
      on public.chat_metrics for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can insert chat_metrics') then
    create policy "Authenticated users can insert chat_metrics"
      on public.chat_metrics for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can update chat_metrics') then
    create policy "Authenticated users can update chat_metrics"
      on public.chat_metrics for update to authenticated using (true);
  end if;
end $$;
