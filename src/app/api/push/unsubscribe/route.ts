import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  const body = await request.json()
  const { endpoint } = body

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint é obrigatório' }, { status: 400 })
  }

  const supabase = createClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'Erro ao remover subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
