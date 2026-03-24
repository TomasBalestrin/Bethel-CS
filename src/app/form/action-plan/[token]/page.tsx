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

  // Check if already submitted
  const { data: plan } = await supabase
    .from('action_plans')
    .select('submitted_at')
    .eq('mentee_id', mentee.id)
    .maybeSingle()

  if (plan?.submitted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Formulário já enviado
          </h1>
          <p className="mt-2 text-muted-foreground">
            Seu plano de ação já foi enviado anteriormente. Nossa equipe entrará em contato em breve.
          </p>
        </div>
      </div>
    )
  }

  return <ActionPlanForm token={params.token} menteeName={mentee.full_name} />
}
