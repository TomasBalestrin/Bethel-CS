'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const { error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  const adminClient = createAdminClient()

  // Create auth user via admin API (service role key)
  const { data: newUser, error: signupError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (signupError) {
    return { error: `Erro ao criar usuário: ${signupError.message}` }
  }

  if (!newUser?.user) {
    return { error: 'Erro ao criar usuário: resposta vazia' }
  }

  // Create profile
  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: newUser.user.id,
    full_name: data.full_name,
    role: data.role,
  })

  if (profileError) {
    return { error: `Usuário criado mas erro no perfil: ${profileError.message}` }
  }

  revalidatePath('/admin')
  return { error: null }
}

export async function updateUser(userId: string, data: {
  full_name: string
  role: UserRole
  email?: string
  password?: string
}) {
  const { supabase, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }

  // Update profile (name + role)
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: data.full_name, role: data.role })
    .eq('id', userId)

  if (error) return { error: error.message }

  // Update auth (email/password) via admin API
  if (data.email || data.password) {
    try {
      const adminClient = createAdminClient()
      const authUpdate: { email?: string; password?: string } = {}
      if (data.email) authUpdate.email = data.email
      if (data.password) authUpdate.password = data.password

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, authUpdate)
      if (authUpdateError) return { error: `Perfil salvo, mas erro ao atualizar credenciais: ${authUpdateError.message}` }
    } catch {
      return { error: 'Perfil salvo, mas erro ao acessar API admin do Supabase' }
    }
  }

  revalidatePath('/admin')
  return { error: null }
}

export async function deleteUser(userId: string) {
  const { supabase, user, error: authError } = await verifyAdmin()
  if (authError) return { error: authError }
  if (user?.id === userId) return { error: 'Não é possível excluir a si mesmo' }

  // Delete profile first
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) return { error: error.message }

  // Also delete the auth user so they can't log in anymore
  try {
    const adminClient = createAdminClient()
    await adminClient.auth.admin.deleteUser(userId)
  } catch {
    // Profile already deleted, auth cleanup is best-effort
  }

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
