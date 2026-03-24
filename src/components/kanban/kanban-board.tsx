'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { KanbanColumn } from './kanban-column'
import { MenteeCard } from './mentee-card'
import { CreateMenteeDialog } from './create-mentee-dialog'
import { MenteePanel } from './mentee-panel'
import { moveMentee } from '@/lib/actions/mentee-actions'
import type { MenteeWithStats } from '@/types/kanban'
import type { Database, KanbanType } from '@/types/database'

type KanbanStage = Database['public']['Tables']['kanban_stages']['Row']

interface KanbanBoardProps {
  title: string
  kanbanType: KanbanType
  stages: KanbanStage[]
  initialMentees: MenteeWithStats[]
  existingMentees: { id: string; full_name: string }[]
}

export function KanbanBoard({
  title,
  kanbanType,
  stages,
  initialMentees,
  existingMentees,
}: KanbanBoardProps) {
  const [mentees, setMentees] = useState<MenteeWithStats[]>(initialMentees)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync local state when server data changes (e.g. after router.refresh())
  useEffect(() => {
    setMentees(initialMentees)
  }, [initialMentees])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMentee, setSelectedMentee] = useState<MenteeWithStats | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const activeMentee = activeId
    ? mentees.find((m) => m.id === activeId)
    : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null)

      const { active, over } = event
      if (!over) return

      const menteeId = String(active.id)
      const newStageId = String(over.id)

      const mentee = mentees.find((m) => m.id === menteeId)
      if (!mentee || mentee.current_stage_id === newStageId) return

      const previousMentees = [...mentees]
      setMentees((prev) =>
        prev.map((m) =>
          m.id === menteeId ? { ...m, current_stage_id: newStageId } : m
        )
      )

      const result = await moveMentee(menteeId, newStageId)
      if (result.error) {
        setMentees(previousMentees)
      }
    },
    [mentees]
  )

  const handleCardClick = useCallback((mentee: MenteeWithStats) => {
    setSelectedMentee(mentee)
    setPanelOpen(true)
  }, [])

  const getMenteesForStage = (stageId: string) =>
    mentees.filter((m) => m.current_stage_id === stageId)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {title}
        </h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Mentorado
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              mentees={getMenteesForStage(stage.id)}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeMentee ? <MenteeCard mentee={activeMentee} /> : null}
        </DragOverlay>
      </DndContext>

      <CreateMenteeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingMentees={existingMentees}
        kanbanType={kanbanType}
      />

      <MenteePanel
        mentee={selectedMentee}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onMenteeDeleted={(id) => {
          setMentees((prev) => prev.filter((m) => m.id !== id))
          setSelectedMentee(null)
        }}
        onMenteeUpdated={(updated) => {
          setMentees((prev) => prev.map((m) => m.id === updated.id ? updated : m))
          setSelectedMentee(updated)
        }}
      />
    </div>
  )
}
