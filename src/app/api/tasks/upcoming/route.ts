import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns tasks assigned to the current user with due_at in the next 60 minutes
 * that haven't been reminded yet and aren't completed.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const now = new Date()
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, due_at, mentee_id, assigned_to, completed_at, reminded_at, mentees(id, full_name)')
    .eq('assigned_to' as never, user.id as never)
    .gte('due_at' as never, now.toISOString() as never)
    .lte('due_at' as never, inOneHour.toISOString() as never)
    .is('completed_at', null)
    .is('reminded_at' as never, null)
    .order('due_at' as never, { ascending: true } as never)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: data ?? [] })
}
