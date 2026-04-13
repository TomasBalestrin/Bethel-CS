/**
 * NextTrack WhatsApp API client.
 * Handles JWT auth, token persistence, and message sending.
 * Base URL: https://service.nextrack.com.br
 * NEVER import in client components.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const BASE_URL = process.env.NEXTAPPS_BASE_URL || 'https://service.nextrack.com.br'
const EMAIL = process.env.NEXTAPPS_EMAIL || ''
const PASSWORD = process.env.NEXTAPPS_PASSWORD || ''

// NextTrack UUID for the instance (used in API endpoints)
const NEXTRACK_INSTANCE_UUID = process.env.NEXTRACK_INSTANCE_UUID || ''

// S3 base for constructing full media URLs
const S3_BASE = 'https://whatsapp-avatar.s3.sa-east-1.amazonaws.com'

// In-memory cache (survives within a single request/warm lambda)
let cachedAccessToken = ''
let cachedExpiresAt = 0

// ─── Token Persistence ───

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

// ─── Auth ───

async function doLogin(): Promise<string> {
  console.log('[NextTrack] doLogin → email:', EMAIL)
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[NextTrack] doLogin FAILED:', res.status, text)
    throw new Error(`NextTrack login failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const access = data.accessToken || data.token || ''
  const refresh = data.refreshToken || ''

  const accessExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000) // 6h
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7d

  await Promise.all([
    saveToken('nextapps_access', access, accessExpiry),
    refresh ? saveToken('nextapps_refresh', refresh, refreshExpiry) : Promise.resolve(),
  ])

  cachedAccessToken = access
  cachedExpiresAt = accessExpiry.getTime()

  return access
}

async function doRefresh(refreshTokenValue: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
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

    const accessExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000) // 6h
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7d

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
  // 1. Check in-memory cache
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60000) {
    return cachedAccessToken
  }

  // 2. Check database for valid access token
  const accessRow = await loadToken('nextapps_access')
  if (accessRow && accessRow.expires_at && new Date(accessRow.expires_at).getTime() > Date.now() + 60000) {
    cachedAccessToken = accessRow.value
    cachedExpiresAt = new Date(accessRow.expires_at).getTime()
    return accessRow.value
  }

  // 3. Try refresh token
  const refreshRow = await loadToken('nextapps_refresh')
  if (refreshRow && refreshRow.expires_at && new Date(refreshRow.expires_at).getTime() > Date.now()) {
    return await doRefresh(refreshRow.value)
  }

  // 4. Full login
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

  // Retry once on 401
  if (res.status === 401) {
    cachedAccessToken = ''
    cachedExpiresAt = 0
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

// ─── Public API ───

/**
 * Resolve the NextTrack UUID for the instance.
 * Uses env var NEXTRACK_INSTANCE_UUID or falls back to the Whatsmeow instance_id.
 */
export function getInstanceUUID(whatsmeowId?: string): string {
  if (NEXTRACK_INSTANCE_UUID) return NEXTRACK_INSTANCE_UUID
  // Fallback: use Whatsmeow ID (may not work for all endpoints)
  return whatsmeowId || ''
}

/**
 * Build full media URL from webhook path.
 * Handles both relative paths and already-complete URLs.
 */
export function getMediaUrl(urlField: string | null | undefined): string | null {
  if (!urlField) return null
  if (urlField.startsWith('http://') || urlField.startsWith('https://')) return urlField
  return `${S3_BASE}/${urlField}`
}

/**
 * Send a text-only message (simpler endpoint).
 */
