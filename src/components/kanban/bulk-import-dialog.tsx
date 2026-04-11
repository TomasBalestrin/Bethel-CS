'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type * as XLSXType from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, ArrowRight, Users, ClipboardList, GitBranch, CalendarCheck, UserCheck, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { bulkCreateMentees, bulkUpdateMentees, bulkImportActionPlans, bulkImportStages, bulkImportDeliveryEvents, bulkImportDeliveryParticipations } from '@/lib/actions/mentee-actions'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  required: boolean
  type: 'text' | 'date' | 'number' | 'status' | 'state'
  aliases: string[]
}

export type ImportTab = 'mentees' | 'update_mentees' | 'action_plan' | 'stages' | 'delivery_events' | 'delivery_participations'
type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

interface ImportResult {
  total: number
  created: number
  errors: { row: number; name: string; error: string }[]
  importedMenteeIds?: string[]
}

interface AiExtractionResult {
  processed: number
  updated: number
  results: { menteeId: string; name: string; extracted: Record<string, unknown>; error?: string }[]
}

// ─── Field Definitions: Mentorados ──────────────────────────────────────────

const MENTEE_FIELDS: FieldDef[] = [
  { key: 'full_name', label: 'Nome completo', required: true, type: 'text', aliases: ['nome', 'name', 'nome completo', 'full name'] },
  { key: 'phone', label: 'Telefone', required: true, type: 'text', aliases: ['telefone', 'fone', 'celular', 'phone', 'whatsapp', 'tel'] },
  { key: 'product_name', label: 'Produto Contratado', required: true, type: 'text', aliases: ['produto', 'product', 'produto contratado', 'plano', 'mentoria', 'tipo de produto'] },
  { key: 'start_date', label: 'Data de Entrada', required: true, type: 'date', aliases: ['entrada', 'inicio', 'início', 'start', 'data entrada', 'data início', 'start date', 'data de entrada', 'data inicio'] },
  { key: 'status', label: 'Situação', required: false, type: 'status', aliases: ['situação', 'situacao', 'status', 'estado do cliente', 'ativo'] },
  { key: 'closer_name', label: 'Closer (Vendedor)', required: false, type: 'text', aliases: ['closer', 'vendedor', 'seller', 'vendedor que vendeu', 'consultor', 'closer responsável'] },
  { key: 'cpf', label: 'CPF', required: false, type: 'text', aliases: ['cpf', 'documento', 'doc'] },
  { key: 'email', label: 'Email', required: false, type: 'text', aliases: ['email', 'e-mail', 'mail', 'e mail'] },
  { key: 'instagram', label: '@Instagram', required: false, type: 'text', aliases: ['instagram', '@instagram', 'insta', 'ig', '@'] },
  { key: 'city', label: 'Cidade', required: false, type: 'text', aliases: ['cidade', 'city', 'municipio', 'município'] },
  { key: 'state', label: 'Estado (UF)', required: false, type: 'state', aliases: ['estado', 'uf', 'state', 'uf estado'] },
  { key: 'birth_date', label: 'Aniversário', required: false, type: 'date', aliases: ['aniversario', 'aniversário', 'nascimento', 'data nascimento', 'dt nascimento', 'birthday', 'birth date'] },
  { key: 'end_date', label: 'Data de Encerramento', required: false, type: 'date', aliases: ['encerramento', 'fim', 'end', 'data fim', 'validade', 'data encerramento', 'end date', 'data de encerramento'] },
  { key: 'faturamento_antes_mentoria', label: 'Faturamento Mês 1', required: false, type: 'number', aliases: ['faturamento inicial', 'fat inicial', 'faturamento antes', 'receita inicial', 'fat antes mentoria', 'faturamento antes da mentoria', 'fat 1', 'fat 1 mes', 'fat 1. mes', 'fat 1 mês', 'fat. 1 mes'] },
  { key: 'faturamento_mes_anterior', label: 'Faturamento Mês 2', required: false, type: 'number', aliases: ['faturamento mês anterior', 'fat mês anterior', 'fat mes anterior', 'faturamento mes anterior', 'fat 2', 'fat 2 mes', 'fat. 2 mes', 'fat 2 mês', 'fat. 2 mês'] },
  { key: 'faturamento_atual', label: 'Faturamento Mês 3', required: false, type: 'number', aliases: ['faturamento atual', 'fat atual', 'faturamento hoje', 'receita atual', 'fat 3', 'fat 3 mes', 'fat 3 mês', 'fat. 3 mes'] },
  { key: 'contract_validity', label: 'Período do Contrato', required: false, type: 'text', aliases: ['período', 'periodo', 'contract validity', 'duração', 'duracao', 'vigencia', 'vigência'] },
  { key: 'notes', label: 'Observações', required: false, type: 'text', aliases: ['observações', 'observacoes', 'obs', 'notes', 'anotações', 'notas', 'n° duvidas', 'n duvidas', 'numero duvidas', 'gestao - indicadores', 'comercial - sdr'] },
  { key: 'niche', label: 'Nicho', required: false, type: 'text', aliases: ['nicho', 'niche', 'segmento', 'área de atuação'] },
  { key: 'specialist_name', label: 'Especialista Responsável', required: false, type: 'text', aliases: ['especialista', 'especialista responsável', 'especialista responsavel', 'specialist', 'cs responsável', 'cs responsavel', 'responsável', 'responsavel'] },
  { key: 'source', label: 'Tráfego / Origem', required: false, type: 'text', aliases: ['trafego', 'tráfego', 'trafego com movi', 'tráfego com movi', 'origem', 'source', 'movi'] },
  { key: 'webhook_notes', label: 'Integrações (Nextrack/Unia)', required: false, type: 'text', aliases: ['nextrack', 'unia', 'integração', 'integracao', 'integracoes'] },
]

