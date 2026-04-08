'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Task Columns ───

export async function getTaskColumns() {
  const supabase = createClient()
  const { data } = await supabase.from('task_columns').select('*').order('position')
  return data ?? []
}

export async function createTaskColumn(name: string, position: number, color?: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const { error } = await supabase.from('task_columns').insert({ name, position, color: color || '#3B9FFF' })
  if (error) return { error: error.message }
  revalidatePath('/tarefas')
  return { error: null }
}

export async function updateTaskColumn(id: string, data: { name?: string; position?: number; color?: string }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const { error } = await supabase.from('task_columns').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/tarefas')
  return { error: null }
}

export async function deleteTaskColumn(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const { error } = await supabase.from('task_columns').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/tarefas')
  return { error: null }
}

// ─── Tasks ───

export async function createTask(data: {
  title: string
  description?: string
  notes?: string
  due_date?: string
  mentee_id?: string
  column_id?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', task: null }

  const { data: task, error } = await supabase.from('tasks').insert({
    title: data.title,
    description: data.description || null,
    notes: data.notes || null,
    due_date: data.due_date || null,
    mentee_id: data.mentee_id || null,
    column_id: data.column_id || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message, task: null }
  revalidatePath('/tarefas')
  return { error: null, task }
}

export async function updateTask(id: string, data: {
  title?: string
  description?: string | null
  notes?: string | null
  due_date?: string | null
  column_id?: string | null
  completed_at?: string | null
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('tasks').update({
    ...data,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/tarefas')
  return { error: null }
}

export async function deleteTask(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/tarefas')
  return { error: null }
}

export async function moveTask(taskId: string, columnId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Check if this is the "Concluídas" column
  const { data: col } = await supabase.from('task_columns').select('name').eq('id', columnId).single()
  const isCompleted = col?.name?.toLowerCase().includes('conclu')

  const { error } = await supabase.from('tasks').update({
    column_id: columnId,
    completed_at: isCompleted ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', taskId)

  if (error) return { error: error.message }
  revalidatePath('/tarefas')
  return { error: null }
}
