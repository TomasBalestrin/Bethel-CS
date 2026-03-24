'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

async function verifyAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { supabase, user: null, error: 'Sem permissão' }
  return { supabase, user, error: null }
}

// ─── Users ───

export async function createUser(data: {
  email: string
  password: string
  full_name: string
  role: UserRole
}) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  // Create auth user via admin API (uses service role if available)
  // Since we may not have service role, we create via signup + profile update
  const { data: newUser, error: signupError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (signupError) {
    // Fallback: if admin API not available, try regular signup
    const { data: fallbackUser, error: fallbackError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    if (fallbackError) return { error: fallbackError.message }

    if (fallbackUser.user) {
      await supabase.from('profiles').upsert({
        id: fallbackUser.user.id,
        full_name: data.full_name,
        role: data.role,
      })
    }
  } else if (newUser.user) {
    await supabase.from('profiles').upsert({
      id: newUser.user.id,
      full_name: data.full_name,
      role: data.role,
    })
  }

  revalidatePath('/admin')
  return { error: null }
}

export async function updateUser(userId: string, data: {
  full_name: string
  role: UserRole
}) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: data.full_name, role: data.role })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export async function deleteUser(userId: string) {
  const { supabase, user, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }
  if (user?.id === userId) return { error: 'Não é possível excluir a si mesmo' }

  // Delete profile (auth user remains but has no profile)
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

// ─── Products ───

export async function createProduct(name: string) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase.from('products').insert({ name })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export async function updateProduct(productId: string, name: string) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('products')
    .update({ name })
    .eq('id', productId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}

export async function deleteProduct(productId: string) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}
