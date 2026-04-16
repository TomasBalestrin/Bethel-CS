'use client'

import { useState, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, ChevronDown } from 'lucide-react'
import { MenteeCard } from './mentee-card'
import { cn } from '@/lib/utils'
import type { MenteeWithStats } from '@/types/kanban'
import type { Database } from '@/types/database'

type KanbanStage = Database['public']['Tables']['kanban_stages']['Row']

const INITIAL_VISIBLE = 20
const LOAD_MORE_COUNT = 20

interface KanbanColumnProps {
  stage: KanbanStage
  mentees: MenteeWithStats[]
  unreadMap?: Record<string, number>
  lastIncomingMap?: Record<string, string>
  specialistNameMap?: Map<string, string>
  onCardClick?: (mentee: MenteeWithStats) => void
  showAddButton?: boolean
  onAddClick?: () => void
}

export function KanbanColumn({ stage, mentees, unreadMap, lastIncomingMap, specialistNameMap, onCardClick, showAddButton, onAddClick }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  })

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const visibleMentees = useMemo(() => mentees.slice(0, visibleCount), [mentees, visibleCount])
  const hasMore = mentees.length > visibleCount

  return (
    <div
      className={cn(
        'flex min-w-[270px] w-[85vw] sm:w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/50 snap-start',
        isOver && 'ring-2 ring-accent/50'
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className="label-xs">
          {stage.name}
        </h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-sm bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular">
          {mentees.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className="flex min-h-[200px] flex-col gap-2 p-2"
        >
          {visibleMentees.map((mentee) => (
            <MenteeCard
              key={mentee.id}
              mentee={mentee}
              unreadCount={unreadMap?.[mentee.id] ?? 0}
              lastIncomingAt={lastIncomingMap?.[mentee.id]}
              specialistName={mentee.created_by ? specialistNameMap?.get(mentee.created_by) : undefined}
              onClick={onCardClick}
            />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
              className="flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Mostrar mais ({mentees.length - visibleCount} restantes)
            </button>
          )}
          {showAddButton && (
            <button
              type="button"
              onClick={onAddClick}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/40 px-3 py-2.5 text-sm text-accent transition-colors hover:bg-accent/5"
            >
              <Plus className="h-4 w-4" />
              Adicionar mentorado
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
