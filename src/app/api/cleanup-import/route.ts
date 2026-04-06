import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Temporary endpoint to delete bulk-imported mentees
// DELETE after use
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Find the "Vandressa" mentee (existing before import) to exclude
  // Get all mentees created in the last 24 hours with priority_level 1
  // that are in the first stage of 'initial' kanban
  const { data: firstStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('type', 'initial')
    .order('position')
    .limit(1)
    .single()

  if (!firstStage) return NextResponse.json({ error: 'Stage not found' }, { status: 500 })

  // Get all recently bulk-imported mentees (last 24h, priority 1, first stage)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: toDelete } = await supabase
    .from('mentees')
    .select('id, full_name')
    .eq('current_stage_id', firstStage.id)
    .eq('priority_level', 1)
    .eq('kanban_type', 'initial')
    .gte('created_at', cutoff)

  if (!toDelete || toDelete.length === 0) {
    return NextResponse.json({ message: 'Nenhum mentorado para remover', count: 0 })
  }

  const ids = toDelete.map((m) => m.id)

  // Delete related records first
  const tables = [
    'attendances',
    'action_plans',
    'indications',
    'intensivo_records',
    'revenue_records',
    'objectives',
    'testimonials',
    'engagement_records',
    'cs_activities',
    'chat_metrics',
    'wpp_messages',
    'cancellations',
    'push_subscriptions',
  ] as const

  for (const table of tables) {
    await supabase.from(table).delete().in('mentee_id', ids)
  }

  // Clear referrals
  await supabase.from('mentees').update({ referred_by_mentee_id: null }).in('referred_by_mentee_id', ids)

  // Delete mentees
  const { error, count } = await supabase
    .from('mentees')
    .delete({ count: 'exact' })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    message: `${count} mentorados removidos com sucesso`,
    count,
    names: toDelete.map((m) => m.full_name).slice(0, 10),
  })
}
