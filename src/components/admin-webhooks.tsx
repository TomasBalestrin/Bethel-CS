'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Copy,
  Pencil,
  ScrollText,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
  Webhook,
} from 'lucide-react'

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

interface WebhookEndpoint {
  id: string
  name: string
  slug: string
  description: string | null
  platform: string
  direction: string
  secret_key: string | null
  auth_type: string
  auth_header: string | null
  default_action: string
  field_mapping: Record<string, string>
  event_field: string | null
  event_actions: Record<string, string>
  default_kanban_stage: string | null
  default_specialist_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface WebhookLog {
  id: string
  endpoint_id: string
  direction: string
  event_type: string | null
  action_executed: string | null
  status: string
  error_message: string | null
  processing_time_ms: number | null
  created_at: string
  action_result: Record<string, unknown> | null
  // full log fields
  headers?: Record<string, string> | null
  payload?: Record<string, unknown> | null
  query_params?: Record<string, unknown> | null
  source_ip?: string | null
}

interface Specialist {
  id: string
  full_name: string
  role: string
}

interface KanbanStage {
  id: string
  name: string
  type: string
}

// ═══════════════════════════════════════
// Platform templates
// ═══════════════════════════════════════

const PLATFORM_TEMPLATES: Record<string, {
  event_field: string
  field_mapping: Record<string, string>
  event_actions: Record<string, string>
  auth_header: string
}> = {
  hotmart: {
    event_field: 'event',
    field_mapping: { name: 'data.buyer.name', email: 'data.buyer.email', phone: 'data.buyer.phone', product_name: 'data.product.name' },
    event_actions: { PURCHASE_APPROVED: 'create_mentee', PURCHASE_REFUNDED: 'deactivate_mentee', PURCHASE_CANCELED: 'deactivate_mentee' },
    auth_header: 'x-hotmart-hottok',
  },
  kiwify: {
    event_field: 'order_status',
    field_mapping: { name: 'Customer.full_name', email: 'Customer.email', phone: 'Customer.mobile' },
    event_actions: { paid: 'create_mentee', refunded: 'deactivate_mentee' },
    auth_header: 'x-webhook-secret',
  },
  mentorfy: {
    event_field: 'event',
    field_mapping: { name: 'student.name', email: 'student.email' },
    event_actions: {},
    auth_header: 'x-webhook-secret',
  },
  activecampaign: {
    event_field: 'type',
    field_mapping: { name: 'contact.first_name', email: 'contact.email', phone: 'contact.phone' },
    event_actions: {},
    auth_header: 'x-webhook-secret',
  },
  closer: {
    event_field: 'action',
    field_mapping: { name: 'lead.name', email: 'lead.email', phone: 'lead.phone' },
    event_actions: { 'lead.qualified': 'create_mentee', 'lead.updated': 'update_mentee' },
    auth_header: 'x-webhook-secret',
  },
  custom: {
    event_field: '',
    field_mapping: {},
    event_actions: {},
    auth_header: 'x-webhook-secret',
  },
}

const PLATFORM_LABELS: Record<string, string> = {
  hotmart: 'Hotmart',
  kiwify: 'Kiwify',
  mentorfy: 'Mentorfy',
  activecampaign: 'ActiveCampaign',
  closer: 'Bethel Closer',
  custom: 'Custom',
}

const ACTION_LABELS: Record<string, string> = {
  create_mentee: 'Criar mentorado',
  update_mentee: 'Atualizar mentorado',
  move_kanban: 'Mover no kanban',
  deactivate_mentee: 'Desativar mentorado',
  log_only: 'Apenas registrar',
}

const AUTH_LABELS: Record<string, string> = {
  none: 'Nenhuma',
  hmac_sha256: 'HMAC SHA-256',
  bearer_token: 'Bearer Token',
  query_param: 'Query Param',
}

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

export function WebhooksSection({
  specialists,
  kanbanStages,
}: {
  specialists: Specialist[]
  kanbanStages: KanbanStage[]
}) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null)
  const [logsEndpoint, setLogsEndpoint] = useState<WebhookEndpoint | null>(null)

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/endpoints')
      if (res.ok) {
        const data = await res.json()
        setEndpoints(data)
      }
    } catch (err) {
      console.error('Failed to fetch endpoints:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEndpoints()
  }, [fetchEndpoints])

  function openCreate() {
    setEditingEndpoint(null)
    setFormOpen(true)
  }

  function openEdit(endpoint: WebhookEndpoint) {
    setEditingEndpoint(endpoint)
    setFormOpen(true)
  }

  async function handleDelete(endpoint: WebhookEndpoint) {
    const confirmed = window.confirm(`Desativar o endpoint "${endpoint.name}"?`)
    if (!confirmed) return

    await fetch(`/api/webhooks/endpoints/${endpoint.id}`, { method: 'DELETE' })
    fetchEndpoints()
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingEndpoint(null)
    fetchEndpoints()
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-xl font-semibold text-foreground">Webhooks</h2>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Endpoint
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-accent" />
        </div>
      ) : endpoints.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum endpoint configurado.
        </p>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              baseUrl={baseUrl}
              onEdit={() => openEdit(ep)}
              onLogs={() => setLogsEndpoint(ep)}
              onDelete={() => handleDelete(ep)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <EndpointFormDialog
        open={formOpen}
        endpoint={editingEndpoint}
        specialists={specialists}
        kanbanStages={kanbanStages}
        onClose={handleFormClose}
      />

      {/* Logs Dialog */}
      <LogsDialog
        endpoint={logsEndpoint}
        onClose={() => setLogsEndpoint(null)}
      />
    </div>
  )
}

