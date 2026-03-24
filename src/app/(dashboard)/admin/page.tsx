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

  const [{ data: users }, { data: products }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('products').select('*').order('name'),
  ])

  return (
    <AdminUserList
      users={users ?? []}
      products={products ?? []}
      currentUserId={user.id}
    />
  )
}
