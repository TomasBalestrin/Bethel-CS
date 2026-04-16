'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Calendar,
  User,
  Settings,
  FileDown,
  GripVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  createTaskColumn,
  updateTaskColumn,
  deleteTaskColumn,
} from '@/lib/actions/task-actions'
import type { Database } from '@/types/database'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

type TaskColumn = Database['public']['Tables']['task_columns']['Row']
type Task = Database['public']['Tables']['tasks']['Row']
type TaskAttachment = Database['public']['Tables']['task_attachments']['Row']

interface TasksBoardProps {
  columns: TaskColumn[]
  tasks: Task[]
  mentees: { id: string; full_name: string }[]
  attachments: TaskAttachment[]
  specialists: { id: string; full_name: string }[]
  isAdmin: boolean
}

function isOverdue(task: Task): boolean {
  const completedAt = (task as unknown as { completed_at?: string | null }).completed_at
  if (completedAt) return false
  const dueAt = (task as unknown as { due_at?: string | null }).due_at
  if (dueAt) return new Date(dueAt).getTime() < Date.now()
  if (!task.due_date) return false
  // No time set → treat day as due at 18:00 local (consistent with TaskCard fallback)
  return new Date(`${task.due_date}T18:00:00-03:00`).getTime() < Date.now()
}

