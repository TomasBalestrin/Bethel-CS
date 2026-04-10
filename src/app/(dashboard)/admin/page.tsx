import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminUserList } from '@/components/admin-user-list'

export default async function AdminPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  const [{ data: users }, { data: products }, { data: wppInstances }, { data: kanbanStages }, { data: settings }, { data: deptAssignments }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, avatar_url, wpp_phone, created_at, updated_at').order('full_name'),
    supabase.from('products').select('id, name, created_at').order('name'),
    supabase.from('wpp_instances').select('id, specialist_id, instance_id, phone_number, status, created_at, updated_at'),
    supabase.from('kanban_stages').select('id, name, type').order('position'),
    supabase.from('system_settings').select('*').order('key'),
    supabase.from('department_assignments').select('id, user_id, department'),
  ])

  return (
    <AdminUserList
      users={users ?? []}
      products={products ?? []}
      wppInstances={wppInstances ?? []}
      kanbanStages={kanbanStages ?? []}
      settings={settings ?? []}
      departmentAssignments={deptAssignments ?? []}
      currentUserId={user.id}
    />
  )
}
