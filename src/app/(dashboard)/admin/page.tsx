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
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  const [{ data: users }, { data: products }, { data: wppInstances }, { data: kanbanStages }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('wpp_instances').select('*'),
    supabase.from('kanban_stages').select('id, name, type').order('position'),
  ])

  return (
    <AdminUserList
      users={users ?? []}
      products={products ?? []}
      wppInstances={wppInstances ?? []}
      kanbanStages={kanbanStages ?? []}
      currentUserId={user.id}
    />
  )
}