// ═══════════════════════════════════════
// Endpoint Card
// ═══════════════════════════════════════

function EndpointCard({
  endpoint,
  baseUrl,
  onEdit,
  onLogs,
  onDelete,
}: {
  endpoint: WebhookEndpoint
  baseUrl: string
  onEdit: () => void
  onLogs: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const webhookUrl = `${baseUrl}/api/webhooks/in/${endpoint.slug}`

  async function copyUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${endpoint.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="font-medium text-foreground">{endpoint.name}</span>
            <Badge variant="muted" className="text-[10px]">{endpoint.direction}</Badge>
            <Badge variant="muted" className="text-[10px]">{PLATFORM_LABELS[endpoint.platform] ?? endpoint.platform}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{endpoint.slug}</p>
          <div className="flex items-center gap-1 mt-2">
            <code className="text-[11px] text-muted-foreground truncate block max-w-[400px]">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copiar URL"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {endpoint.description && (
            <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button type="button" onClick={onLogs} className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Logs">
            <ScrollText className="h-4 w-4" />
          </button>
          <button type="button" onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Editar">
            <Pencil className="h-4 w-4" />
          </button>
          {endpoint.is_active && (
            <button type="button" onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Desativar">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Endpoint Form Dialog
// ═══════════════════════════════════════

function EndpointFormDialog({
  open,
  endpoint,
  specialists,
  kanbanStages,
  onClose,
}: {
  open: boolean
  endpoint: WebhookEndpoint | null
  specialists: Specialist[]
  kanbanStages: KanbanStage[]
  onClose: () => void
}) {
  const isEdit = !!endpoint

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState('custom')
  const [authType, setAuthType] = useState('none')
  const [secretKey, setSecretKey] = useState('')
  const [authHeader, setAuthHeader] = useState('x-webhook-secret')
  const [defaultAction, setDefaultAction] = useState('log_only')
  const [fieldMapping, setFieldMapping] = useState<Array<{ key: string; value: string }>>([])
  const [eventField, setEventField] = useState('')
  const [eventActions, setEventActions] = useState<Array<{ event: string; action: string }>>([])
  const [kanbanStage, setKanbanStage] = useState('')
  const [specialistId, setSpecialistId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  // Test state
  const [testOpen, setTestOpen] = useState(false)
  const [testPayload, setTestPayload] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (endpoint) {
        setName(endpoint.name)
        setSlug(endpoint.slug)
        setDescription(endpoint.description ?? '')
        setPlatform(endpoint.platform)
        setAuthType(endpoint.auth_type)
        setSecretKey(endpoint.secret_key ?? '')
        setAuthHeader(endpoint.auth_header ?? 'x-webhook-secret')
        setDefaultAction(endpoint.default_action)
        setEventField(endpoint.event_field ?? '')
        setKanbanStage(endpoint.default_kanban_stage ?? '')
        setSpecialistId(endpoint.default_specialist_id ?? '')
        setIsActive(endpoint.is_active)

        const fm = endpoint.field_mapping ?? {}
        setFieldMapping(Object.entries(fm).map(([key, value]) => ({ key, value })))

        const ea = endpoint.event_actions ?? {}
        setEventActions(Object.entries(ea).map(([event, action]) => ({ event, action })))
      } else {
        resetForm()
      }
      setError(null)
      setTestOpen(false)
      setTestResult(null)
    }
  }, [open, endpoint])

  function resetForm() {
    setName('')
    setSlug('')
    setDescription('')
    setPlatform('custom')
    setAuthType('none')
    setSecretKey('')
    setAuthHeader('x-webhook-secret')
    setDefaultAction('log_only')
    setFieldMapping([])
    setEventField('')
    setEventActions([])
    setKanbanStage('')
    setSpecialistId('')
    setIsActive(true)
    setShowSecret(false)
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!isEdit) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    }
  }

  function handlePlatformChange(value: string) {
    setPlatform(value)
    if (!isEdit) {
      const template = PLATFORM_TEMPLATES[value]
      if (template) {
        setEventField(template.event_field)
        setAuthHeader(template.auth_header)
        setFieldMapping(Object.entries(template.field_mapping).map(([key, v]) => ({ key, value: v })))
        setEventActions(Object.entries(template.event_actions).map(([event, action]) => ({ event, action })))
      }
    }
  }

  function generateSecret() {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    setSecretKey(Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(''))
  }

  // Field mapping CRUD
  function addFieldMapping() {
    setFieldMapping([...fieldMapping, { key: '', value: '' }])
  }
  function updateFieldMapping(index: number, field: 'key' | 'value', val: string) {
    const updated = [...fieldMapping]
    updated[index][field] = val
    setFieldMapping(updated)
  }
  function removeFieldMapping(index: number) {
    setFieldMapping(fieldMapping.filter((_, i) => i !== index))
  }

  // Event actions CRUD
  function addEventAction() {
    setEventActions([...eventActions, { event: '', action: 'log_only' }])
  }
  function updateEventAction(index: number, field: 'event' | 'action', val: string) {
    const updated = [...eventActions]
    updated[index][field] = val
    setEventActions(updated)
  }
  function removeEventAction(index: number) {
    setEventActions(eventActions.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const fmObj: Record<string, string> = {}
    for (const { key, value } of fieldMapping) {
      if (key.trim() && value.trim()) fmObj[key.trim()] = value.trim()
    }

    const eaObj: Record<string, string> = {}
    for (const { event, action } of eventActions) {
      if (event.trim() && action) eaObj[event.trim()] = action
    }

    const body = {
      name,
      slug,
      description: description || null,
      platform,
      auth_type: authType,
      secret_key: secretKey || null,
      auth_header: authHeader,
      default_action: defaultAction,
      field_mapping: fmObj,
      event_field: eventField || null,
      event_actions: eaObj,
      default_kanban_stage: kanbanStage || null,
      default_specialist_id: specialistId || null,
      is_active: isActive,
    }

    try {
      const res = isEdit
        ? await fetch(`/api/webhooks/endpoints/${endpoint!.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/webhooks/endpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erro ao salvar')
        setSaving(false)
        return
      }

      onClose()
    } catch {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTestLoading(true)
    setTestResult(null)
    try {
      const baseUrl = window.location.origin
      const testSlug = isEdit ? endpoint!.slug : slug
      const res = await fetch(`${baseUrl}/api/webhooks/in/${testSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testPayload,
      })
      const data = await res.json()
      setTestResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setTestResult(`Erro: ${String(err)}`)
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto w-full h-full sm:h-auto sm:w-auto rounded-none sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Endpoint' : 'Novo Endpoint'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Altere a configuração do webhook.' : 'Configure um novo endpoint de webhook.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Identification */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Identificação</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ep-name">Nome *</Label>
                <Input id="ep-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ep-slug">Slug (URL) *</Label>
                <Input id="ep-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9\-]+" title="Apenas letras minúsculas, números e hífens" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Plataforma</Label>
                <Select value={platform} onValueChange={handlePlatformChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ação padrão</Label>
                <Select value={defaultAction} onValueChange={setDefaultAction}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-desc">Descrição</Label>
              <Input id="ep-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional..." />
            </div>
          </fieldset>

          {/* Section 2: Security */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Segurança</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Autenticação</Label>
                <Select value={authType} onValueChange={setAuthType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUTH_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {authType !== 'none' && (
                <div className="space-y-1">
                  <Label htmlFor="ep-header">Header</Label>
                  <Input id="ep-header" value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} />
                </div>
              )}
            </div>
            {authType !== 'none' && (
              <div className="space-y-1">
                <Label htmlFor="ep-secret">Chave secreta</Label>
                <div className="flex gap-2">
                  <Input
                    id="ep-secret"
                    type={showSecret ? 'text' : 'password'}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? 'Ocultar' : 'Mostrar'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={generateSecret}>
                    Gerar
                  </Button>
                </div>
              </div>
            )}
          </fieldset>

          {/* Section 3: Field Mapping */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Mapeamento de Campos</legend>
            <div className="space-y-2">
              {fieldMapping.map((fm, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 p-2 sm:p-0 rounded-md sm:rounded-none border sm:border-0 border-border">
                  <Input
                    value={fm.key}
                    onChange={(e) => updateFieldMapping(i, 'key', e.target.value)}
                    placeholder="Campo CS (ex: name)"
                    className="text-xs"
                  />
                  <span className="text-muted-foreground text-xs shrink-0 hidden sm:block">&larr;</span>
                  <Input
                    value={fm.value}
                    onChange={(e) => updateFieldMapping(i, 'value', e.target.value)}
                    placeholder="Campo payload (ex: data.buyer.name)"
                    className="text-xs"
                  />
                  <button type="button" onClick={() => removeFieldMapping(i)} className="text-muted-foreground hover:text-destructive shrink-0 self-end sm:self-auto">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addFieldMapping}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar campo
              </Button>
            </div>

            <div className="space-y-1 pt-2">
              <Label htmlFor="ep-event-field">Campo de evento</Label>
              <Input
                id="ep-event-field"
                value={eventField}
                onChange={(e) => setEventField(e.target.value)}
                placeholder="ex: event, order_status, action"
                className="text-xs"
              />
            </div>

            <div className="space-y-2 pt-2">
              <Label>Mapeamento de eventos</Label>
              {eventActions.map((ea, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 p-2 sm:p-0 rounded-md sm:rounded-none border sm:border-0 border-border">
                  <Input
                    value={ea.event}
                    onChange={(e) => updateEventAction(i, 'event', e.target.value)}
                    placeholder="Evento (ex: PURCHASE_APPROVED)"
                    className="text-xs"
                  />
                  <span className="text-muted-foreground text-xs shrink-0 hidden sm:block">&rarr;</span>
                  <Select value={ea.action} onValueChange={(v) => updateEventAction(i, 'action', v)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => removeEventAction(i)} className="text-muted-foreground hover:text-destructive shrink-0 self-end sm:self-auto">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addEventAction}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar evento
              </Button>
            </div>
          </fieldset>

          {/* Section 4: Action Config */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Configurações de Ação</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Etapa padrão do kanban</Label>
                <Select value={kanbanStage || '_none'} onValueChange={(v) => setKanbanStage(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {kanbanStages.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name} ({s.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Especialista padrão</Label>
                <Select value={specialistId || '_none'} onValueChange={(v) => setSpecialistId(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {specialists.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              {isEdit && (
                <Button type="button" variant="outline" size="sm" onClick={() => setTestOpen(!testOpen)}>
                  <Send className="mr-1 h-3 w-3" /> Testar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>

          {/* Test Section */}
          {testOpen && isEdit && (
            <fieldset className="space-y-3 border border-border rounded-lg p-4">
              <legend className="text-sm font-semibold text-foreground px-1">Testar Webhook</legend>
              <Textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                placeholder='{"event": "PURCHASE_APPROVED", "data": {"buyer": {"name": "Teste", "email": "teste@email.com"}}}'
                rows={5}
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleTest} disabled={testLoading || !testPayload.trim()}>
                  {testLoading ? 'Enviando...' : 'Enviar teste'}
                </Button>
              </div>
              {testResult && (
                <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-32">
                  {testResult}
                </pre>
              )}
            </fieldset>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════
// Logs Dialog
// ═══════════════════════════════════════

function LogsDialog({
  endpoint,
  onClose,
}: {
  endpoint: WebhookEndpoint | null
  onClose: () => void
}) {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedLog, setExpandedLog] = useState<WebhookLog | null>(null)
  const pageSize = 20

  const fetchLogs = useCallback(async () => {
    if (!endpoint) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        endpoint_id: endpoint.id,
        limit: String(pageSize),
        offset: String(page * pageSize),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/webhooks/logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.data ?? [])
        setTotal(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }, [endpoint, page, statusFilter])

  useEffect(() => {
    if (endpoint) {
      setPage(0)
      setExpandedId(null)
      setExpandedLog(null)
    }
  }, [endpoint])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  async function toggleExpand(logId: string) {
    if (expandedId === logId) {
      setExpandedId(null)
      setExpandedLog(null)
      return
    }
    setExpandedId(logId)
    try {
      const res = await fetch(`/api/webhooks/logs/${logId}`)
      if (res.ok) {
        const data = await res.json()
        setExpandedLog(data)
      }
    } catch {
      setExpandedLog(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const statusIcon = (status: string) => {
    switch (status) {
      case 'processed': return <Check className="h-3.5 w-3.5 text-green-500" />
      case 'failed': return <X className="h-3.5 w-3.5 text-red-500" />
      default: return <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  return (
    <Dialog open={!!endpoint} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto w-full h-full sm:h-auto sm:w-auto rounded-none sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Logs — {endpoint?.name}</DialogTitle>
          <DialogDescription>{total} registros</DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="received">Recebido</SelectItem>
              <SelectItem value="processed">Processado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="ignored">Ignorado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchLogs}>Atualizar</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-accent" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum log encontrado.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(log.id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(log.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {log.event_type && (
                      <Badge variant="muted" className="text-[10px] font-mono">{log.event_type}</Badge>
                    )}
                    {log.action_executed && (
                      <span className="text-xs text-foreground">{ACTION_LABELS[log.action_executed] ?? log.action_executed}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {log.processing_time_ms !== null && (
                      <span className="text-[10px] text-muted-foreground">{log.processing_time_ms}ms</span>
                    )}
                    {expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {log.error_message && expandedId !== log.id && (
                  <p className="px-3 pb-2 text-xs text-destructive">{log.error_message}</p>
                )}

                {expandedId === log.id && expandedLog && (
                  <div className="border-t border-border p-3 space-y-3 bg-muted/30">
                    {expandedLog.error_message && (
                      <div>
                        <p className="text-[10px] font-semibold text-destructive uppercase mb-1">Erro</p>
                        <p className="text-xs text-destructive">{expandedLog.error_message}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Payload recebido</p>
                      <pre className="bg-card rounded p-2 text-[11px] font-mono overflow-auto max-h-40">
                        {JSON.stringify(expandedLog.payload, null, 2)}
                      </pre>
                    </div>
                    {expandedLog.action_result && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Resultado</p>
                        <pre className="bg-card rounded p-2 text-[11px] font-mono overflow-auto max-h-32">
                          {JSON.stringify(expandedLog.action_result, null, 2)}
                        </pre>
                      </div>
                    )}
                    {expandedLog.headers && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Headers</p>
                        <pre className="bg-card rounded p-2 text-[11px] font-mono overflow-auto max-h-24">
                          {JSON.stringify(expandedLog.headers, null, 2)}
                        </pre>
                      </div>
                    )}
                    {expandedLog.source_ip && (
                      <p className="text-[10px] text-muted-foreground">IP: {expandedLog.source_ip}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-3">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
