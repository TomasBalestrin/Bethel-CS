'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Target } from 'lucide-react'
import type { Database } from '@/types/database'

type Objective = Database['public']['Tables']['objectives']['Row']

interface EnrichedObjective extends Objective {
  mentee_name: string
}

interface ObjectivesListProps {
  objectives: EnrichedObjective[]
}

export function ObjectivesList({ objectives }: ObjectivesListProps) {
  const [search, setSearch] = useState('')

  const filtered = objectives.filter((o) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      o.title.toLowerCase().includes(term) ||
      o.mentee_name.toLowerCase().includes(term) ||
      (o.description?.toLowerCase().includes(term) ?? false)
    )
  })

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Objetivos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered.length} objetivo{filtered.length !== 1 ? 's' : ''} registrado{filtered.length !== 1 ? 's' : ''}
      </p>

      <div className="mt-4 max-w-sm">
        <Input
          placeholder="Buscar por mentorado ou título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((o) => (
          <div
            key={o.id}
            className="rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-success/10 p-1.5">
                <Target className="h-4 w-4 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{o.title}</p>
                <p className="text-xs text-muted-foreground">{o.mentee_name}</p>
                {o.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>
                )}
                {o.achieved_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conquistado em {o.achieved_at}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
