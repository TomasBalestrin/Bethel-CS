import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  await supabase
    .from('call_records')
    .update({
      ended_at: new Date().toISOString(),
      recording_status: 'processing',
    })
    .eq('id', callId)
    .eq('recording_status', 'pending')

  return NextResponse.json({ ok: true })
}
