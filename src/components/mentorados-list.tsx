'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone, Mail, Calendar, Star, AtSign, Plus, Upload,
  CheckSquare, Square, Trash2, UserPlus, ArrowRightLeft, X, Loader2,
} from 'lucide-react'
import { MenteePanel } from '@/components/kanban/mentee-panel'
import { CreateMenteeDialog } from '@/components/kanban/create-mentee-dialog'
import { BulkImportDialog } from '@/components/kanban/bulk-import-dialog'
import { bulkDeleteMentees, bulkMoveMentees, bulkAssignSpecialist } from '@/lib/actions/mentee-actions'
import { useUnreadCounts } from '@/hooks/use-unread-counts'
import { formatDateBR } from '@/lib/format'
import type { MenteeWithStats } from '@/types/kanban'
import type { KanbanType } from '@/types/database'

const LEVEL_COLORS: Record<number, string> = {
  1: '#888780',
  2: '#FFAA00',
  3: '#3B9FFF',
  4: '#2FC695',
  5: '#1F3A7D',
}

interface Stage {
  id: string
  name: string
  type: KanbanType
  position: number
}

interface MentoradosListProps {
  mentees: MenteeWithStats[]
  existingMentees: { id: string; full_name: string }[]
  isAdmin?: boolean
  specialists?: { id: string; full_name: string }[]
  stages?: Stage[]
}