// ─── Field Definitions: Action Plan ─────────────────────────────────────────

const ACTION_PLAN_FIELDS: FieldDef[] = [
  { key: '__match_value', label: 'Nome / Telefone (Identificação)', required: true, type: 'text', aliases: ['nome completo', 'qual o seu nome completo'] },
  { key: 'has_partner', label: 'Sócio na mentoria', required: false, type: 'text', aliases: ['mentoria com sociedade', 'nome do seu socio na mentoria'] },
  { key: 'instagram', label: '@Instagram', required: false, type: 'text', aliases: ['@ do seu instagram', 'qual o @ do seu instagram'] },
  { key: 'email', label: 'Email', required: false, type: 'text', aliases: ['seu e-mail principal', 'qual o seu e-mail principal'] },
  { key: '__match_phone', label: 'WhatsApp', required: false, type: 'text', aliases: ['qual o seu whatsapp', 'seu whatsapp'] },
  { key: 'cpf', label: 'CPF', required: false, type: 'text', aliases: ['qual seu cpf', 'cpf sem pontos'] },
  { key: 'endereco_completo', label: 'Endereço completo', required: false, type: 'text', aliases: ['endereco completo', 'qual o seu endereco completo'] },
  { key: 'cidade', label: 'Cidade', required: false, type: 'text', aliases: ['qual cidade voce possui o seu negocio', 'cidade voce possui'] },
  { key: 'estado', label: 'Estado', required: false, type: 'text', aliases: ['qual estado voce possui o seu negocio', 'estado voce possui'] },
  { key: 'data_aniversario', label: 'Data de nascimento', required: false, type: 'text', aliases: ['data de nascimento completa', 'qual sua data de nascimento'] },
  { key: 'como_nos_conheceu', label: 'Como nos conheceu', required: false, type: 'text', aliases: ['por onde voce nos conheceu', 'como nos conheceu'] },
  { key: 'motivacao_elite_premium', label: 'Por que decidiu entrar', required: false, type: 'text', aliases: ['decidiu fazer parte da elite premium', 'por que voce decidiu fazer parte'] },
  { key: 'expectativas_resultados', label: 'Expectativas de resultados', required: false, type: 'text', aliases: ['espera de resultados ao final', 'o que voce espera de resultados'] },
  { key: 'atuacao_profissional', label: 'Atuação profissional', required: false, type: 'text', aliases: ['o que voce faz hoje profissionalmente', 'profissionalmente falando'] },
  { key: 'tempo_atuacao', label: 'Tempo de atuação', required: false, type: 'text', aliases: ['ha quanto tempo voce atua com isso', 'quanto tempo voce atua'] },
  { key: 'produtos_servicos', label: 'Produtos/Serviços', required: false, type: 'text', aliases: ['4 principais produtos/servicos', 'quais sao os 4 principais produtos'] },
  { key: 'funis_venda', label: 'Funis de venda ativos', required: false, type: 'text', aliases: ['como voce vende hoje quais funis', 'quais funis de venda estao ativos'] },
  { key: 'processo_venda', label: 'Processo de venda', required: false, type: 'text', aliases: ['como voce passa o preco para o seu cliente', 'primeira mensagem ate o fechamento'] },
  { key: 'faturamento_medio', label: 'Faturamento médio (últimos 3 meses)', required: false, type: 'text', aliases: ['media de faturamento mensal', 'qual a sua media de faturamento'] },
  { key: 'resultado_funis', label: 'Resultado por funil', required: false, type: 'text', aliases: ['quanto cada funil gerou de resultado', 'cada funil gerou de resultado em r'] },
  { key: 'erros_identificados', label: 'Erros identificados', required: false, type: 'text', aliases: ['quais erros voce identifica em cada', 'erros identifica em cada um dos seus funis'] },
  { key: 'desafios_funis', label: 'Desafios nos funis', required: false, type: 'text', aliases: ['principais desafios que voce encontra', 'quais sao os principais desafios'] },
  { key: 'funis_testados', label: 'Funis testados que não funcionaram', required: false, type: 'text', aliases: ['quais novos funis voce ja testou', 'novos funis voce ja testou e nao funcionaram'] },
  { key: 'estrutura_comercial', label: 'Estrutura comercial', required: false, type: 'text', aliases: ['qual e a sua estrutura comercial hoje', 'sua estrutura comercial hoje'] },
  { key: 'estrutura_marketing', label: 'Estrutura de marketing', required: false, type: 'text', aliases: ['qual e a sua estrutura de marketing', 'sua estrutura de marketing'] },
  { key: 'entrega_produto', label: 'Entrega do produto/serviço', required: false, type: 'text', aliases: ['como funciona a entrega do seu produto', 'entrega do seu produto/servico'] },
  { key: 'estrutura_gestao', label: 'Estrutura de gestão', required: false, type: 'text', aliases: ['qual e a sua estrutura de gestao hoje', 'sua estrutura de gestao hoje'] },
  { key: 'equipe', label: 'Equipe', required: false, type: 'text', aliases: ['quantas pessoas trabalham com voce', 'qual a funcao de cada uma'] },
  { key: 'momento_negocio', label: 'Momento do negócio', required: false, type: 'text', aliases: ['na sua visao qual o momento do seu negocio', 'qual o momento do seu negocio hoje'] },
  { key: 'objetivos_urgentes', label: 'Objetivos urgentes', required: false, type: 'text', aliases: ['objetivos mais urgentes para atingir', 'quais os objetivos mais urgentes'] },
  { key: 'visao_futuro', label: 'Visão de futuro', required: false, type: 'text', aliases: ['onde voce ve o seu negocio em 6 meses', 'negocio em 6 meses 1 ano e 5 anos'] },
  { key: 'nome_empresa', label: 'Nome da empresa', required: false, type: 'text', aliases: ['nome da empresa'] },
  { key: 'nicho', label: 'Nicho', required: false, type: 'text', aliases: ['nicho', 'segmento'] },
  { key: 'num_colaboradores', label: 'Nº de colaboradores', required: false, type: 'text', aliases: ['numero de colaboradores', 'n de colaboradores'] },
]

