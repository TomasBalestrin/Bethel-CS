'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { bulkCreateMentees } from '@/lib/actions/mentee-actions'

// ─── Field Definitions ──────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  required: boolean
  type: 'text' | 'date' | 'number' | 'status' | 'state'
  aliases: string[]
}

const SYSTEM_FIELDS: FieldDef[] = [
  // Required
  { key: 'full_name', label: 'Nome completo', required: true, type: 'text', aliases: ['nome', 'name', 'nome completo', 'full name'] },
  { key: 'phone', label: 'Telefone', required: true, type: 'text', aliases: ['telefone', 'fone', 'celular', 'phone', 'whatsapp', 'tel'] },
  { key: 'product_name', label: 'Produto Contratado', required: true, type: 'text', aliases: ['produto', 'product', 'produto contratado', 'plano', 'mentoria', 'tipo de produto'] },
  { key: 'start_date', label: 'Data de Entrada', required: true, type: 'date', aliases: ['entrada', 'inicio', 'início', 'start', 'data entrada', 'data início', 'start date', 'data de entrada', 'data inicio'] },
  // Optional
  { key: 'status', label: 'Situação', required: false, type: 'status', aliases: ['situação', 'situacao', 'status', 'estado do cliente', 'ativo'] },
  { key: 'closer_name', label: 'Closer (Vendedor)', required: false, type: 'text', aliases: ['closer', 'vendedor', 'seller', 'vendedor que vendeu', 'consultor', 'closer responsável'] },
  { key: 'cpf', label: 'CPF', required: false, type: 'text', aliases: ['cpf', 'documento', 'doc'] },
  { key: 'email', label: 'Email', required: false, type: 'text', aliases: ['email', 'e-mail', 'mail', 'e mail'] },
  { key: 'instagram', label: '@Instagram', required: false, type: 'text', aliases: ['instagram', '@instagram', 'insta', 'ig', '@'] },
  { key: 'city', label: 'Cidade', required: false, type: 'text', aliases: ['cidade', 'city', 'municipio', 'município'] },
  { key: 'state', label: 'Estado (UF)', required: false, type: 'state', aliases: ['estado', 'uf', 'state', 'uf estado'] },
  { key: 'birth_date', label: 'Aniversário', required: false, type: 'date', aliases: ['aniversario', 'aniversário', 'nascimento', 'data nascimento', 'dt nascimento', 'birthday', 'birth date'] },
  { key: 'end_date', label: 'Data de Encerramento', required: false, type: 'date', aliases: ['encerramento', 'fim', 'end', 'data fim', 'validade', 'data encerramento', 'end date', 'data de encerramento'] },
  { key: 'faturamento_antes_mentoria', label: 'Faturamento Inicial', required: false, type: 'number', aliases: ['faturamento inicial', 'fat inicial', 'faturamento antes', 'receita inicial', 'fat antes mentoria', 'faturamento antes da mentoria'] },
  { key: 'faturamento_atual', label: 'Faturamento Atual', required: false, type: 'number', aliases: ['faturamento atual', 'fat atual', 'faturamento hoje', 'receita atual', 'fat mês 3', 'fat mes 3'] },
  { key: 'faturamento_mes_anterior', label: 'Faturamento Mês Anterior', required: false, type: 'number', aliases: ['faturamento mês anterior', 'fat mês anterior', 'fat mes anterior', 'faturamento mes anterior', 'fat mês 2', 'fat mes 2'] },
  { key: 'contract_validity', label: 'Período do Contrato', required: false, type: 'text', aliases: ['período', 'periodo', 'contract validity', 'duração', 'duracao', 'vigencia', 'vigência'] },
  { key: 'notes', label: 'Observações', required: false, type: 'text', aliases: ['observações', 'observacoes', 'obs', 'notes', 'anotações', 'notas'] },
  { key: 'niche', label: 'Nicho', required: false, type: 'text', aliases: ['nicho', 'niche', 'segmento', 'área de atuação'] },
]

const SKIP_VALUE = '__skip__'

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const header of headers) {
    const norm = normalizeHeader(header)
    for (const field of SYSTEM_FIELDS) {
      if (field.aliases.some((alias) => normalizeHeader(alias) === norm || norm.includes(normalizeHeader(alias)))) {
        if (!mapping[header]) {
          mapping[header] = field.key
        }
      }
    }
    if (!mapping[header]) {
      mapping[header] = SKIP_VALUE
    }
  }
  return mapping
}

