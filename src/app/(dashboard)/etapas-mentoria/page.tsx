import { createClient } from '@/lib/supabase/server'

export default async function EtapasMentoriaPage() {
  const supabase = createClient()

  const { data: stages } = await supabase
    .from('kanban_stages')
    .select('*')
    .eq('type', 'mentorship')
    .order('position')

  return (
    <div>
      <h1 className="text-2xl font-bold">Etapas Mentoria</h1>
      <p className="mt-2 text-muted-foreground">
        Kanban em desenvolvimento — Fase 4
      </p>
      {stages && stages.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="rounded-lg border bg-card p-4 text-card-foreground"
            >
              <h3 className="text-sm font-medium">{stage.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Etapa {stage.position}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
