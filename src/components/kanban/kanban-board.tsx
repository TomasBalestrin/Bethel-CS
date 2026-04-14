'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Rocket, ChevronRight, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { KanbanColumn } from './kanban-column'
import { MenteeCard } from './mentee-card'
import { CreateMenteeDialog } from './create-mentee-dialog'
import { MenteePanel } from './mentee-panel'
import { BulkImportDialog } from './bulk-import-dialog'
import { moveMentee, transitionToMentorship } from '@/lib/actions/mentee-actions'
import { useUnreadCounts } from '@/hooks/use-unread-counts'
import { MenteeFilters, EMPTY_FILTERS, type MenteeFilterValues } from '@/components/mentee-filters'
import type { MenteeWithStats } from '@/types/kanban'
import type { Database, KanbanType } from '@/types/database'

type KanbanStage = Database['public']['Tables']['kanban_stages']['Row']

interface KanbanBoardProps {
  title: string
  kanbanType: KanbanType
  stages: KanbanStage[]
  initialMentees: MenteeWithStats[]
  existingMentees: { id: string; full_name: string }[]
  isAdmin?: boolean
  specialists?: { id: string; full_name: string }[]
  filterOptions?: { funisOrigem: string[]; closers: string[]; nichos: string[]; especialistas?: { id: string; full_name: string }[] }
}