// ─── Field Definitions: Stages ──────────────────────────────────────────────

const STAGE_FIELDS: FieldDef[] = [
  { key: '__match_value', label: 'Nome / Telefone (Identificação)', required: true, type: 'text', aliases: ['nome', 'nome completo', 'name', 'telefone', 'whatsapp', 'phone'] },
  { key: '__stage_name', label: 'Nome da Etapa', required: true, type: 'text', aliases: ['etapa', 'stage', 'fase', 'funil', 'status', 'etapa atual', 'estagio'] },
]

// ─── Field Definitions: Delivery Events ───────────────────────────────────

const DELIVERY_EVENT_FIELDS: FieldDef[] = [
  { key: 'date', label: 'Data da entrega', required: true, type: 'date', aliases: ['data', 'date', 'dia', 'data da entrega', 'data entrega'] },
  { key: 'type', label: 'Tipo de entrega', required: true, type: 'text', aliases: ['tipo', 'type', 'entrega', 'tipo de entrega', 'categoria', 'hotseat', 'comercial', 'gestao', 'gestão', 'mkt', 'marketing', 'extras', 'mentoria individual'] },
]

// ─── Field Definitions: Delivery Participations ───────────────────────────

const DELIVERY_PARTICIPATION_FIELDS: FieldDef[] = [
  { key: 'date', label: 'Data da entrega', required: true, type: 'date', aliases: ['data', 'date', 'dia', 'data da entrega', 'data entrega'] },
  { key: 'type', label: 'Tipo de entrega', required: true, type: 'text', aliases: ['tipo', 'type', 'entrega', 'tipo de entrega', 'categoria'] },
  { key: 'name', label: 'Nome do mentorado', required: false, type: 'text', aliases: ['nome', 'name', 'nome completo', 'full name', 'mentorado'] },
  { key: 'phone', label: 'Telefone', required: false, type: 'text', aliases: ['telefone', 'phone', 'whatsapp', 'cel', 'celular'] },
  { key: 'email', label: 'Email', required: false, type: 'text', aliases: ['email', 'e-mail', 'mail'] },
]

