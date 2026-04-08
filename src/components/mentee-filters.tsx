'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useState } from 'react'

const EMPLOYEE_RANGES = ['0 - 1', '2 - 5', '6 - 10', '11 - 20', '21 - 50', '50 - 100', 'Acima de 100']

const MONTH_NAMES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

function parseCurrency(raw: string): number {
  return parseInt(raw.replace(/\D/g, '') || '0', 10)
}

function fmtCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface MenteeFilterValues {
  fatInicialMin: string
  fatInicialMax: string
  fatAtualMin: string
  fatAtualMax: string
  funilOrigem: string
  closer: string
  mesAniversario: string
  numColaboradores: string
  estado: string
  nicho: string
  dataInicio: string
  dataTermino: string
}

export const EMPTY_FILTERS: MenteeFilterValues = {
  fatInicialMin: '',
  fatInicialMax: '',
  fatAtualMin: '',
  fatAtualMax: '',
  funilOrigem: '',
  closer: '',
  mesAniversario: '',
  numColaboradores: '',
  estado: '',
  nicho: '',
  dataInicio: '',
  dataTermino: '',
}

interface MenteeFiltersProps {
  filters: MenteeFilterValues
  onFilterChange: (key: keyof MenteeFilterValues, value: string) => void
  onClearAll: () => void
  options: {
    funisOrigem: string[]
    closers: string[]
    nichos: string[]
  }
}

export function MenteeFilters({ filters, onFilterChange, onClearAll, options }: MenteeFiltersProps) {
  const [expanded, setExpanded] = useState(false)

  const activeCount = Object.values(filters).filter((v) => v && v !== '__all__').length

  return (
    <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filtros avançados</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5">
              {activeCount}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
            {/* Faturamento inicial (antes da mentoria) */}
            <div className="space-y-1">
              <Label className="text-xs">Faturamento inicial</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Mín"
                  inputMode="numeric"
                  className="text-xs h-9"
                  value={filters.fatInicialMin ? `R$ ${fmtCurrency(Number(filters.fatInicialMin))}` : ''}
                  onChange={(e) => onFilterChange('fatInicialMin', String(parseCurrency(e.target.value)))}
                />
                <Input
                  placeholder="Máx"
                  inputMode="numeric"
                  className="text-xs h-9"
                  value={filters.fatInicialMax ? `R$ ${fmtCurrency(Number(filters.fatInicialMax))}` : ''}
                  onChange={(e) => onFilterChange('fatInicialMax', String(parseCurrency(e.target.value)))}
                />
              </div>
            </div>

            {/* Faturamento atual */}
            <div className="space-y-1">
              <Label className="text-xs">Faturamento atual</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Mín"
                  inputMode="numeric"
                  className="text-xs h-9"
                  value={filters.fatAtualMin ? `R$ ${fmtCurrency(Number(filters.fatAtualMin))}` : ''}
                  onChange={(e) => onFilterChange('fatAtualMin', String(parseCurrency(e.target.value)))}
                />
                <Input
                  placeholder="Máx"
                  inputMode="numeric"
                  className="text-xs h-9"
                  value={filters.fatAtualMax ? `R$ ${fmtCurrency(Number(filters.fatAtualMax))}` : ''}
                  onChange={(e) => onFilterChange('fatAtualMax', String(parseCurrency(e.target.value)))}
                />
              </div>
            </div>

            {/* Funil de origem */}
            <div className="space-y-1">
              <Label className="text-xs">Funil de origem</Label>
              <Select value={filters.funilOrigem || '__all__'} onValueChange={(v) => onFilterChange('funilOrigem', v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {options.funisOrigem.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Closer que vendeu */}
            <div className="space-y-1">
              <Label className="text-xs">Closer que vendeu</Label>
              <Select value={filters.closer || '__all__'} onValueChange={(v) => onFilterChange('closer', v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {options.closers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mês de aniversário */}
            <div className="space-y-1">
              <Label className="text-xs">Mês de aniversário</Label>
              <Select value={filters.mesAniversario || '__all__'} onValueChange={(v) => onFilterChange('mesAniversario', v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {MONTH_NAMES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Número de colaboradores */}
            <div className="space-y-1">
              <Label className="text-xs">Nº de colaboradores</Label>
              <Select value={filters.numColaboradores || '__all__'} onValueChange={(v) => onFilterChange('numColaboradores', v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {EMPLOYEE_RANGES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={filters.estado || '__all__'} onValueChange={(v) => onFilterChange('estado', v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {BRAZILIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nicho */}
            <div className="space-y-1">
              <Label className="text-xs">Nicho</Label>
              <Select value={filters.nicho || '__all__'} onValueChange={(v) => onFilterChange('nicho', v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {options.nichos.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data de início */}
            <div className="space-y-1">
              <Label className="text-xs">Data de início</Label>
              <Input
                type="date"
                className="text-xs h-9"
                value={filters.dataInicio}
                onChange={(e) => onFilterChange('dataInicio', e.target.value)}
              />
            </div>

            {/* Data de término */}
            <div className="space-y-1">
              <Label className="text-xs">Data de término</Label>
              <Input
                type="date"
                className="text-xs h-9"
                value={filters.dataTermino}
                onChange={(e) => onFilterChange('dataTermino', e.target.value)}
              />
            </div>
          </div>

          {activeCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              <Button size="sm" variant="ghost" onClick={onClearAll} className="gap-1.5 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
