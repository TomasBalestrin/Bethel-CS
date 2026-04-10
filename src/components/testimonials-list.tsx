'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatDateBR } from '@/lib/format'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageSquareQuote } from 'lucide-react'
import type { Database, TestimonialCategory } from '@/types/database'

type Testimonial = Database['public']['Tables']['testimonials']['Row']

interface EnrichedTestimonial extends Testimonial {
  mentee_name: string
  mentee_testimonial_count: number
}

const CATEGORY_LABELS: Record<TestimonialCategory, string> = {
  aumento_faturamento: 'Aumento de Faturamento',
  vida_pessoal: 'Vida Pessoal',
  vida_espiritual: 'Vida Espiritual',
  contratacao: 'Contratação',
  expansao_negocio: 'Expansão de Negócio',
  atendimento: 'Atendimento',
  intensivo: 'Intensivo',
  encontro_elite_premium: 'Encontro Elite Premium',
  mentoria_comercial: 'Mentoria Comercial',
  mentoria_marketing: 'Mentoria de Marketing',
  mentoria_gestao: 'Mentoria de Gestão',
  hotseat: 'Hotseat',
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as TestimonialCategory[]

interface TestimonialsListProps {
  testimonials: EnrichedTestimonial[]
}

export function TestimonialsList({ testimonials }: TestimonialsListProps) {
  const [nicheFilter, setNicheFilter] = useState('')
  const [revenueFilter, setRevenueFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filtered = testimonials.filter((t) => {
    if (nicheFilter && t.niche !== nicheFilter) return false
    if (revenueFilter && t.revenue_range !== revenueFilter) return false
    if (employeeFilter && t.employee_count !== employeeFilter) return false
    if (categoryFilter && !t.categories?.includes(categoryFilter as TestimonialCategory)) return false
    return true
  })

  // Get unique filter values
  const niches = Array.from(new Set(testimonials.map((t) => t.niche).filter(Boolean))) as string[]
  const revenueRanges = Array.from(new Set(testimonials.map((t) => t.revenue_range).filter(Boolean))) as string[]
  const employeeCounts = Array.from(new Set(testimonials.map((t) => t.employee_count).filter(Boolean))) as string[]

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Depoimentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered.length} depoimento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="label-xs">Nicho</Label>
          <Select value={nicheFilter} onValueChange={setNicheFilter}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {niches.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="label-xs">Faturamento</Label>
          <Select value={revenueFilter} onValueChange={setRevenueFilter}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {revenueRanges.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="label-xs">Colaboradores</Label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {employeeCounts.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="label-xs">Categoria</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {ALL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{t.mentee_name}</p>
                <p className="text-xs text-muted-foreground">{formatDateBR(t.testimonial_date)}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquareQuote className="h-3 w-3" />
                <span className="tabular">{t.mentee_testimonial_count}</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground">{t.description}</p>
            {t.niche && (
              <Badge variant="outline" className="mt-2 text-[10px]">{t.niche}</Badge>
            )}
            {t.categories && t.categories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.categories.map((cat) => (
                  <Badge key={cat} variant="info" className="text-[10px]">
                    {CATEGORY_LABELS[cat as TestimonialCategory] ?? cat}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
