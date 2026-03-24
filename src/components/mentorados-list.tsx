'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Phone, Mail, MapPin } from 'lucide-react'
import { MenteePanel } from '@/components/kanban/mentee-panel'
import type { Database } from '@/types/database'
import type { MenteeWithStats } from '@/types/kanban'

type Mentee = Database['public']['Tables']['mentees']['Row']

const PRIORITY_VARIANT: Record<number, 'muted' | 'warning' | 'info' | 'success' | 'accent'> = {
  1: 'muted',
  2: 'warning',
  3: 'info',
  4: 'success',
  5: 'accent',
}

interface MentoradosListProps {
  mentees: Mentee[]
}

export function MentoradosList({ mentees }: MentoradosListProps) {
  const [search, setSearch] = useState('')
  const [selectedMentee, setSelectedMentee] = useState<MenteeWithStats | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const filtered = mentees.filter((m) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      m.full_name.toLowerCase().includes(term) ||
      m.phone.toLowerCase().includes(term) ||
      (m.email?.toLowerCase().includes(term) ?? false) ||
      (m.product_name?.toLowerCase().includes(term) ?? false)
    )
  })

  function handleCardClick(mentee: Mentee) {
    const menteeWithStats: MenteeWithStats = {
      ...mentee,
      attendance_count: 0,
      indication_count: 0,
      revenue_total: 0,
    }
    setSelectedMentee(menteeWithStats)
    setPanelOpen(true)
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Mentorados</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered.length} mentorado{filtered.length !== 1 ? 's' : ''}
      </p>

      <div className="mt-4 max-w-sm">
        <Input
          placeholder="Buscar por nome, telefone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <div
            key={m.id}
            onClick={() => handleCardClick(m)}
            className="cursor-pointer rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.product_name}</p>
              </div>
              <Badge variant={PRIORITY_VARIANT[m.priority_level] ?? 'muted'}>
                P{m.priority_level}
              </Badge>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                <span>{m.phone}</span>
              </div>
              {m.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  <span>{m.email}</span>
                </div>
              )}
              {(m.city || m.state) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span>{[m.city, m.state].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Início: {m.start_date}</span>
              {m.kanban_type === 'mentorship' && (
                <Badge variant="info" className="text-[10px]">Mentoria</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <MenteePanel
        mentee={selectedMentee}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </div>
  )
}
