-- Etapa 2: Stream Chat — colunas em mentees + tabela chat_metrics

-- 1. Adicionar colunas de chat em mentees
alter table public.mentees
  add column chat_token uuid default gen_random_uuid() unique not null,
  add column stream_channel_id text;

-- 2. Tabela de métricas diárias de chat
create table public.chat_metrics (
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

create policy "Authenticated users can read chat_metrics"
  on public.chat_metrics for select
  to authenticated
  using (true);

create policy "Authenticated users can insert chat_metrics"
  on public.chat_metrics for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update chat_metrics"
  on public.chat_metrics for update
  to authenticated
  using (true);

-- 4. Permitir acesso anon ao chat_token para a rota pública /chat/[chat_token]
-- O mentorado não faz login; a rota pública consulta mentees pelo chat_token via service role,
-- então não precisa de policy anon para mentees.

-- 5. Permitir que o webhook (service role) insira/atualize chat_metrics
-- Service role bypassa RLS, então nenhuma policy adicional necessária.
