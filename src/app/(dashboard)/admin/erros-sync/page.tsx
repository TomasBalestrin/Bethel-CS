import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SyncErrorsList } from '@/components/sync-errors-list'

type SyncErrorRow = {
  id: string
  occurred_at: string
  route: string
  target_table: string
  error_code: string | null
  error_message: string
  error_details: string | null
  error_hint: string | null
  mentee_id: string | null
  specialist_id: string | null
  payload: unknown
}

export default async function ErrosSyncPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Cast through unknown — tabela não está nos types gerados ainda (migração 00079).
  const result = await (supabase.from as (name: string) => ReturnType<typeof supabase.from>)('wpp_insert_errors')
    .select('id, occurred_at, route, target_table, error_code, error_message, error_details, error_hint, mentee_id, specialist_id, payload')
    .order('occurred_at', { ascending: false })
    .limit(100)
  const errors = (result.data ?? []) as unknown as SyncErrorRow[]

  // Enriquecer com nomes de mentorados/especialistas para a listagem.
  const menteeIds = Array.from(new Set(errors.map((e) => e.mentee_id).filter(Boolean))) as string[]
  const specialistIds = Array.from(new Set(errors.map((e) => e.specialist_id).filter(Boolean))) as string[]

  const [menteesRes, specialistsRes] = await Promise.all([
    menteeIds.length > 0
      ? supabase.from('mentees').select('id, full_name').in('id', menteeIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    specialistIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', specialistIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])
  const menteeNames = Object.fromEntries((menteesRes.data ?? []).map((m) => [m.id, m.full_name]))
  const specialistNames = Object.fromEntries((specialistsRes.data ?? []).map((s) => [s.id, s.full_name]))

  return <SyncErrorsList errors={errors} menteeNames={menteeNames} specialistNames={specialistNames} />
}