export function KanbanBoard({
  title,
  kanbanType,
  stages,
  initialMentees,
  existingMentees,
  isAdmin = false,
  specialists = [],
  filterOptions = { funisOrigem: [], closers: [], nichos: [] },
}: KanbanBoardProps) {
  const [mentees, setMentees] = useState<MenteeWithStats[]>(initialMentees)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('all')
  const [advFilters, setAdvFilters] = useState<MenteeFilterValues>(EMPTY_FILTERS)
  const { unreadMap, lastMessageMap } = useUnreadCounts()
  const specialistNameMap = useMemo(() => new Map(specialists.map((s) => [s.id, s.full_name])), [specialists])

  useEffect(() => {
    setMentees(initialMentees)
  }, [initialMentees])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedMentee, setSelectedMentee] = useState<MenteeWithStats | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // Transition modal state
  const [transitionMentee, setTransitionMentee] = useState<MenteeWithStats | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  // Scroll overflow detection
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollHint, setShowScrollHint] = useState(false)

  useEffect(() => {
    function check() {
      const el = scrollRef.current
      if (!el) return
      setShowScrollHint(el.scrollWidth > el.clientWidth + 2)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [stages])

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

  // The last stage (for detecting transition trigger)
  const lastStage = stages.length > 0 ? stages[stages.length - 1] : null
  // The first stage (for the "+ Adicionar" button)
  const firstStage = stages.length > 0 ? stages[0] : null

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

      // Optimistic update
      const previousMentees = [...mentees]
      setMentees((prev) =>
        prev.map((m) =>
          m.id === menteeId ? { ...m, current_stage_id: newStageId } : m
        )
      )

      const result = await moveMentee(menteeId, newStageId)
      if (result.error) {
        setMentees(previousMentees)
        return
      }

      // Check if dropped on last stage → trigger transition modal (only for initial kanban)
      if (kanbanType === 'initial' && lastStage && newStageId === lastStage.id) {
        setTransitionMentee({ ...mentee, current_stage_id: newStageId })
      }
    },
    [mentees, kanbanType, lastStage]
  )

  const handleCardClick = useCallback((mentee: MenteeWithStats) => {
    setSelectedMentee(mentee)
    setPanelOpen(true)
  }, [])

  async function handleTransitionConfirm() {
    if (!transitionMentee) return
    setTransitioning(true)
    const result = await transitionToMentorship(transitionMentee.id)
    setTransitioning(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${transitionMentee.full_name} foi enviado para Etapas Mentoria`)
      setMentees((prev) => prev.filter((m) => m.id !== transitionMentee.id))
    }
    setTransitionMentee(null)
  }

  const filteredMentees = mentees.filter((m) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!m.full_name?.toLowerCase().includes(q)) return false
    }
    if (selectedSpecialist !== 'all' && m.created_by !== selectedSpecialist) return false
    // Advanced filters
    if (advFilters.funilOrigem && m.funnel_origin !== advFilters.funilOrigem) return false
    if (advFilters.closer && m.closer_name !== advFilters.closer) return false
    if (advFilters.especialista && m.created_by !== advFilters.especialista) return false
    if (advFilters.nicho && m.niche !== advFilters.nicho) return false
    if (advFilters.estado && m.state !== advFilters.estado) return false
    if (advFilters.fatInicialMin && (m.faturamento_antes_mentoria ?? 0) < Number(advFilters.fatInicialMin)) return false
    if (advFilters.fatInicialMax && (m.faturamento_antes_mentoria ?? 0) > Number(advFilters.fatInicialMax)) return false
    if (advFilters.fatAtualMin && (m.faturamento_atual ?? 0) < Number(advFilters.fatAtualMin)) return false
    if (advFilters.fatAtualMax && (m.faturamento_atual ?? 0) > Number(advFilters.fatAtualMax)) return false
    if (advFilters.mesAniversario && m.birth_date) {
      if (String(new Date(m.birth_date).getMonth() + 1) !== advFilters.mesAniversario) return false
    } else if (advFilters.mesAniversario && !m.birth_date) return false
    if (advFilters.dataInicio) {
      if (!m.start_date || m.start_date.substring(0, 7) !== advFilters.dataInicio.substring(0, 7)) return false
    }
    if (advFilters.dataTermino) {
      if (!m.end_date || m.end_date.substring(0, 7) !== advFilters.dataTermino.substring(0, 7)) return false
    }
    return true
  })

  const getMenteesForStage = (stageId: string) =>
    filteredMentees
      .filter((m) => m.current_stage_id === stageId)
      .sort((a, b) => {
        // 1. Unread messages first
        const unreadA = unreadMap[a.id] ?? 0
        const unreadB = unreadMap[b.id] ?? 0
        if (unreadA > 0 && unreadB === 0) return -1
        if (unreadA === 0 && unreadB > 0) return 1

        // 2. Active attendance session (Em atendimento) next
        if (a.has_active_session && !b.has_active_session) return -1
        if (!a.has_active_session && b.has_active_session) return 1

        // 3. By last message (most recent first)
        const lastA = lastMessageMap[a.id] || ''
        const lastB = lastMessageMap[b.id] || ''
        if (lastA || lastB) {
          if (lastA && !lastB) return -1
          if (!lastA && lastB) return 1
          if (lastA > lastB) return -1
          if (lastA < lastB) return 1
        }

        // 4. By created_at DESC
        return b.created_at > a.created_at ? 1 : -1
      })

  return (
    <div>
      <div className="mb-4 sm:mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            {kanbanType === 'exit' && (
              <Button variant="outline" onClick={() => setImportOpen(true)} className="hidden sm:inline-flex">
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)} className="hidden sm:inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              Novo Mentorado
            </Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do mentorado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {isAdmin && specialists.length > 0 && (
            <Select value={selectedSpecialist} onValueChange={setSelectedSpecialist}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por especialista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os especialistas</SelectItem>
                {specialists.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <MenteeFilters
          filters={advFilters}
          onFilterChange={(key, value) => setAdvFilters((prev) => ({ ...prev, [key]: value }))}
          onClearAll={() => setAdvFilters(EMPTY_FILTERS)}
          options={filterOptions}
        />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-none sm:scrollbar-thin px-0.5 snap-x sm:snap-none"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={() => {
              const el = scrollRef.current
              if (!el) return
              setShowScrollHint(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
            }}
          >
            {stages.map((stage, idx) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                mentees={getMenteesForStage(stage.id)}
                unreadMap={unreadMap}
                specialistNameMap={specialistNameMap}
                onCardClick={handleCardClick}
                showAddButton={idx === 0 && firstStage?.id === stage.id}
                onAddClick={() => setDialogOpen(true)}
              />
            ))}
          </div>
          {showScrollHint && (
            <div className="absolute right-0 top-0 bottom-4 flex items-center pointer-events-none">
              <div className="w-10 h-full bg-gradient-to-l from-background to-transparent" />
              <ChevronRight size={16} className="text-muted-foreground -ml-5" />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeMentee ? <MenteeCard mentee={activeMentee} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105 active:scale-95 sm:hidden"
        aria-label="Novo Mentorado"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreateMenteeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingMentees={existingMentees}
        kanbanType={kanbanType}
        isAdmin={isAdmin}
        specialists={specialists}
      />

      {kanbanType === 'exit' && (
        <BulkImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          initialTab="stages"
          visibleTabs={['stages']}
          createIfMissing={true}
        />
      )}

      <MenteePanel
        mentee={selectedMentee}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        specialistName={selectedMentee?.created_by ? specialistNameMap.get(selectedMentee.created_by) : undefined}
        onMenteeDeleted={(id) => {
          setMentees((prev) => prev.filter((m) => m.id !== id))
          setSelectedMentee(null)
        }}
        onMenteeUpdated={(updated) => {
          setMentees((prev) => prev.map((m) => m.id === updated.id ? updated : m))
          setSelectedMentee(updated)
        }}
        onTransitionToMentorship={kanbanType === 'initial' ? (mentee) => {
          setTransitionMentee(mentee)
        } : undefined}
      />

      {/* Transition confirmation modal */}
      <Dialog open={!!transitionMentee} onOpenChange={(open) => { if (!open) setTransitionMentee(null) }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <Rocket className="h-5 w-5 text-accent" />
              </div>
              <DialogTitle className="text-lg">Mentorado pronto para avançar?</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              {transitionMentee?.full_name} concluiu as Etapas Iniciais.
              Deseja enviá-lo para Etapas Mentoria?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransitionMentee(null)}>
              Não, manter aqui
            </Button>
            <Button
              onClick={handleTransitionConfirm}
              disabled={transitioning}
              className="bg-gradient-to-r from-accent to-accent/80 text-white"
            >
              {transitioning ? 'Enviando...' : 'Sim, avançar →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