export async function sendTextMessage(
  phone: string,
  message: string,
  overrideInstanceUUID?: string,
  quotedMsg?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const instanceUUID = overrideInstanceUUID || getInstanceUUID()
    if (!instanceUUID) return { success: false, error: 'Instância WhatsApp não configurada' }

    const url = `${BASE_URL}/api/chats/instances/${instanceUUID}/send-text`
    const body: Record<string, unknown> = { phone, message }
    if (quotedMsg) body.quotedMsg = quotedMsg
    const res = await authFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Send failed (${res.status}): ${text}` }
    }

    // Try to extract messageId from response
    let messageId: string | undefined
    try {
      const resData = await res.json()
      messageId = resData.messageId || resData.id || resData.key?.id
        || resData.message?.key?.id || resData.response?.key?.id
        || resData.result?.key?.id || resData.data?.key?.id || undefined
    } catch { /* response might not be JSON */ }

    return { success: true, messageId }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Send a media message (image, audio, video, document).
 */
export async function sendMediaMessage(
  phone: string,
  type: 'image' | 'audio' | 'video' | 'document',
  mediaUrl: string,
  caption?: string,
  fileName?: string,
  mimeType?: string,
  overrideInstanceUUID?: string,
  quotedMsg?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const instanceUUID = overrideInstanceUUID || getInstanceUUID()
    if (!instanceUUID) return { success: false, error: 'Instância WhatsApp não configurada' }

    // Per NextTrack docs: all media types use /send endpoint with imageUrl field
    const url = `${BASE_URL}/api/chats/instances/${instanceUUID}/send`

    // Download the file for base64 (with timeout and size limit to avoid hanging the request)
    // MAX 2MB to prevent huge JSON payloads that may exceed Vercel limits
    const MAX_SIZE = 2 * 1024 * 1024 // 2MB
    const DOWNLOAD_TIMEOUT = 5000 // 5 seconds
    let base64Data: string | null = null
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT)
      const fileRes = await fetch(mediaUrl, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (fileRes.ok) {
        const contentLength = Number(fileRes.headers.get('content-length') || '0')
        if (contentLength > 0 && contentLength <= MAX_SIZE) {
          const buffer = await fileRes.arrayBuffer()
          const b64 = Buffer.from(buffer).toString('base64')
          const mime = mimeType || fileRes.headers.get('content-type') || 'application/octet-stream'
          base64Data = `data:${mime};base64,${b64}`
          console.log('[NextTrack] downloaded media, size:', buffer.byteLength, 'mime:', mime)
        } else {
          console.log('[NextTrack] skipping base64 (size:', contentLength, 'bytes > 2MB or unknown), using URL only')
        }
      }
    } catch (err) {
      console.error('[NextTrack] download failed, continuing with URL only:', err)
    }

    const body: Record<string, unknown> = {
      phone,
      type,
      imageUrl: mediaUrl,
    }
    // Send base64 ONLY if available (single field to avoid triplicating payload)
    if (base64Data) {
      body.base64 = base64Data
    }

    if (caption) body.message = caption
    if (caption) body.caption = caption
    if (fileName) body.fileName = fileName
    if (mimeType) body.mimeType = mimeType
    if (quotedMsg) body.quotedMsg = quotedMsg

    console.log('[NextTrack] sendMediaMessage →', { phone, type, hasBase64: !!base64Data, mediaUrl: mediaUrl.slice(0, 120), instanceUUID })

    const res = await authFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[NextTrack] sendMediaMessage FAILED:', res.status, text)
      return { success: false, error: `Send failed (${res.status}): ${text}` }
    }

    let messageId: string | undefined
    try {
      const resData = await res.json()
      console.log('[NextTrack] sendMediaMessage OK:', JSON.stringify(resData).slice(0, 300))
      messageId = resData.messageId || resData.id || resData.key?.id
        || resData.message?.key?.id || resData.response?.key?.id
        || resData.result?.key?.id || resData.data?.key?.id || undefined
    } catch {
      console.log('[NextTrack] sendMediaMessage OK (non-JSON response)')
    }

    return { success: true, messageId }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Legacy: send message (text or media). Used by existing send route.
 */
export async function sendMessage(
  _instanceId: string, // ignored — we use NEXTRACK_INSTANCE_UUID
  phone: string,
  message: string,
  type?: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  if (!type || type === 'text') {
    return sendTextMessage(phone, message)
  }
  return sendMediaMessage(
    phone,
    type as 'image' | 'audio' | 'video' | 'document',
    imageUrl || '',
    message
  )
}

/**
 * Revoke/delete a message on WhatsApp ("apagar para todos").
 * Tries multiple endpoint patterns since NextTrack may expose this differently.
 */
export async function revokeMessage(
  phone: string,
  messageId: string,
  overrideInstanceUUID?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const instanceUUID = overrideInstanceUUID || getInstanceUUID()
    if (!instanceUUID) return { success: false, error: 'Instância WhatsApp não configurada' }

    // Try common endpoint patterns for message revocation
    const endpoints = [
      { url: `${BASE_URL}/api/chats/instances/${instanceUUID}/revoke-message`, method: 'POST', body: { phone, messageId } },
      { url: `${BASE_URL}/api/chats/instances/${instanceUUID}/delete-message`, method: 'POST', body: { phone, messageId } },
      { url: `${BASE_URL}/api/chats/instances/${instanceUUID}/messages/${messageId}`, method: 'DELETE', body: { phone } },
    ]

    for (const ep of endpoints) {
      const res = await authFetch(ep.url, {
        method: ep.method,
        body: JSON.stringify(ep.body),
      })

      if (res.status === 404) continue // endpoint doesn't exist, try next

      if (res.ok) {
        console.log('[NextTrack] revokeMessage OK:', { phone, messageId, endpoint: ep.url })
        return { success: true }
      }

      const text = await res.text()
      console.error('[NextTrack] revokeMessage FAILED:', res.status, text)
      return { success: false, error: `Revoke failed (${res.status}): ${text}` }
    }

    // No endpoint found
    console.log('[NextTrack] revokeMessage: no revoke endpoint available')
    return { success: false, error: 'API de revogação não disponível' }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Get QR Code for instance connection.
 */
export async function getQRCode(
  instanceId: string
): Promise<{ ascii?: string; status?: boolean; error?: string }> {
  try {
    const uuid = getInstanceUUID(instanceId)
    const res = await authFetch(
      `${BASE_URL}/api/instances/${uuid}/qrcode/image`,
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

/**
 * Get instance connection status.
 */
export async function getInstanceStatus(
  instanceId?: string
): Promise<{ status?: string; isOnline?: boolean; error?: string }> {
  try {
    const uuid = getInstanceUUID(instanceId)
    const res = await authFetch(`${BASE_URL}/api/instances/${uuid}/status`)

    if (!res.ok) {
      const text = await res.text()
      return { error: `Status check failed (${res.status}): ${text}` }
    }

    const data = await res.json()
    return { status: data.status, isOnline: data.isOnline }
  } catch (err) {
    return { error: String(err) }
  }
}
