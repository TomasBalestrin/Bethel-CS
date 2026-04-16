import { createClient } from '@/lib/supabase/server'
import { EntregasList } from '@/components/entregas-list'

export default async function EntregasPage() {
  const supabase = createClient()

  const { data: events } = await supabase
    .from('delivery_events')
    .select('*')
    .order('delivery_date', { ascending: false })

  // Count participations per event
  const eventIds = (events ?? []).map((e) => e.id)
  const { data: participations } = eventIds.length > 0
    ? await supabase.from('delivery_participations').select('delivery_event_id').in('delivery_event_id', eventIds)
    : { data: [] }

  const participationCounts = new Map<string, number>()
  participations?.forEach((p) => {
    participationCounts.set(p.delivery_event_id, (participationCounts.get(p.delivery_event_id) ?? 0) + 1)
  })

  // All profiles to populate presenter dropdown + resolve names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')

  const enriched = (events ?? []).map((e) => {
    const raw = e as Record<string, unknown>
    return {
      id: e.id,
      delivery_type: e.delivery_type,
      delivery_date: e.delivery_date,
      notes: e.notes,
      created_at: e.created_at,
      title: (raw.title as string | null) ?? null,
      description: (raw.description as string | null) ?? (e.notes as string | null) ?? null,
      reference_month: (raw.reference_month as string | null) ?? null,
      presenter_id: (raw.presenter_id as string | null) ?? null,
      participation_count: participationCounts.get(e.id) ?? 0,
    }
  })

  return <EntregasList events={enriched} profiles={profiles ?? []} />
}
