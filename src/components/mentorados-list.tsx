'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Phone, Mail, Calendar, Star, AtSign } from 'lucide-react'
import { MenteePanel } from '@/components/kanban/mentee-panel'
import { formatDateBR } from '@/lib/format'
import type { Database } from '@/types/database'
import type { MenteeWithStats } from '@/types/kanban'

type Mentee = Database['public']['Tables']['mentees']['Row']

const LEVEL_COLORS: Record<number, string> = {
  1: '#888780',
  2: '#FFAA00',
  3: '#3B9FFF',
  4: '#2FC695',
  5: '#1F3A7D',
}

interface MentoradosListProps {
  mentees: Mentee[]
}

export function MentoradosList({ mentees: initialMentees }: MentoradosListProps) {
  const [menteeList, setMenteeList] = useState(initialMentees)
  const [search, setSearch] = useState('')
  const [selectedMentee, setSelectedMentee] = useState<MenteeWithStats | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const filtered = menteeList.filter((m) => {
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

      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const color = LEVEL_COLORS[m.priority_level] ?? LEVEL_COLORS[1]
          const location = [m.city, m.state].filter(Boolean).join(', ')
          const subtitle = [m.product_name, location].filter(Boolean).join(' · ')
          const instHandle = m.instagram?.replace(/^@/, '') || null

          return (
            <div
              key={m.id}
              onClick={() => handleCardClick(m)}
              className="cursor-pointer rounded-lg border border-border/50 bg-card shadow-card animate-fade-in transition-all hover:shadow-md hover:border-accent/30"
            >
              <div className="flex">
                {/* Color bar */}
                <div
                  className="w-1 shrink-0 rounded-l-lg"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 font-heading font-semibold text-[15px] leading-tight text-foreground">
                        {m.cliente_fit && <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />}
                        <span className="truncate">{m.full_name}</span>
                      </p>
                      {subtitle && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
                      )}
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      P{m.priority_level}
                    </span>
                  </div>

                  {/* Contact section */}
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="shrink-0" />
                      <span>{m.phone}</span>
                    </div>
                    {m.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="shrink-0" />
                        <span className="truncate">{m.email}</span>
                      </div>
                    )}
                    {instHandle && (
                      <div className="flex items-center gap-2">
                        <AtSign size={14} className="shrink-0 text-accent" />
                        <a
                          href={`https://instagram.com/${instHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-accent hover:underline hover:opacity-80 transition-opacity"
                        >
                          @{instHandle}
                        </a>
                      </div>
                    )}
                    {m.start_date && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="shrink-0" />
                        <span>Início: {formatDateBR(m.start_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Metrics footer */}
                  <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <span>0 atend.</span>
                    <span className="mx-1.5">·</span>
                    <span>0 indicações</span>
                    <span className="mx-1.5">·</span>
                    <span>R$ 0 receita</span>
                    {m.kanban_type === 'mentorship' && (
                      <Badge variant="info" className="text-[10px] ml-2">Mentoria</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <MenteePanel
        mentee={selectedMentee}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onMenteeDeleted={(id) => {
          setMenteeList((prev) => prev.filter((m) => m.id !== id))
          setSelectedMentee(null)
        }}
      />
    </div>
  )
}