// ─── Component ──────────────────────────────────────────────────────────────

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

interface ImportResult {
  total: number
  created: number
  errors: { row: number; name: string; error: string }[]
}

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  specialists: { id: string; full_name: string }[]
  isAdmin: boolean
}

export function BulkImportDialog({ open, onOpenChange, specialists, isAdmin }: BulkImportDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string | number>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [defaultSpecialistId, setDefaultSpecialistId] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function reset() {
    setStep('upload')
    setFileName('')
    setHeaders([])
    setRows([])
    setMapping({})
    setDefaultSpecialistId('')
    setResult(null)
  }

  function handleClose(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  function processWorkbook(wb: XLSX.WorkBook) {
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })
    if (data.length === 0) return

    const hdrs = Object.keys(data[0])
    setHeaders(hdrs)
    setRows(data)
    setMapping(autoDetectMapping(hdrs))
    setStep('mapping')
  }

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array', cellDates: false })
      processWorkbook(wb)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build preview rows (first 5) using the current mapping
  function getMappedRow(raw: Record<string, string | number>): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (fieldKey === SKIP_VALUE) continue
      out[fieldKey] = raw[header]
    }
    return out
  }

  const previewRows = rows.slice(0, 5).map(getMappedRow)
  const requiredFields = SYSTEM_FIELDS.filter((f) => f.required)
  const mappedFieldKeys = Object.values(mapping).filter((v) => v !== SKIP_VALUE)
  const missingRequired = requiredFields.filter((f) => !mappedFieldKeys.includes(f.key))

  async function handleImport() {
    setStep('importing')
    const mapped = rows.map(getMappedRow)
    const res = await bulkCreateMentees({
      rows: mapped,
      defaultSpecialistId: defaultSpecialistId || undefined,
    })
    setResult(res)
    setStep('done')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden w-[95vw] sm:w-full rounded-2xl sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Importar Mentorados em Massa</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou Excel (.xlsx) com os dados dos mentorados.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-1">
          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div className="space-y-6 p-1">
              <div
                className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 py-12 ${dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-muted/30'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium text-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">CSV ou Excel (.xlsx, .xls)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Campos reconhecidos automaticamente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SYSTEM_FIELDS.filter((f) => f.required).map((f) => (
                    <Badge key={f.key} variant="default" className="text-xs">{f.label} *</Badge>
                  ))}
                  {SYSTEM_FIELDS.filter((f) => !f.required).map((f) => (
                    <Badge key={f.key} variant="secondary" className="text-xs">{f.label}</Badge>
                  ))}
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
                <span>— {rows.length} linhas encontradas</span>
              </div>

              {/* Specialist default (admin) */}
              {isAdmin && specialists.length > 0 && (
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-sm font-medium">Especialista padrão</p>
                  <p className="text-xs text-muted-foreground">Usado quando a planilha não tem coluna de especialista</p>
                  <Select value={defaultSpecialistId} onValueChange={setDefaultSpecialistId}>
                    <SelectTrigger className="w-full">
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

              {/* Mapping table */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Mapeamento de colunas</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                    <span>Coluna na planilha</span>
                    <span />
                    <span>Campo no sistema</span>
                  </div>
                  <div className="divide-y divide-border">
                    {headers.map((header) => (
                      <div key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2">
                        <span className="text-sm font-medium truncate" title={header}>{header}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={mapping[header] ?? SKIP_VALUE}
                          onValueChange={(v) => setMapping((prev) => ({ ...prev, [header]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>— Ignorar —</SelectItem>
                            {SYSTEM_FIELDS.map((f) => (
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

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={reset}>Voltar</Button>
                <Button
                  onClick={() => setStep('preview')}
                  disabled={missingRequired.length > 0}
                >
                  Visualizar prévia
                </Button>
              </div>
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
                          const field = SYSTEM_FIELDS.find((f) => f.key === key)
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
                <p className="font-medium">{rows.length} mentorados serão importados</p>
                <p className="text-muted-foreground text-xs mt-0.5">Registros com telefone duplicado serão ignorados.</p>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('mapping')}>Voltar</Button>
                <Button onClick={handleImport}>
                  Importar {rows.length} mentorados
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: importing ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Importando mentorados...</p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && result && (
            <div className="space-y-4 p-1">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="font-medium text-lg">{result.created} de {result.total} importados com sucesso</p>
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

              <div className="flex justify-end pt-2">
                <Button onClick={() => handleClose(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
