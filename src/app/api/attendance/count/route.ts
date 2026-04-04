import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Calculate attendance sessions from wpp_messages.
 * A "session" = a group of messages where the gap between consecutive
 * messages is less than the configured threshold (default 2h).
 *
 * Query params:
 *   menteeId - (optional) filter by mentee
 *   specialistId - (optional) filter by specialist
 *   start - (optional) ISO date start
 *   end - (optional) ISO date end
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = request.nextUrl
  const menteeId = url.searchParams.get('menteeId')
  const specialistId = url.searchParams.get('specialistId')
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  // Get gap setting
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'attendance_gap_minutes')
    .single()

  const gapMinutes = parseInt(setting?.value ?? '120', 10)
  const gapMs = gapMinutes * 60 * 1000

  // Fetch messages
  let query = supabase
    .from('wpp_messages')
    .select('mentee_id, sent_at')
    .order('sent_at', { ascending: true })

  if (menteeId) query = query.eq('mentee_id', menteeId)
  if (specialistId) query = query.eq('specialist_id', specialistId)
  if (start) query = query.gte('sent_at', start)
  if (end) query = query.lte('sent_at', end + 'T23:59:59')

  const { data: messages } = await query

  if (!messages || messages.length === 0) {
    return NextResponse.json({ total: 0, byMentee: {} })
  }

  // Group by mentee and count sessions
  const byMentee: Record<string, { mentee_id: string; sent_at: string }[]> = {}
  for (const m of messages) {
    if (!byMentee[m.mentee_id]) byMentee[m.mentee_id] = []
    byMentee[m.mentee_id].push(m)
  }

  const sessionCounts: Record<string, number> = {}
  let total = 0

  for (const [mId, msgs] of Object.entries(byMentee)) {
    let sessions = 1
    for (let i = 1; i < msgs.length; i++) {
      const gap = new Date(msgs[i].sent_at).getTime() - new Date(msgs[i - 1].sent_at).getTime()
      if (gap > gapMs) sessions++
    }
    sessionCounts[mId] = sessions
    total += sessions
  }

  return NextResponse.json({ total, byMentee: sessionCounts })
}
