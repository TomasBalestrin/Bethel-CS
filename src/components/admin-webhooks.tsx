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
import { extractField } from '@/lib/webhook-fields'

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

interface PlatformTemplate {
  event_field: string
  field_mapping: Record<string, string>
  event_actions: Record<string, string>
  auth_header: string
  example_payload: string
}

const PLATFORM_TEMPLATES: Record<string, PlatformTemplate> = {
  hotmart: {
    event_field: 'event',
    field_mapping: { name: 'data.buyer.name', email: 'data.buyer.email', phone: 'data.buyer.phone', product_name: 'data.product.name', amount: 'data.purchase.price.value', transaction_id: 'data.purchase.transaction' },
    event_actions: { PURCHASE_APPROVED: 'create_mentee', PURCHASE_REFUNDED: 'deactivate_mentee', PURCHASE_CANCELED: 'deactivate_mentee' },
    auth_header: 'x-hotmart-hottok',
    example_payload: JSON.stringify({"event":"PURCHASE_APPROVED","data":{"buyer":{"name":"Maria Silva","email":"maria@example.com","phone":"5511999999999"},"product":{"name":"Mentoria Elite Premium","id":12345},"purchase":{"transaction":"HP1234567890","price":{"value":4997.00,"currency_code":"BRL"},"status":"APPROVED"}}}, null, 2),
  },
  kiwify: {
    event_field: 'order_status',
    field_mapping: { name: 'Customer.full_name', email: 'Customer.email', phone: 'Customer.mobile', product_name: 'Product.product_name', amount: 'Commissions.charge_amount' },
    event_actions: { paid: 'create_mentee', refunded: 'deactivate_mentee' },
    auth_header: 'x-webhook-secret',
    example_payload: JSON.stringify({"order_id":"KW-ABC123","order_status":"paid","Customer":{"full_name":"João Santos","email":"joao@example.com","mobile":"5521988888888"},"Product":{"product_name":"Mentoria Elite Premium"},"Commissions":{"charge_amount":"497.00","currency":"BRL"}}, null, 2),
  },
  mentorfy: {
    event_field: 'event',
    field_mapping: { name: 'student.name', email: 'student.email', phone: 'student.phone' },
    event_actions: {},
    auth_header: 'x-webhook-secret',
    example_payload: JSON.stringify({"event":"student.enrolled","student":{"name":"Ana Costa","email":"ana@example.com","phone":"5531977777777"},"course":{"name":"Mentoria Elite Premium","progress":0}}, null, 2),
  },
  activecampaign: {
    event_field: 'type',
    field_mapping: { name: 'contact.first_name', email: 'contact.email', phone: 'contact.phone' },
    event_actions: {},
    auth_header: 'x-webhook-secret',
    example_payload: JSON.stringify({"type":"contact_tag_added","contact":{"id":123,"first_name":"Pedro","last_name":"Lima","email":"pedro@example.com","phone":"5541966666666"},"tag":"elite-premium"}, null, 2),
  },
  closer: {
    event_field: 'event',
    field_mapping: { name: 'client.name', email: 'client.email', phone: 'client.phone', product_name: 'client.product_offered', notes: 'sale.sale_notes', instagram: 'client.instagram', funnel_origin: 'client.funnel_source', niche: 'client.niche', main_pain: 'client.main_pain', main_difficulty: 'client.main_difficulty', start_date: 'sale.sold_at', contract_validity: 'sale.contract_validity', closer_name: 'closer_name', transcription: 'transcription', has_partner: 'client.has_partner' },
    event_actions: { 'sale_closed': 'create_mentee' },
    auth_header: 'x-webhook-secret',
    example_payload: JSON.stringify({"event":"sale_closed","timestamp":"2026-03-31T12:00:00.000Z","client":{"id":"uuid","name":"Nome do Cliente","email":"email@exemplo.com","phone":"(11) 99999-9999","company":"Empresa","niche":"Nicho","instagram":"@instagram","source":"manual","sdr_name":"Nome do SDR","funnel_source":"Fonte do funil","has_partner":false,"main_pain":"Dor principal","main_difficulty":"Dificuldade principal","product_offered":"Elite"},"sale":{"sold_at":"2026-03-31","contract_validity":"12 meses","sale_notes":"Observações da venda"},"closer_name":"Nome do Closer","transcription":"Transcrição completa da última call"}, null, 2),
  },
  metrics: {
    event_field: '',
    field_mapping: {
      name: 'mentorado.nome', email: 'mentorado.email', phone: 'mentorado.telefone',
      faturamento_atual: 'faturamento_atual', faturamento_mes_anterior: 'faturamento_mes_anterior',
      faturamento_antes_mentoria: 'faturamento_anterior.valor',
      dias_acessou_sistema: 'dias_acessou_sistema', ultimo_acesso: 'ultimo_acesso',
      dias_preencheu: 'dias_preencheu', total_leads: 'resumo_periodo.total_leads',
      total_vendas: 'resumo_periodo.total_vendas', total_receita_periodo: 'resumo_periodo.total_receita',
      total_entrada_periodo: 'resumo_periodo.total_entrada', taxa_conversao: 'resumo_periodo.conversao',
      ticket_medio: 'resumo_periodo.ticket_medio', funis_ativos: 'funis_ativos',
    },
    event_actions: {},
    auth_header: 'x-webhook-secret',
    example_payload: JSON.stringify({"mentorado":{"id":"uuid-do-mentorado","nome":"João Silva","email":"joao@email.com","telefone":"(11) 99999-9999","cpf":"12345678900","criado_em":"2026-01-15T10:00:00Z"},"faturamento_atual":25000.00,"faturamento_mes_anterior":18000.00,"faturamento_anterior":{"valor":5000.00,"fonte":"avg_revenue_before_mentoring"},"dias_acessou_sistema":22,"ultimo_acesso":"2026-03-31T14:30:00Z","dias_preencheu":18,"funis_ativos":[{"id":"uuid-funil-1","nome":"Funil Levantada de Mão","slug":"traffic"},{"id":"uuid-funil-2","nome":"Funil de Indicação","slug":"referral"}],"resumo_periodo":{"total_leads":200,"total_vendas":15,"total_receita":25000.00,"total_entrada":5000.00,"conversao":7.5,"ticket_medio":1666.67}}, null, 2),
  },
  custom: {
    event_field: '',
    field_mapping: {},
    event_actions: {},
    auth_header: 'x-webhook-secret',
    example_payload: '{\n  \n}',
  },
}

