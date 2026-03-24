import { createClient } from '@/lib/supabase/server'
import { TestimonialsList } from '@/components/testimonials-list'

export default async function DepoimentosPage() {
  const supabase = createClient()

  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('*, mentees(full_name)')
    .order('testimonial_date', { ascending: false })

  // Count testimonials per mentee
  const menteeTestimonialCounts = new Map<string, number>()
  testimonials?.forEach((t) => {
    menteeTestimonialCounts.set(
      t.mentee_id,
      (menteeTestimonialCounts.get(t.mentee_id) ?? 0) + 1
    )
  })

  const enrichedTestimonials = (testimonials ?? []).map((t) => ({
    ...t,
    mentee_name: (t.mentees as unknown as { full_name: string })?.full_name ?? 'Desconhecido',
    mentee_testimonial_count: menteeTestimonialCounts.get(t.mentee_id) ?? 0,
  }))

  return <TestimonialsList testimonials={enrichedTestimonials} />
}
