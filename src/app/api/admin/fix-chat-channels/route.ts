import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createStreamChannel } from '@/lib/stream/create-channel'

export async function POST() {
  const supabase = createClient()

  // Only allow admin users
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admin' }, { status: 403 })
  }

  // Fetch mentees without stream_channel_id
  const { data: mentees, error } = await supabase
    .from('mentees')
    .select('id, full_name, created_by')
    .is('stream_channel_id', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!mentees?.length) {
    return NextResponse.json({ message: 'Todos os mentorados já têm canal', fixed: [] })
  }

  // Get specialist info for channel creation
  const specialistIds = Array.from(new Set(mentees.map(m => m.created_by).filter(Boolean)))
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', specialistIds as string[])

  const specialistMap = new Map(
    (specialists || []).map(s => [s.id, s])
  )

  const fixed: string[] = []

  for (const mentee of mentees) {
    try {
      const specialist = mentee.created_by ? specialistMap.get(mentee.created_by) : null
      const channelId = await createStreamChannel({
        menteeId: mentee.id,
        menteeName: mentee.full_name,
        specialistId: specialist?.id || user.id,
        specialistName: specialist?.full_name || 'Especialista Bethel',
        specialistAvatar: specialist?.avatar_url || undefined,
      })

      await supabase
        .from('mentees')
        .update({ stream_channel_id: channelId })
        .eq('id', mentee.id)

      fixed.push(`${mentee.full_name} → ${channelId}`)
    } catch (err) {
      console.error(`Failed to create channel for ${mentee.full_name}:`, err)
    }
  }

  return NextResponse.json({ message: `${fixed.length} canais criados`, fixed })
}