// Guided mapping fields with icons and labels
const GUIDED_FIELDS: Array<{ key: string; label: string; icon: string; recommended?: boolean }> = [
  { key: 'email', label: 'Email', icon: '📧', recommended: true },
  { key: 'name', label: 'Nome completo', icon: '👤' },
  { key: 'phone', label: 'Telefone', icon: '📱' },
  { key: 'product_name', label: 'Produto', icon: '📦' },
  { key: 'amount', label: 'Valor pago', icon: '💰' },
  { key: 'transaction_id', label: 'ID da transação', icon: '🔑' },
  { key: 'notes', label: 'Notas da venda', icon: '📝' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'funnel_origin', label: 'Funil de origem', icon: '🔄' },
  { key: 'niche', label: 'Nicho', icon: '🏷️' },
  { key: 'main_pain', label: 'Dor principal', icon: '🎯' },
  { key: 'main_difficulty', label: 'Dificuldade principal', icon: '⚠️' },
  { key: 'start_date', label: 'Data da venda', icon: '📅' },
  { key: 'contract_validity', label: 'Validade do contrato', icon: '📄' },
  { key: 'closer_name', label: 'Nome do Closer', icon: '🤝' },
  { key: 'transcription', label: 'Transcrição da call', icon: '🎙️' },
  { key: 'has_partner', label: 'Tem sócio', icon: '👥' },
  { key: 'faturamento_atual', label: 'Faturamento atual', icon: '💵' },
  { key: 'faturamento_mes_anterior', label: 'Faturamento mês anterior', icon: '💵' },
  { key: 'faturamento_antes_mentoria', label: 'Faturamento antes mentoria', icon: '💵' },
  { key: 'dias_acessou_sistema', label: 'Dias acessou sistema', icon: '📊' },
  { key: 'ultimo_acesso', label: 'Último acesso', icon: '🕐' },
  { key: 'dias_preencheu', label: 'Dias preencheu dados', icon: '📊' },
  { key: 'total_leads', label: 'Total leads', icon: '👥' },
  { key: 'total_vendas', label: 'Total vendas', icon: '🛒' },
  { key: 'total_receita_periodo', label: 'Receita do período', icon: '💰' },
  { key: 'total_entrada_periodo', label: 'Entrada do período', icon: '💰' },
  { key: 'taxa_conversao', label: 'Taxa de conversão', icon: '📈' },
  { key: 'ticket_medio', label: 'Ticket médio', icon: '🎫' },
  { key: 'funis_ativos', label: 'Funis ativos', icon: '🔄' },
]