const SKIP_VALUE = '__skip__'

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s./@-]/g, '').replace(/\s+/g, ' ').trim()
}

function autoDetectMapping(headers: string[], fields: FieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  // First pass: try exact matches and long alias includes (>15 chars)
  for (const header of headers) {
    const norm = normalizeHeader(header)
    let bestMatch: string | null = null
    let bestLen = 0
    for (const field of fields) {
      for (const alias of field.aliases) {
        const normAlias = normalizeHeader(alias)
        if (normAlias === norm) {
          // Exact match — highest priority
          bestMatch = field.key
          bestLen = 999
          break
        }
        // Only use includes for aliases with 10+ chars (avoids false positives with short words)
        if (normAlias.length >= 10 && norm.includes(normAlias) && normAlias.length > bestLen) {
          bestMatch = field.key
          bestLen = normAlias.length
        }
      }
      if (bestLen === 999) break
    }
    mapping[header] = bestMatch || SKIP_VALUE
  }
  return mapping
}

// ─── Tab Config ─────────────────────────────────────────────────────────────

const TABS: { key: ImportTab; label: string; icon: typeof Users; description: string }[] = [
  { key: 'mentees', label: 'Mentorados', icon: Users, description: 'Criar novos mentorados a partir de CSV/Excel' },
  { key: 'update_mentees', label: 'Atualizar', icon: RefreshCw, description: 'Atualizar dados de mentorados existentes (identifica pelo telefone). Ideal para corrigir datas, nomes, etc.' },
  { key: 'action_plan', label: 'Plano de Ação', icon: ClipboardList, description: 'Importar respostas do formulário para mentorados existentes' },
  { key: 'stages', label: 'Etapas', icon: GitBranch, description: 'Atualizar a etapa do funil de mentorados existentes' },
  { key: 'delivery_events', label: 'Entregas', icon: CalendarCheck, description: 'Importar datas das entregas da mentoria (Hotseat, Comercial, etc.)' },
  { key: 'delivery_participations', label: 'Participação', icon: UserCheck, description: 'Importar quem participou de cada entrega (identifica por nome, telefone ou email)' },
]

// ─── Component ──────────────────────────────────────────────────────────────

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  specialists?: { id: string; full_name: string }[]
  isAdmin?: boolean
  initialTab?: ImportTab
  visibleTabs?: ImportTab[]
}

