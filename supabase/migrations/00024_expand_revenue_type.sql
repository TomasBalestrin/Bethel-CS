-- Expandir revenue_type para incluir tipos de indicação
-- Primeiro dropar o enum antigo e recriar com todos os valores
-- (revenue_records.revenue_type precisa ser convertido para text primeiro)

-- Converter coluna para text
alter table public.revenue_records
  alter column revenue_type drop default;
alter table public.revenue_records
  alter column revenue_type type text using revenue_type::text;

-- Dropar enum antigo
drop type if exists public.revenue_type;

-- Adicionar check constraint
alter table public.revenue_records
  add constraint revenue_records_revenue_type_check
  check (revenue_type in ('crossell','upsell','indicacao_perpetuo','indicacao_intensivo','indicacao_encontro'));

alter table public.revenue_records
  alter column revenue_type set default 'crossell';