export function TasksBoard({ columns, tasks: initialTasks, mentees, attachments: initialAttachments, specialists, isAdmin }: TasksBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [attachments] = useState(initialAttachments)

  // Tick every minute so task urgency (normal → due_soon → overdue) updates
  // without needing a manual refresh.
  const [, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // dnd-kit sensors — require 5px movement before a click counts as drag,
  // so clicking the card still opens the detail modal.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [specialistFilter, setSpecialistFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskDetail, setTaskDetail] = useState<Task | null>(null)
  const [showColumnConfig, setShowColumnConfig] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('18:00')
  const [assignedTo, setAssignedTo] = useState('')
  const [menteeId, setMenteeId] = useState('')
  const [columnId, setColumnId] = useState('')
  const [taskFiles, setTaskFiles] = useState<File[]>([])

  // Column config state
  const [newColName, setNewColName] = useState('')
  const [newColColor, setNewColColor] = useState('#3B9FFF')
  const [editColId, setEditColId] = useState<string | null>(null)
  const [editColName, setEditColName] = useState('')

  function resetForm() {
    setTitle(''); setDescription(''); setNotes(''); setDueDate(''); setDueTime('18:00'); setAssignedTo(''); setMenteeId(''); setColumnId(''); setTaskFiles([])
    setEditingTask(null)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setNotes(task.notes ?? '')
    setDueDate(task.due_date ?? '')
    const dueAtRaw = (task as unknown as { due_at?: string | null }).due_at
    if (dueAtRaw) {
      const d = new Date(dueAtRaw)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      setDueTime(`${hh}:${mm}`)
    } else {
      setDueTime('18:00')
    }
    setAssignedTo((task as unknown as { assigned_to?: string | null }).assigned_to ?? '')
    setMenteeId(task.mentee_id ?? '')
    setColumnId(task.column_id ?? '')
    setShowForm(true)
  }

  function openNew(colId?: string) {
    resetForm()
    if (colId) setColumnId(colId)
    else if (columns.length > 0) setColumnId(columns[0].id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let newTaskId: string | null = null

    const dueAt = dueDate ? `${dueDate}T${dueTime || '18:00'}:00-03:00` : null

    if (editingTask) {
      const res = await updateTask(editingTask.id, {
        title, description: description || null, notes: notes || null,
        due_date: dueDate || null, due_at: dueAt, column_id: columnId || null,
        assigned_to: assignedTo || null,
      })
      if (res.error) { toast.error(res.error); setLoading(false); return }
      setTasks((prev) => prev.map((t) => t.id === editingTask.id ? { ...t, title, description, notes, due_date: dueDate, column_id: columnId } : t))
    } else {
      const res = await createTask({
        title, description, notes, due_date: dueDate,
        due_at: dueAt ?? undefined,
        assigned_to: assignedTo || undefined,
        mentee_id: menteeId || undefined, column_id: columnId || undefined,
      })
      if (res.error) { toast.error(res.error); setLoading(false); return }
      if (res.task) {
        newTaskId = res.task.id
        setTasks((prev) => [res.task!, ...prev])
      }
    }

    // Upload attachments for new tasks
    if (taskFiles.length > 0 && newTaskId) {
      const supabase = createClient()
      for (const file of taskFiles) {
        const path = `${newTaskId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
        await supabase.storage.from('task-attachments').upload(path, file, { contentType: file.type })
        const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(path)
        await supabase.from('task_attachments').insert({
          task_id: newTaskId,
          file_url: urlData.publicUrl,
          file_name: file.name,
        })
      }
    }

    setLoading(false)
    resetForm()
    setShowForm(false)
    toast.success(editingTask ? 'Tarefa atualizada' : 'Tarefa criada')
    router.refresh()
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Excluir esta tarefa?')
    if (!confirmed) return
    await deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setTaskDetail(null)
    toast.success('Tarefa excluída')
  }

  async function handleMove(taskId: string, newColumnId: string) {
    await moveTask(taskId, newColumnId)
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, column_id: newColumnId } : t))
    router.refresh()
  }

  // Column management
  async function handleAddColumn() {
    if (!newColName.trim()) return
    await createTaskColumn(newColName, columns.length, newColColor)
    setNewColName(''); setNewColColor('#3B9FFF')
    router.refresh()
  }

  async function handleUpdateColumn(id: string) {
    if (!editColName.trim()) return
    await updateTaskColumn(id, { name: editColName })
    setEditColId(null); setEditColName('')
    router.refresh()
  }

  async function handleDeleteColumn(id: string) {
    const confirmed = window.confirm('Excluir esta coluna? As tarefas nela ficarão sem coluna.')
    if (!confirmed) return
    await deleteTaskColumn(id)
    router.refresh()
  }

  // Filter by specialist
  const filteredTasks = specialistFilter
    ? tasks.filter((t) => t.created_by === specialistFilter)
    : tasks

  // Separate overdue tasks
  // "Atrasadas" = overdue tasks that still sit in the first column (not yet
  // picked up by anyone). As soon as the user drags the card to another
  // workflow column (Em andamento / Concluídas / custom), it leaves Atrasadas.
  // This way a card appears in exactly one visible column at a time:
  //   - overdue + in first column           → Atrasadas
  //   - overdue + in any other column       → that column (still with red style)
  //   - not overdue                          → its column
  const firstColumnId = columns[0]?.id
  const overdueTasks = filteredTasks.filter((t) => isOverdue(t) && (!firstColumnId || t.column_id === firstColumnId))
  const tasksByColumn = (colId: string) =>
    filteredTasks.filter((t) => t.column_id === colId && !(isOverdue(t) && colId === firstColumnId))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filteredTasks.length} tarefa{filteredTasks.length !== 1 ? 's' : ''}{specialistFilter ? ` (filtrado)` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && specialists.length > 0 && (
            <Select value={specialistFilter || '__all__'} onValueChange={(v) => setSpecialistFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="Todos especialistas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos especialistas</SelectItem>
                {specialists.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowColumnConfig(true)} className="gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Colunas
            </Button>
          )}
          <Button size="sm" onClick={() => openNew()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nova tarefa
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={dndSensors}
        onDragStart={(event: DragStartEvent) => setActiveDragId(String(event.active.id))}
        onDragCancel={() => setActiveDragId(null)}
        onDragEnd={async (event: DragEndEvent) => {
          setActiveDragId(null)
          const { active, over } = event
          if (!over) return
          const taskId = String(active.id)
          const newColumnId = String(over.id)
          const current = tasks.find((t) => t.id === taskId)
          if (!current || current.column_id === newColumnId) return
          const previous = tasks
          // Optimistic: detect if target column is "Concluídas" so completed_at updates immediately
          const targetCol = columns.find((c) => c.id === newColumnId)
          const isCompletedCol = (targetCol?.name || '').toLowerCase().includes('conclu')
          setTasks((prev) => prev.map((t) => t.id === taskId
            ? { ...t, column_id: newColumnId, completed_at: isCompletedCol ? new Date().toISOString() : null }
            : t
          ))
          const result = await moveTask(taskId, newColumnId)
          if (result.error) {
            setTasks(previous)
            toast.error('Erro ao mover tarefa: ' + result.error)
          }
        }}
      >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {/* Overdue column (auto) */}
        {overdueTasks.length > 0 && (
          <div className="shrink-0 w-[300px] rounded-xl border-2 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="font-heading font-semibold text-sm text-destructive">Atrasadas</h3>
              <Badge variant="destructive" className="ml-auto text-[10px]">{overdueTasks.length}</Badge>
            </div>
            <div className="p-2 space-y-2 max-h-[65vh] overflow-y-auto">
              {overdueTasks.map((task) => (
                <TaskCard key={task.id} task={task} mentees={mentees} specialists={specialists} onDetail={setTaskDetail} isOverdue />
              ))}
            </div>
          </div>
        )}

        {/* Regular columns */}
        {columns.map((col) => {
          const colTasks = tasksByColumn(col.id)
          return (
            <DroppableColumn key={col.id} id={col.id} color={col.color}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <h3 className="font-heading font-semibold text-sm">{col.name}</h3>
                <Badge variant="muted" className="ml-auto text-[10px]">{colTasks.length}</Badge>
              </div>
              <div className="p-2 space-y-2 max-h-[65vh] overflow-y-auto">
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} mentees={mentees} specialists={specialists} onDetail={setTaskDetail} />
                ))}
                <button
                  onClick={() => openNew(col.id)}
                  className="w-full rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
            </DroppableColumn>
          )
        })}
      </div>
      {/* Drag preview floats above all columns, freed from the overflow-y-auto
          container — without this, dragging out of a column just scrolls inside it. */}
      <DragOverlay dropAnimation={null}>
        {activeDragId
          ? (() => {
              const t = tasks.find((x) => x.id === activeDragId)
              return t ? (
                <TaskCard task={t} mentees={mentees} specialists={specialists} onDetail={() => {}} />
              ) : null
            })()
          : null}
      </DragOverlay>
      </DndContext>

      {/* ── Create/Edit Task Dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { resetForm(); setShowForm(false) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
            <DialogDescription>Preencha os dados da tarefa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] resize-y" placeholder="Descreva o que precisa ser executado..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de entrega</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Horário</Label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="— Selecione —" /></SelectTrigger>
                  <SelectContent>
                    {specialists.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Coluna</Label>
                <Select value={columnId} onValueChange={setColumnId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Mentorado vinculado</Label>
              <Select value={menteeId} onValueChange={setMenteeId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {mentees.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px] resize-y" placeholder="Anotações adicionais..." />
            </div>
            {!editingTask && (
              <div className="space-y-1">
                <Label>Anexos</Label>
                <Input type="file" multiple onChange={(e) => setTaskFiles(Array.from(e.target.files ?? []))} />
                {taskFiles.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{taskFiles.length} arquivo{taskFiles.length !== 1 ? 's' : ''} selecionado{taskFiles.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false) }}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingTask ? 'Salvar' : 'Criar tarefa'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Task Detail Dialog ── */}
      <Dialog open={!!taskDetail} onOpenChange={(open) => { if (!open) setTaskDetail(null) }}>
        <DialogContent className="max-w-lg">
          {taskDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isOverdue(taskDetail) && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {taskDetail.title}
                </DialogTitle>
                <DialogDescription>
                  Criada em {new Date(taskDetail.created_at).toLocaleDateString('pt-BR')}
                  {taskDetail.due_date && ` · Prazo: ${new Date(taskDetail.due_date).toLocaleDateString('pt-BR')}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {taskDetail.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap">{taskDetail.description}</p>
                  </div>
                )}
                {taskDetail.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{taskDetail.notes}</p>
                  </div>
                )}
                {taskDetail.mentee_id && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{mentees.find((m) => m.id === taskDetail.mentee_id)?.full_name ?? 'Mentorado'}</span>
                  </div>
                )}
                {/* Attachments */}
                {attachments.filter((a) => a.task_id === taskDetail.id).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Anexos</p>
                    <div className="space-y-1">
                      {attachments.filter((a) => a.task_id === taskDetail.id).map((a) => (
                        <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline">
                          <FileDown className="h-3.5 w-3.5" /> {a.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {/* Move to column */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Mover para</p>
                  <div className="flex flex-wrap gap-1.5">
                    {columns.map((col) => (
                      <Button
                        key={col.id}
                        size="sm"
                        variant={taskDetail.column_id === col.id ? 'default' : 'outline'}
                        className="text-xs h-7"
                        onClick={() => { handleMove(taskDetail.id, col.id); setTaskDetail({ ...taskDetail, column_id: col.id }) }}
                      >
                        {col.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(taskDetail.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <Button variant="outline" size="sm" onClick={() => { openEdit(taskDetail); setTaskDetail(null) }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Column Config Dialog (Admin) ── */}
      <Dialog open={showColumnConfig} onOpenChange={setShowColumnConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Colunas</DialogTitle>
            <DialogDescription>Adicione, renomeie ou remova colunas do kanban.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: col.color || '#3B9FFF' }} />
                {editColId === col.id ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input className="h-7 text-xs" value={editColName} onChange={(e) => setEditColName(e.target.value)} autoFocus />
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdateColumn(col.id)}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditColId(null)}>X</Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{col.name}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditColId(col.id); setEditColName(col.name) }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteColumn(col.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Input className="h-8 text-xs flex-1" placeholder="Nome da nova coluna" value={newColName} onChange={(e) => setNewColName(e.target.value)} />
              <Input type="color" className="h-8 w-12 p-1" value={newColColor} onChange={(e) => setNewColColor(e.target.value)} />
              <Button size="sm" className="h-8 text-xs" onClick={handleAddColumn} disabled={!newColName.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Droppable Column ───
function DroppableColumn({ id, color, children }: {
  id: string
  color: string | null
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[300px] rounded-xl border bg-card transition-colors ${
        isOver ? 'border-accent/70 bg-accent/5' : 'border-border'
      }`}
      style={{ borderTopColor: color || undefined, borderTopWidth: color ? 3 : undefined }}
    >
      {children}
    </div>
  )
}

// ─── Task Card ───
function TaskCard({ task, mentees, specialists, onDetail, isOverdue: overdue }: {
  task: Task
  mentees: { id: string; full_name: string }[]
  specialists: { id: string; full_name: string }[]
  onDetail: (task: Task) => void
  isOverdue?: boolean
}) {
  const menteeName = task.mentee_id ? mentees.find((m) => m.id === task.mentee_id)?.full_name : null
  const assignedId = (task as unknown as { assigned_to?: string | null }).assigned_to
  const assigneeName = assignedId ? specialists.find((s) => s.id === assignedId)?.full_name : null

  // Draggable (dnd-kit). The visual preview is rendered by <DragOverlay> at the
  // board level, so here we only hide the source card while it's being dragged.
  // No translate3d — that was fighting with the column's overflow-y-auto.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  })
  const dragStyle = isDragging ? { opacity: 0.4 } : undefined

  // Resolve the effective deadline: prefer due_at (precise timestamp) and fall
  // back to due_date @ 18:00 local for legacy rows. Then derive visual urgency.
  const dueAtRaw = (task as unknown as { due_at?: string | null }).due_at
  const completedAt = (task as unknown as { completed_at?: string | null }).completed_at
  const dueTs: number | null = dueAtRaw
    ? new Date(dueAtRaw).getTime()
    : task.due_date
      ? new Date(`${task.due_date}T18:00:00-03:00`).getTime()
      : null

  let urgency: 'overdue' | 'due_soon' | 'normal' = 'normal'
  if (dueTs && !completedAt) {
    const now = Date.now()
    if (now > dueTs) urgency = 'overdue'
    else if (dueTs - now <= 60 * 60 * 1000) urgency = 'due_soon' // <= 1h
  }
  // Respect the caller's isOverdue hint (board groups overdue tasks separately)
  if (overdue) urgency = 'overdue'

  // Format date + time for display
  let dueLabel: string | null = null
  if (dueAtRaw) {
    const d = new Date(dueAtRaw)
    dueLabel = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  } else if (task.due_date) {
    dueLabel = new Date(task.due_date).toLocaleDateString('pt-BR')
  }

  const cardClass =
    urgency === 'overdue'
      ? 'border-red-600/50 bg-red-600/15 hover:border-red-600/70'
      : urgency === 'due_soon'
      ? 'border-red-400/50 bg-red-400/10 hover:border-red-400/70'
      : 'border-border bg-background hover:border-accent/30'

  const dueClass =
    urgency === 'overdue'
      ? 'text-red-700 font-semibold'
      : urgency === 'due_soon'
      ? 'text-red-600 font-medium'
      : 'text-muted-foreground'

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onDetail(task) }}
      className={`cursor-grab active:cursor-grabbing rounded-lg border p-3 text-sm transition-all hover:shadow-md ${cardClass}`}
    >
      <p className="font-medium text-foreground leading-tight">{task.title}</p>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {dueLabel && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${dueClass}`}>
            <Calendar className="h-3 w-3" />
            {dueLabel}
            {urgency === 'overdue' && ' · atrasada'}
            {urgency === 'due_soon' && ' · em breve'}
          </span>
        )}
        {assigneeName && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent">
            <User className="h-3 w-3" />
            {assigneeName.split(' ')[0]}
          </span>
        )}
        {menteeName && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="h-3 w-3" />
            {menteeName}
          </span>
        )}
      </div>
    </div>
  )
}
