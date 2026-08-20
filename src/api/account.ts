import type { components, operations } from './generated/schema'
import { requestJson } from './http'

export type LoginRequest = components['schemas']['LoginRequest']
export type SessionResponse = components['schemas']['SessionResponse']
export type UserResponse = components['schemas']['UserResponse']
export type UserPageResponse = components['schemas']['UserPageResponse']
export type UserQuery = NonNullable<operations['listUsers']['parameters']['query']>

const apiBase = (import.meta.env.VITE_ACCOUNT_API_BASE || '/api').replace(/\/$/, '')

export function getSession(): Promise<SessionResponse> {
  return requestJson(`${apiBase}/session`)
}

export function login(request: LoginRequest, csrfToken: string): Promise<SessionResponse> {
  return requestJson(`${apiBase}/session`, {
    method: 'POST',
    body: request,
    csrfToken,
  })
}

export function logout(csrfToken: string): Promise<void> {
  return requestJson(`${apiBase}/session`, {
    method: 'DELETE',
    csrfToken,
  })
}

export function listUsers(query: UserQuery): Promise<UserPageResponse> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  return requestJson(`${apiBase}/users?${search.toString()}`)
}

export function getUser(userId: string): Promise<UserResponse> {
  return requestJson(`${apiBase}/users/${encodeURIComponent(userId)}`)
}