export function MentoradosList({
  mentees: initialMentees,
  existingMentees,
  isAdmin = false,
  specialists = [],
  stages = [],
}: MentoradosListProps) {
  const router = useRouter()
  const [menteeList, setMenteeList] = useState<MenteeWithStats[]>(initialMentees)

  // Sync with server data when props change (after router.refresh)
  useEffect(() => {
    setMenteeList(initialMentees)
  }, [initialMentees])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { unreadMap } = useUnreadCounts()
  const [selectedMentee, setSelectedMentee] = useState<MenteeWithStats | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedKanbanType, setSelectedKanbanType] = useState<KanbanType>('initial')

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkAction, setBulkAction] = useState<'none' | 'move' | 'assign'>('none')
  const [targetStageId, setTargetStageId] = useState('')
  const [targetSpecialistId, setTargetSpecialistId] = useState('')

  const PAGE_SIZE = 30
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const filtered = menteeList.filter((m) => {
    if (!debouncedSearch) return true
    const term = debouncedSearch.toLowerCase()
    return (
      m.full_name.toLowerCase().includes(term) ||
      m.phone.toLowerCase().includes(term) ||
      (m.email?.toLowerCase().includes(term) ?? false) ||
      (m.product_name?.toLowerCase().includes(term) ?? false)
    )
  })

  const visibleMentees = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [debouncedSearch])

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore) return
    const el = loadMoreRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, filtered.length])

  function handleCardClick(mentee: MenteeWithStats) {
    if (selectionMode) {
      toggleSelect(mentee.id)
      return
    }
    setSelectedMentee(mentee)
    setPanelOpen(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((m) => m.id)))
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkAction('none')
    setTargetStageId('')
    setTargetSpecialistId('')
  }

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    const confirmed = window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} mentorado(s)? Esta ação não pode ser desfeita.`)
    if (!confirmed) return

    setBulkLoading(true)
    const res = await bulkDeleteMentees(Array.from(selectedIds))
    setBulkLoading(false)

    if (res.error) {
      alert(`Erro: ${res.error}`)
      return
    }

    setMenteeList((prev) => prev.filter((m) => !selectedIds.has(m.id)))
    exitSelectionMode()
    router.refresh()
  }, [selectedIds, router])

  const handleBulkMove = useCallback(async () => {
    if (selectedIds.size === 0 || !targetStageId) return
    setBulkLoading(true)
    const res = await bulkMoveMentees(Array.from(selectedIds), targetStageId)
    setBulkLoading(false)

    if (res.error) {
      alert(`Erro: ${res.error}`)
      return
    }

    exitSelectionMode()
    router.refresh()
  }, [selectedIds, targetStageId, router])

  const handleBulkAssign = useCallback(async () => {
    if (selectedIds.size === 0 || !targetSpecialistId) return
    setBulkLoading(true)
    const res = await bulkAssignSpecialist(Array.from(selectedIds), targetSpecialistId)
    setBulkLoading(false)

    if (res.error) {
      alert(`Erro: ${res.error}`)
      return
    }

    exitSelectionMode()
    router.refresh()
  }, [selectedIds, targetSpecialistId, router])

  const initialStages = stages.filter((s) => s.type === 'initial')
  const mentorshipStages = stages.filter((s) => s.type === 'mentorship')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Mentorados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} mentorado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={selectionMode ? 'default' : 'outline'}
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            className="gap-1.5"
          >
            {selectionMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
            {selectionMode ? 'Cancelar' : 'Selecionar'}
          </Button>
          <Select value={selectedKanbanType} onValueChange={(v) => setSelectedKanbanType(v as KanbanType)}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="initial">Etapas Iniciais</SelectItem>
              <SelectItem value="mentorship">Etapas Mentoria</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Novo mentorado
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
          <span className="text-sm font-medium mr-1">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={selectAll} className="text-xs">
            Selecionar todos ({filtered.length})
          </Button>
          <div className="h-5 w-px bg-border mx-1" />

          {/* Delete */}
          <Button
            size="sm"
            variant="destructive"
            disabled={selectedIds.size === 0 || bulkLoading}
            onClick={handleBulkDelete}
            className="gap-1.5"
          >
            {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Excluir
          </Button>

          {/* Move to stage */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={bulkAction === 'move' ? 'default' : 'outline'}
              disabled={bulkLoading}
              onClick={() => setBulkAction(bulkAction === 'move' ? 'none' : 'move')}
              className="gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Mover etapa
            </Button>
            {bulkAction === 'move' && (
              <>
                <Select value={targetStageId} onValueChange={setTargetStageId}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {initialStages.length > 0 && (
                      <>
                        <SelectItem value="__label_initial" disabled className="text-xs font-semibold text-muted-foreground">
                          Etapas Iniciais
                        </SelectItem>
                        {initialStages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {mentorshipStages.length > 0 && (
                      <>
                        <SelectItem value="__label_mentorship" disabled className="text-xs font-semibold text-muted-foreground">
                          Etapas Mentoria
                        </SelectItem>
                        {mentorshipStages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!targetStageId || selectedIds.size === 0 || bulkLoading} onClick={handleBulkMove}>
                  {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
                </Button>
              </>
            )}
          </div>

          {/* Assign specialist (admin only) */}
          {isAdmin && specialists.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={bulkAction === 'assign' ? 'default' : 'outline'}
                disabled={bulkLoading}
                onClick={() => setBulkAction(bulkAction === 'assign' ? 'none' : 'assign')}
                className="gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" /> Especialista
              </Button>
              {bulkAction === 'assign' && (
                <>
                  <Select value={targetSpecialistId} onValueChange={setTargetSpecialistId}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Selecione especialista" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialists.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!targetSpecialistId || selectedIds.size === 0 || bulkLoading} onClick={handleBulkAssign}>
                    {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Aplicar'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mt-4 max-w-sm">
        <Input
          placeholder="Buscar por nome, telefone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cards grid */}
      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-h-[200px]">
        {visibleMentees.map((m) => {
          const color = LEVEL_COLORS[m.priority_level] ?? LEVEL_COLORS[1]
          const location = [m.city, m.state].filter(Boolean).join(', ')
          const subtitle = [m.product_name, location].filter(Boolean).join(' · ')
          const instHandle = m.instagram?.replace(/^@/, '') || null
          const unread = unreadMap[m.id] ?? 0
          const isSelected = selectedIds.has(m.id)

          return (
            <div
              key={m.id}
              onClick={() => handleCardClick(m)}
              className={`relative cursor-pointer rounded-lg border bg-card shadow-card animate-fade-in transition-all hover:shadow-md ${
                isSelected
                  ? 'border-accent ring-2 ring-accent/30'
                  : 'border-border/50 hover:border-accent/30'
              }`}
            >
              {/* Selection checkbox */}
              {selectionMode && (
                <div className="absolute top-3 right-3 z-10">
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-accent" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}

              {unread > 0 && !selectionMode && (
                <span className="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
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
                    {!selectionMode && (
                      <span
                        className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        P{m.priority_level}
                      </span>
                    )}
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
                    <span>{m.indication_count} indicações</span>
                    <span className="mx-1.5">·</span>
                    <span>R$ {m.revenue_total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} receita</span>
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

      {/* Infinite scroll sentinel + counter */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          <p className="text-sm text-muted-foreground">
            Mostrando {visibleMentees.length} de {filtered.length} mentorados...
          </p>
        </div>
      )}

      <MenteePanel
        mentee={selectedMentee}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onMenteeDeleted={(id) => {
          setMenteeList((prev) => prev.filter((m) => m.id !== id))
          setSelectedMentee(null)
        }}
      />

      <CreateMenteeDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) router.refresh() }}
        existingMentees={existingMentees}
        kanbanType={selectedKanbanType}
        isAdmin={isAdmin}
        specialists={specialists}
      />

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        specialists={specialists}
        isAdmin={isAdmin}
      />
    </div>
  )
}
