/**
 * Next Apps (WhatsApp) server-side authentication and API client.
 * Tokens persisted in system_tokens table for serverless compatibility.
 * NEVER import in client components.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const BASE_URL = process.env.NEXTAPPS_BASE_URL || 'https://service.nexttrack.com.br'
const EMAIL = process.env.NEXTAPPS_EMAIL || ''
const PASSWORD = process.env.NEXTAPPS_PASSWORD || ''

// In-memory cache (survives within a single request/warm lambda)
let cachedAccessToken = ''
let cachedExpiresAt = 0

async function saveToken(key: string, value: string, expiresAt: Date) {
  const supabase = createAdminClient()
  await supabase
    .from('system_tokens' as never)
    .upsert(
      { key, value, expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() } as never,
      { onConflict: 'key' } as never
    )
}

async function loadToken(key: string): Promise<{ value: string; expires_at: string } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('system_tokens' as never)
    .select('value, expires_at' as never)
    .eq('key' as never, key as never)
    .single()

  return data as { value: string; expires_at: string } | null
}

async function doLogin(): Promise<string> {
  console.log('[NextApps] doLogin → URL:', `${BASE_URL}/api/auth/login`, '| email:', EMAIL, '| pass:', PASSWORD.slice(0, 4) + '****')
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })

  console.log('[NextApps] doLogin response status:', res.status)
  if (!res.ok) {
    const text = await res.text()
    console.error('[NextApps] doLogin FAILED:', res.status, text)
    throw new Error(`Next Apps login failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const access = data.accessToken || data.token || ''
  const refresh = data.refreshToken || ''

  // Persist tokens
  const accessExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000) // 23h
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7d

  await Promise.all([
    saveToken('nextapps_access', access, accessExpiry),
    refresh ? saveToken('nextapps_refresh', refresh, refreshExpiry) : Promise.resolve(),
  ])

  // Update in-memory cache
  cachedAccessToken = access
  cachedExpiresAt = accessExpiry.getTime()

  return access
}

async function doRefresh(refreshTokenValue: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    })

    if (!res.ok) {
      return await doLogin()
    }

    const data = await res.json()
    const access = data.accessToken || data.token || ''
    const newRefresh = data.refreshToken || refreshTokenValue

    const accessExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000)
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await Promise.all([
      saveToken('nextapps_access', access, accessExpiry),
      saveToken('nextapps_refresh', newRefresh, refreshExpiry),
    ])

    cachedAccessToken = access
    cachedExpiresAt = accessExpiry.getTime()

    return access
  } catch {
    return await doLogin()
  }
}

async function getToken(): Promise<string> {
  // 1. Check in-memory cache (same lambda invocation)
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60000) {
    console.log('[NextApps] getToken → using in-memory cache')
    return cachedAccessToken
  }

  // 2. Check database for valid access token
  const accessRow = await loadToken('nextapps_access')
  if (accessRow && accessRow.expires_at && new Date(accessRow.expires_at).getTime() > Date.now() + 60000) {
    console.log('[NextApps] getToken → using DB access token (expires:', accessRow.expires_at, ')')
    cachedAccessToken = accessRow.value
    cachedExpiresAt = new Date(accessRow.expires_at).getTime()
    return accessRow.value
  }

  // 3. Try refresh token from database
  const refreshRow = await loadToken('nextapps_refresh')
  if (refreshRow && refreshRow.expires_at && new Date(refreshRow.expires_at).getTime() > Date.now()) {
    console.log('[NextApps] getToken → refreshing token')
    return await doRefresh(refreshRow.value)
  }

  // 4. No valid tokens — full login
  console.log('[NextApps] getToken → no valid tokens, doing full login')
  return await doLogin()
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  }

  let res = await fetch(url, { ...options, headers })
  console.log('[NextApps] authFetch →', url, '| status:', res.status)

  // Retry once on 401 (token expired between check and use)
  if (res.status === 401) {
    console.log('[NextApps] authFetch → 401 received, retrying with fresh token')
    cachedAccessToken = ''
    cachedExpiresAt = 0
    // Clear stale access token from DB
    const supabase = createAdminClient()
    await supabase.from('system_tokens' as never).delete().eq('key' as never, 'nextapps_access' as never)

    const newToken = await getToken()
    res = await fetch(url, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
    })
  }

  return res
}

export async function sendMessage(
  instanceId: string,
  phone: string,
  message: string,
  type?: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      phone,
      message,
      type: type || 'text',
    }
    if (imageUrl) body.imageUrl = imageUrl

    const url = `${BASE_URL}/api/chats/instances/${instanceId}/send`
    console.log('[NextApps] sendMessage URL:', url)
    console.log('[NextApps] sendMessage body:', JSON.stringify(body))

    const res = await authFetch(url, { method: 'POST', body: JSON.stringify(body) })

    console.log('[NextApps] sendMessage response status:', res.status)

    if (!res.ok) {
      const text = await res.text()
      console.error('[NextApps] sendMessage error:', res.status, text)
      return { success: false, error: `Send failed (${res.status}): ${text}` }
    }

    return { success: true }
  } catch (err) {
    console.error('[NextApps] sendMessage exception:', err)
    return { success: false, error: String(err) }
  }
}

export async function getQRCode(
  instanceId: string
): Promise<{ ascii?: string; status?: boolean; error?: string }> {
  try {
    const res = await authFetch(
      `${BASE_URL}/api/instances/${instanceId}/qrcode/image`,
      { method: 'GET' }
    )

    if (!res.ok) {
      const text = await res.text()
      return { error: `QR failed (${res.status}): ${text}` }
    }

    const data = await res.json()
    return { ascii: data.ascii, status: data.status }
  } catch (err) {
    return { error: String(err) }
  }
}
