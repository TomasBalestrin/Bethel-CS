import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminUserList } from '@/components/admin-user-list'
import type { HealthStats } from '@/components/admin-health-widget'

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

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: users },
    { data: products },
    { data: wppInstances },
    { data: kanbanStages },
    { data: settings },
    { data: deptAssignments },
    errorsCountRes,
    lastErrorRes,
    lastIncomingRes,
    bmOutdatedRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, avatar_url, wpp_phone, created_at, updated_at').order('full_name'),
    supabase.from('products').select('id, name, created_at').order('name'),
    supabase.from('wpp_instances').select('id, specialist_id, instance_id, phone_number, status, created_at, updated_at'),
    supabase.from('kanban_stages').select('id, name, type').order('position'),
    supabase.from('system_settings').select('*').order('key'),
    supabase.from('department_assignments').select('id, user_id, department'),
    (supabase.from as (name: string) => ReturnType<typeof supabase.from>)('system_errors')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', twentyFourHoursAgo),
    (supabase.from as (name: string) => ReturnType<typeof supabase.from>)('system_errors')
      .select('occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('wpp_messages')
      .select('sent_at')
      .eq('direction', 'incoming')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Mentorados ativos com BM desatualizado (>30d OU nunca conectado).
    // Exclui encerrados/cancelados pra não inflar o número.
    (supabase.from as (name: string) => ReturnType<typeof supabase.from>)('mentees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ativo')
      .or(`metrics_source_updated_at.is.null,metrics_source_updated_at.lt.${thirtyDaysAgo}`),
  ])

  const instances = wppInstances ?? []
  const healthStats: HealthStats = {
    errors24h: (errorsCountRes as { count: number | null }).count ?? 0,
    lastErrorAt: (lastErrorRes.data as { occurred_at: string } | null)?.occurred_at ?? null,
    lastIncomingAt: lastIncomingRes.data?.sent_at ?? null,
    connectedInstances: instances.filter((i) => i.status === 'connected').length,
    totalInstances: instances.length,
    bmOutdated: (bmOutdatedRes as { count: number | null }).count ?? 0,
  }

  return (
    <AdminUserList
      users={users ?? []}
      products={products ?? []}
      wppInstances={instances}
      kanbanStages={kanbanStages ?? []}
      settings={settings ?? []}
      departmentAssignments={deptAssignments ?? []}
      currentUserId={user.id}
      healthStats={healthStats}
    />
  )
}
