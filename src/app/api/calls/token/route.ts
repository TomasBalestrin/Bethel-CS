import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMeetingToken } from '@/lib/daily'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const room = request.nextUrl.searchParams.get('room')
  if (!room) return NextResponse.json({ error: 'room obrigatório' }, { status: 400 })

  const token = await createMeetingToken(room, true)
  return NextResponse.json({ token })
}
