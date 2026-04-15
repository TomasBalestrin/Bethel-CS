import { createClient } from '@/lib/supabase/server'
import { TasksBoard } from '@/components/tasks-board'

export default async function TarefasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const { data: columns } = await supabase
    .from('task_columns')
    .select('*')
    .order('position')

  const { data: tasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })

  const { data: mentees } = await supabase
    .from('mentees')
    .select('id, full_name')
    .eq('status', 'ativo')
    .order('full_name')

  const { data: attachments } = await supabase
    .from('task_attachments')
    .select('*')

  // Load ALL profiles so tasks can be assigned to anyone
  // (specialists, admins, department members like Hannah/Matheus/Keyth).
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')

  return (
    <TasksBoard
      columns={columns ?? []}
      tasks={tasks ?? []}
      mentees={mentees ?? []}
      attachments={attachments ?? []}
      specialists={specialists ?? []}
      isAdmin={isAdmin}
    />
  )
}