const PLATFORM_LABELS: Record<string, string> = {
  hotmart: 'Hotmart',
  kiwify: 'Kiwify',
  mentorfy: 'Mentorfy',
  activecampaign: 'ActiveCampaign',
  closer: 'Bethel Closer',
  metrics: 'Bethel Metrics',
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

        // Load example payload for the platform
        const tmpl = PLATFORM_TEMPLATES[endpoint.platform]
        setTestPayload(tmpl?.example_payload ?? '')
      } else {
        resetForm()
      }
      setError(null)
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
    const template = PLATFORM_TEMPLATES[value]
    if (template) {
      if (!isEdit) {
        setEventField(template.event_field)
        setAuthHeader(template.auth_header)
        setFieldMapping(Object.entries(template.field_mapping).map(([key, v]) => ({ key, value: v })))
        setEventActions(Object.entries(template.event_actions).map(([event, action]) => ({ event, action })))
      }
      setTestPayload(template.example_payload)
    }
  }

  function generateSecret() {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    setSecretKey(Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(''))
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

          {/* Section 3: Guided Field Mapping */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Mapeamento de Campos</legend>
            <p className="text-xs text-muted-foreground">Informe o caminho de cada campo no JSON da plataforma. Campos vazios são ignorados.</p>
            <div className="space-y-2">
              {GUIDED_FIELDS.map((gf) => {
                const fm = fieldMapping.find((f) => f.key === gf.key)
                const value = fm?.value ?? ''
                return (
                  <div key={gf.key} className="flex items-center gap-2">
                    <span className="text-sm shrink-0 w-36 flex items-center gap-1.5">
                      <span>{gf.icon}</span>
                      <span className="text-xs text-foreground">{gf.label}</span>
                      {gf.recommended && <span className="text-[9px] text-accent">*</span>}
                    </span>
                    <span className="text-muted-foreground text-xs shrink-0">&rarr;</span>
                    <Input
                      value={value}
                      onChange={(e) => {
                        const updated = fieldMapping.filter((f) => f.key !== gf.key)
                        if (e.target.value) updated.push({ key: gf.key, value: e.target.value })
                        setFieldMapping(updated)
                      }}
                      placeholder={`ex: data.buyer.${gf.key}`}
                      className="text-xs font-mono"
                    />
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">* Recomendado (usado para deduplicação)</p>
          </fieldset>

          {/* Section 3b: Event Mapping */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Mapeamento de Eventos</legend>
            <div className="space-y-1">
              <Label htmlFor="ep-event-field">Campo que identifica o evento</Label>
              <Input
                id="ep-event-field"
                value={eventField}
                onChange={(e) => setEventField(e.target.value)}
                placeholder="ex: event, order_status, action"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-2 pt-2">
              <Label>Quando o valor for... executar ação:</Label>
              {eventActions.map((ea, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
                  <Input
                    value={ea.event}
                    onChange={(e) => updateEventAction(i, 'event', e.target.value)}
                    placeholder="Valor do evento"
                    className="text-xs font-mono"
                  />
                  <span className="text-muted-foreground text-xs shrink-0 hidden sm:block">&rarr;</span>
                  <Select value={ea.action} onValueChange={(v) => updateEventAction(i, 'action', v)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([val, lab]) => (
                        <SelectItem key={val} value={val}>{lab}</SelectItem>
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

          {/* Section 3c: Live Preview */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Testar Mapeamento</legend>
            <p className="text-xs text-muted-foreground">Cole um payload de exemplo para verificar a extração dos campos.</p>
            <Textarea
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              placeholder="Cole aqui o JSON de exemplo..."
              rows={6}
              className="font-mono text-xs"
            />
            <MappingPreview
              payload={testPayload}
              fieldMapping={fieldMapping}
              eventField={eventField}
              eventActions={eventActions}
              defaultAction={defaultAction}
            />
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
              {isEdit && testPayload.trim() && (
                <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testLoading}>
                  <Send className="mr-1 h-3 w-3" /> {testLoading ? 'Enviando...' : 'Enviar teste real'}
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

          {testResult && (
            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-32">
              {testResult}
            </pre>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════
// Mapping Preview (live extraction result)
// ═══════════════════════════════════════

function MappingPreview({
  payload,
  fieldMapping,
  eventField,
  eventActions,
  defaultAction,
}: {
  payload: string
  fieldMapping: Array<{ key: string; value: string }>
  eventField: string
  eventActions: Array<{ event: string; action: string }>
  defaultAction: string
}) {
  if (!payload.trim()) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-xs text-destructive">JSON inválido. Verifique a sintaxe.</p>
      </div>
    )
  }

  // Extract fields
  const results: Array<{ key: string; label: string; icon: string; value: unknown; found: boolean }> = []
  for (const gf of GUIDED_FIELDS) {
    const fm = fieldMapping.find((f) => f.key === gf.key)
    if (fm?.value) {
      const extracted = extractField(parsed, fm.value)
      results.push({ key: gf.key, label: gf.label, icon: gf.icon, value: extracted, found: extracted !== undefined && extracted !== null })
    } else {
      results.push({ key: gf.key, label: gf.label, icon: gf.icon, value: undefined, found: false })
    }
  }

  // Detect event
  let detectedEvent: string | null = null
  let detectedAction = defaultAction
  if (eventField) {
    const ev = extractField(parsed, eventField)
    if (typeof ev === 'string') {
      detectedEvent = ev
      const match = eventActions.find((ea) => ea.event === ev)
      if (match) detectedAction = match.action
    }
  }

  // Format value for display
  function formatValue(key: string, val: unknown): string {
    if (val === undefined || val === null) return '(não mapeado)'
    if (key === 'amount' && typeof val === 'number') {
      return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    }
    return String(val)
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Resultado da extração</p>
      <div className="space-y-1">
        {results.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className={r.found ? 'text-green-600' : 'text-muted-foreground/50'}>
              {r.found ? '✅' : '⬜'}
            </span>
            <span className="w-28 shrink-0 text-muted-foreground">{r.icon} {r.label}:</span>
            <span className={`font-mono ${r.found ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
              {formatValue(r.key, r.value)}
            </span>
          </div>
        ))}
      </div>
      {eventField && (
        <div className="border-t border-border pt-2 mt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Evento detectado:</span>
            <span className="font-mono font-medium text-foreground">{detectedEvent ?? '(não encontrado)'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Ação:</span>
            <Badge variant="muted" className="text-[10px]">{ACTION_LABELS[detectedAction] ?? detectedAction}</Badge>
          </div>
        </div>
      )}
    </div>
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
