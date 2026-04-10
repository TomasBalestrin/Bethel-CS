'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { MessageSquareQuote, Users, Award, BarChart3 } from 'lucide-react'
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
  const [viewingItem, setViewingItem] = useState<EnrichedTestimonial | null>(null)

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

  // Dashboard metrics
  const metrics = useMemo(() => {
    const total = testimonials.length
    const uniqueMentees = new Set(testimonials.map((t) => t.mentee_id)).size
    const withAttachment = testimonials.filter((t) => t.attachment_url).length
    const categoryCounts: Record<string, number> = {}
    testimonials.forEach((t) => {
      t.categories?.forEach((cat) => {
        categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
      })
    })
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]
    return { total, uniqueMentees, withAttachment, topCategory }
  }, [testimonials])

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Depoimentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered.length} depoimento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Dashboard metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-accent/10"><MessageSquareQuote className="h-4 w-4 text-accent" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total de depoimentos</p>
              <p className="font-heading text-lg font-bold">{metrics.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-success/10"><Users className="h-4 w-4 text-success" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Mentorados com depoimento</p>
              <p className="font-heading text-lg font-bold">{metrics.uniqueMentees}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-warning/10"><Award className="h-4 w-4 text-warning" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Com anexo (foto/vídeo)</p>
              <p className="font-heading text-lg font-bold">{metrics.withAttachment}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-info/10"><BarChart3 className="h-4 w-4 text-info" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Categoria mais frequente</p>
              <p className="font-heading text-sm font-bold">{metrics.topCategory ? CATEGORY_LABELS[metrics.topCategory[0] as TestimonialCategory] ?? metrics.topCategory[0] : '—'}</p>
            </div>
          </div>
        </div>
      </div>

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

      {/* Detail modal */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewingItem?.mentee_name}</DialogTitle>
            <DialogDescription>
              {viewingItem?.testimonial_date ? formatDateBR(viewingItem.testimonial_date) : ''}
              {viewingItem?.niche ? ` · ${viewingItem.niche}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-foreground whitespace-pre-line">{viewingItem?.description}</p>
            {viewingItem?.attachment_url && (
              <div>
                {viewingItem.attachment_type === 'video' ? (
                  <video src={viewingItem.attachment_url} controls className="rounded-lg w-full max-h-[400px] object-contain bg-black" />
                ) : (
                  <Image src={viewingItem.attachment_url} alt="Depoimento" width={600} height={400} className="rounded-lg w-full object-contain" unoptimized />
                )}
              </div>
            )}
            {viewingItem?.categories && viewingItem.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {viewingItem.categories.map((cat) => (
                  <Badge key={cat} variant="info" className="text-[10px]">
                    {CATEGORY_LABELS[cat as TestimonialCategory] ?? cat}
                  </Badge>
                ))}
              </div>
            )}
            {viewingItem?.revenue_range && <p className="text-xs text-muted-foreground">Faturamento: {viewingItem.revenue_range}</p>}
            {viewingItem?.employee_count && <p className="text-xs text-muted-foreground">Colaboradores: {viewingItem.employee_count}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            onClick={() => setViewingItem(t)}
            className="rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in cursor-pointer hover:bg-muted/30 transition-colors"
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
            <p className="mt-2 text-sm text-foreground line-clamp-3">{t.description}</p>
            {t.attachment_url && (
              <p className="mt-1 text-[10px] text-accent">{t.attachment_type === 'video' ? '🎥 Vídeo anexado' : '📷 Imagem anexada'}</p>
            )}
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