export function BulkImportDialog({ open, onOpenChange, specialists = [], isAdmin = false, initialTab, visibleTabs }: BulkImportDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const effectiveInitialTab = initialTab ?? (visibleTabs ? visibleTabs[0] : 'mentees')
  const [activeTab, setActiveTab] = useState<ImportTab>(effectiveInitialTab)
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string | number>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [defaultSpecialistId, setDefaultSpecialistId] = useState('')
  const [matchField, setMatchField] = useState<'full_name' | 'phone' | 'email'>('full_name')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiResult, setAiResult] = useState<AiExtractionResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const currentFields = activeTab === 'mentees' ? MENTEE_FIELDS
    : activeTab === 'update_mentees' ? MENTEE_FIELDS
    : activeTab === 'action_plan' ? ACTION_PLAN_FIELDS
    : activeTab === 'stages' ? STAGE_FIELDS
    : activeTab === 'delivery_events' ? DELIVERY_EVENT_FIELDS
    : DELIVERY_PARTICIPATION_FIELDS

  function reset() {
    setStep('upload')
    setFileName('')
    setHeaders([])
    setRows([])
    setMapping({})
    setDefaultSpecialistId('')
    setResult(null)
    setAiExtracting(false)
    setAiResult(null)
    setAiError(null)
    setActiveTab(effectiveInitialTab)
  }

  function switchTab(tab: ImportTab) {
    reset()
    setActiveTab(tab)
  }

  function handleClose(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  function processWorkbook(XLSX: typeof XLSXType, wb: XLSXType.WorkBook) {
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })
    if (data.length === 0) return
    const hdrs = Object.keys(data[0])
    setHeaders(hdrs)
    setRows(data)
    setMapping(autoDetectMapping(hdrs, currentFields))
    setStep('mapping')
  }

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const XLSX = await import('xlsx')
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array', cellDates: false })
      processWorkbook(XLSX, wb)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function getMappedRow(raw: Record<string, string | number>): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (fieldKey === SKIP_VALUE) continue
      out[fieldKey] = raw[header]
    }
    return out
  }

  const previewRows = rows.slice(0, 5).map(getMappedRow)
  // For update mode, only phone is required (to match existing mentees)
  const requiredFields = activeTab === 'update_mentees'
    ? currentFields.filter((f) => f.key === 'phone')
    : currentFields.filter((f) => f.required)
  const mappedFieldKeys = Object.values(mapping).filter((v) => v !== SKIP_VALUE)
  const missingRequired = requiredFields.filter((f) => !mappedFieldKeys.includes(f.key))

  async function handleImport() {
    setStep('importing')
    let res: ImportResult

    if (activeTab === 'mentees') {
      const mapped = rows.map(getMappedRow)
      res = await bulkCreateMentees({ rows: mapped, defaultSpecialistId: defaultSpecialistId || undefined })
    } else if (activeTab === 'update_mentees') {
      const mapped = rows.map(getMappedRow)
      res = await bulkUpdateMentees({ rows: mapped })
    } else if (activeTab === 'action_plan') {
      const mapped = rows.map((raw) => {
        const out = getMappedRow(raw)
        const matchVal = String(out.__match_value ?? '')
        out.__display_name = matchVal
        return out
      })
      res = await bulkImportActionPlans({ rows: mapped, matchField })
    } else if (activeTab === 'stages') {
      const mapped = rows.map((raw) => {
        const out = getMappedRow(raw)
        return {
          matchValue: String(out.__match_value ?? ''),
          stageName: String(out.__stage_name ?? ''),
        }
      })
      res = await bulkImportStages({ rows: mapped, matchField })
    } else if (activeTab === 'delivery_events') {
      const mapped = rows.map((raw) => {
        const out = getMappedRow(raw)
        return { date: String(out.date ?? ''), type: String(out.type ?? '') }
      })
      res = await bulkImportDeliveryEvents({ rows: mapped })
    } else {
      const mapped = rows.map((raw) => {
        const out = getMappedRow(raw)
        return {
          date: String(out.date ?? ''),
          type: String(out.type ?? ''),
          name: out.name ? String(out.name) : undefined,
          phone: out.phone ? String(out.phone) : undefined,
          email: out.email ? String(out.email) : undefined,
        }
      })
      res = await bulkImportDeliveryParticipations({ rows: mapped })
    }

    setResult(res)
    setStep('done')
    router.refresh()

    // After action plan import, trigger AI extraction in the background
    if (activeTab === 'action_plan' && res.created > 0 && res.importedMenteeIds && res.importedMenteeIds.length > 0) {
      setAiExtracting(true)
      setAiError(null)
      try {
        const response = await fetch('/api/action-plans/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menteeIds: res.importedMenteeIds }),
        })
        if (response.ok) {
          const data: AiExtractionResult = await response.json()
          setAiResult(data)
        } else {
          const err = await response.json()
          setAiError(err.error || 'Erro na extração por IA')
        }
      } catch {
        setAiError('Erro de conexão com o servidor')
      } finally {
        setAiExtracting(false)
        router.refresh()
      }
    }
  }

  const tabLabels: Record<ImportTab, { importing: string; button: string; success: string }> = {
    mentees: { importing: 'Importando mentorados...', button: `Importar ${rows.length} mentorados`, success: 'importados' },
    update_mentees: { importing: 'Atualizando mentorados...', button: `Atualizar ${rows.length} mentorados`, success: 'atualizados' },
    action_plan: { importing: 'Importando planos de ação...', button: `Importar ${rows.length} planos`, success: 'vinculados' },
    stages: { importing: 'Atualizando etapas...', button: `Atualizar ${rows.length} etapas`, success: 'atualizados' },
    delivery_events: { importing: 'Importando entregas...', button: `Importar ${rows.length} entregas`, success: 'importadas' },
    delivery_participations: { importing: 'Importando participações...', button: `Importar ${rows.length} participações`, success: 'registradas' },
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden w-[95vw] sm:w-full rounded-2xl sm:rounded-lg flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Dados</DialogTitle>
          <DialogDescription>
            Faça upload de CSV ou Excel para importar dados em massa.
          </DialogDescription>
        </DialogHeader>

        {/* Tab selector */}
        {step === 'upload' && (
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 shrink-0">
            {(visibleTabs ? TABS.filter((t) => visibleTabs.includes(t.key)) : TABS).map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ maxHeight: '55vh' }}>
          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div className="space-y-4 p-1">
              <p className="text-sm text-muted-foreground">
                {TABS.find((t) => t.key === activeTab)?.description}
              </p>

              <div
                className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-10 ${dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-muted/30'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium text-foreground text-sm">Arraste o arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-0.5">CSV ou Excel (.xlsx, .xls)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              {activeTab !== 'mentees' && activeTab !== 'update_mentees' && activeTab !== 'delivery_events' && activeTab !== 'delivery_participations' && (
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-sm font-medium">Identificar mentorado por:</p>
                  <Select value={matchField} onValueChange={(v) => setMatchField(v as typeof matchField)}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_name">Nome completo</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs font-medium">Campos reconhecidos:</p>
                <div className="flex flex-wrap gap-1">
                  {currentFields.filter((f) => f.required).map((f) => (
                    <Badge key={f.key} variant="default" className="text-[10px]">{f.label} *</Badge>
                  ))}
                  {currentFields.filter((f) => !f.required).slice(0, 12).map((f) => (
                    <Badge key={f.key} variant="secondary" className="text-[10px]">{f.label}</Badge>
                  ))}
                  {currentFields.filter((f) => !f.required).length > 12 && (
                    <Badge variant="secondary" className="text-[10px]">+{currentFields.filter((f) => !f.required).length - 12} mais</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: mapping ── */}
          {step === 'mapping' && (
            <div className="space-y-4 p-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="font-medium text-foreground">{fileName}</span>
                <span>— {rows.length} linhas</span>
              </div>

              {activeTab === 'mentees' && isAdmin && specialists.length > 0 && (
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-sm font-medium">Especialista padrão</p>
                  <Select value={defaultSpecialistId} onValueChange={setDefaultSpecialistId}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Selecione o especialista" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialists.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Mapeamento de colunas</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
                    <span>Coluna na planilha</span>
                    <span />
                    <span>Campo no sistema</span>
                  </div>
                  <div className="divide-y divide-border">
                    {headers.map((header) => (
                      <div key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1.5">
                        <span className="text-sm font-medium truncate" title={header}>{header}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Select
                          value={mapping[header] ?? SKIP_VALUE}
                          onValueChange={(v) => setMapping((prev) => ({ ...prev, [header]: v }))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>— Ignorar —</SelectItem>
                            {currentFields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}{f.required ? ' *' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-destructive">
                    <p className="font-medium">Campos obrigatórios sem mapeamento:</p>
                    <p>{missingRequired.map((f) => f.label).join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <div className="space-y-4 p-1">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Prévia dos primeiros {previewRows.length} de {rows.length} registros</span>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {mappedFieldKeys.map((key) => {
                          const field = currentFields.find((f) => f.key === key)
                          return (
                            <th key={key} className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {field?.label ?? key}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          {mappedFieldKeys.map((key) => (
                            <td key={key} className="px-2 py-1.5 truncate max-w-[140px]" title={String(row[key] ?? '')}>
                              {String(row[key] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{rows.length} registros serão processados</p>
              </div>
            </div>
          )}

          {/* ── STEP: importing ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">{tabLabels[activeTab].importing}</p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && result && (
            <div className="space-y-4 p-1">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="font-medium text-lg">{result.created} de {result.total} {tabLabels[activeTab].success} com sucesso</p>
                  {result.errors.length > 0 && (
                    <p className="text-sm text-muted-foreground">{result.errors.length} com erro</p>
                  )}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 overflow-hidden">
                  <div className="bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Registros com erro
                  </div>
                  <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-sm">
                        <span className="font-medium">Linha {e.row}</span>
                        {e.name && <span className="text-muted-foreground"> · {e.name}</span>}
                        <span className="text-destructive"> — {e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Extraction Status (action plan tab only) */}
              {activeTab === 'action_plan' && result.created > 0 && (
                <div className="rounded-lg border border-accent/20 overflow-hidden">
                  <div className="bg-accent/5 px-3 py-2 text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    Extração por IA — Nicho, Empresa, Colaboradores, Faturamento
                  </div>
                  <div className="p-3">
                    {aiExtracting && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                        <span>Analisando respostas com IA para extrair dados do negócio...</span>
                      </div>
                    )}
                    {aiError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span>{aiError}</span>
                      </div>
                    )}
                    {aiResult && (
                      <div className="space-y-2">
                        <p className="text-sm">
                          <span className="font-medium text-success">{aiResult.updated}</span> de {aiResult.processed} mentorados tiveram dados extraídos e atualizados
                        </p>
                        {aiResult.results.filter((r) => !r.error && Object.keys(r.extracted).length > 0).length > 0 && (
                          <div className="divide-y divide-border max-h-40 overflow-y-auto rounded border border-border">
                            {aiResult.results
                              .filter((r) => !r.error && Object.keys(r.extracted).length > 0)
                              .map((r, i) => {
                                const applied = (r.extracted.applied ?? {}) as Record<string, unknown>
                                const fields = Object.entries(applied)
                                  .filter(([k]) => k !== 'updated_at')
                                  .map(([k, v]) => {
                                    const labels: Record<string, string> = {
                                      niche: 'Nicho', nome_empresa: 'Empresa',
                                      num_colaboradores: 'Colaboradores', faturamento_atual: 'Faturamento',
                                    }
                                    return `${labels[k] || k}: ${v}`
                                  })
                                return (
                                  <div key={i} className="px-2 py-1.5 text-xs">
                                    <span className="font-medium">{r.name}</span>
                                    {fields.length > 0 && (
                                      <span className="text-muted-foreground"> — {fields.join(' · ')}</span>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        )}
                      </div>
                    )}
                    {!aiExtracting && !aiResult && !aiError && (
                      <p className="text-sm text-muted-foreground">Os campos diretos da planilha já foram sincronizados automaticamente.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step !== 'upload' && step !== 'importing' && (
          <div className="flex justify-between pt-3 border-t border-border shrink-0">
            {step === 'mapping' && (
              <>
                <Button variant="outline" onClick={reset}>Voltar</Button>
                <Button onClick={() => setStep('preview')} disabled={missingRequired.length > 0}>
                  Visualizar prévia
                </Button>
              </>
            )}
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={() => setStep('mapping')}>Voltar</Button>
                <Button onClick={handleImport}>{tabLabels[activeTab].button}</Button>
              </>
            )}
            {step === 'done' && (
              <>
                <div />
                <Button onClick={() => handleClose(false)}>Fechar</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
