import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Bem-vindo ao Bethel CS{profile ? `, ${profile.full_name}` : ''}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Dashboard em desenvolvimento — Fase 7
      </p>
    </div>
  )
}
