import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Marks a task's reminded_at so the user won't be alerted again.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { taskId } = await request.json()
  if (!taskId) return NextResponse.json({ error: 'taskId obrigatório' }, { status: 400 })

  const { error } = await supabase
    .from('tasks')
    .update({ reminded_at: new Date().toISOString() } as never)
    .eq('id', taskId)
    .eq('assigned_to' as never, user.id as never) // only update if assigned to current user

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
