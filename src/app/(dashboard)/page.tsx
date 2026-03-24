import { createClient } from '@/lib/supabase/server'
import { DashboardMetrics } from '@/components/dashboard-metrics'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  // Fetch all metrics in parallel
  const [
    { count: totalMentees },
    { data: mentees },
    { count: totalAttendances },
    { count: totalIndications },
    { data: revenues },
    { count: totalTestimonials },
  ] = await Promise.all([
    supabase.from('mentees').select('*', { count: 'exact', head: true }),
    supabase.from('mentees').select('priority_level'),
    supabase.from('attendances').select('*', { count: 'exact', head: true }),
    supabase.from('indications').select('*', { count: 'exact', head: true }),
    supabase.from('revenue_records').select('sale_value'),
    supabase.from('testimonials').select('*', { count: 'exact', head: true }),
  ])

  // Priority distribution
  const priorityDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  mentees?.forEach((m) => {
    priorityDistribution[m.priority_level] = (priorityDistribution[m.priority_level] ?? 0) + 1
  })

  // Total revenue
  const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.sale_value), 0) ?? 0

  return (
    <DashboardMetrics
      userName={profile?.full_name ?? ''}
      totalMentees={totalMentees ?? 0}
      priorityDistribution={priorityDistribution}
      totalAttendances={totalAttendances ?? 0}
      totalIndications={totalIndications ?? 0}
      totalRevenue={totalRevenue}
      totalTestimonials={totalTestimonials ?? 0}
    />
  )
}
