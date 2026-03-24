import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Painel administrativo em desenvolvimento — Fase 8
      </p>
    </div>
  )
}
