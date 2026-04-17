import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  // Admin client: evita que o UPDATE seja silenciosamente rejeitado pelo RLS
  // quando um admin encerra a call de outro especialista.
  const admin = createAdminClient()
  const { error } = await admin
    .from('call_records')
    .update({
      ended_at: new Date().toISOString(),
      recording_status: 'processing',
    })
    .eq('id', callId)
    .eq('recording_status', 'pending')

  if (error) {
    console.error('[Calls/End] Update failed:', error.message, error.details)
    return NextResponse.json({ error: `Falha ao finalizar ligação: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
