import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ActionPlanForm } from '@/components/action-plan-form'

interface Props {
  params: { token: string }
}

export default async function ActionPlanPage({ params }: Props) {
  const supabase = createClient()

  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name, action_plan_token')
    .eq('action_plan_token', params.token)
    .single()

  if (!mentee) {
    notFound()
  }

  // Check if already submitted — allow resubmission (updates existing data)
  const { data: plan } = await supabase
    .from('action_plans')
    .select('submitted_at')
    .eq('mentee_id', mentee.id)
    .maybeSingle()

  // Always show the form — if resubmitted, data will be updated
  return <ActionPlanForm token={params.token} menteeName={mentee.full_name} />
}
