import type { components, operations } from './generated/schema'
import { requestJson } from './http'

export type LoginRequest = components['schemas']['LoginRequest']
export type SessionResponse = components['schemas']['SessionResponse']
export type UserResponse = components['schemas']['UserResponse']
export type UserPageResponse = components['schemas']['UserPageResponse']
export type UserQuery = NonNullable<operations['listUsers']['parameters']['query']>
export type CreateUserRequest = components['schemas']['CreateUserRequest']
export type UpdateUserRequest = components['schemas']['UpdateUserRequest']
export type ChangeUserStatusRequest = components['schemas']['ChangeUserStatusRequest']
export type ApplicationResponse = components['schemas']['ApplicationResponse']
export type ApplicationSecretResponse = components['schemas']['ApplicationSecretResponse']
export type CreateApplicationRequest = components['schemas']['CreateApplicationRequest']
export type UpdateApplicationRequest = components['schemas']['UpdateApplicationRequest']
export type ChangeApplicationStatusRequest = components['schemas']['ChangeApplicationStatusRequest']
export type VersionedReasonRequest = components['schemas']['VersionedReasonRequest']
export type ApplicationAccessResponse = components['schemas']['ApplicationAccessResponse']
export type ChangeApplicationAccessRequest = components['schemas']['ChangeApplicationAccessRequest']

const apiBase = (import.meta.env.VITE_ACCOUNT_API_BASE || '/api').replace(/\/$/, '')

export type AuditEventResponse = components['schemas']['AuditEventResponse']
export type AuditEventPageResponse = components['schemas']['AuditEventPageResponse']
export type AuditEventQuery = NonNullable<operations['listAuditEvents']['parameters']['query']>

export function listAuditEvents(query: AuditEventQuery = {}): Promise<AuditEventPageResponse> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  return requestJson(`${apiBase}/audit-events${search.size ? `?${search}` : ''}`)
}

export function getAuditEvent(id: string): Promise<AuditEventResponse> {
  return requestJson(`${apiBase}/audit-events/${encodeURIComponent(id)}`)
}

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

export function createUser(
  request: CreateUserRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<UserResponse> {
  return requestJson(`${apiBase}/users`, {
    method: 'POST',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function updateUser(
  userId: string,
  request: UpdateUserRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<UserResponse> {
  return requestJson(`${apiBase}/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function changeUserStatus(
  userId: string,
  request: ChangeUserStatusRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<UserResponse> {
  return requestJson(`${apiBase}/users/${encodeURIComponent(userId)}/status`, {
    method: 'PUT',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function listApplications(query: { query?: string; status?: string } = {}) {
  const search = new URLSearchParams()
  if (query.query) search.set('query', query.query)
  if (query.status) search.set('status', query.status)
  const suffix = search.size ? `?${search.toString()}` : ''
  return requestJson<ApplicationResponse[]>(`${apiBase}/applications${suffix}`)
}

export function getApplication(appCode: string): Promise<ApplicationResponse> {
  return requestJson(`${apiBase}/applications/${encodeURIComponent(appCode)}`)
}

export function createApplication(
  request: CreateApplicationRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<ApplicationSecretResponse> {
  return requestJson(`${apiBase}/applications`, {
    method: 'POST',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function updateApplication(
  appCode: string,
  request: UpdateApplicationRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<ApplicationResponse> {
  return requestJson(`${apiBase}/applications/${encodeURIComponent(appCode)}`, {
    method: 'PUT',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function changeApplicationStatus(
  appCode: string,
  request: ChangeApplicationStatusRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<ApplicationResponse> {
  return requestJson(`${apiBase}/applications/${encodeURIComponent(appCode)}/status`, {
    method: 'PUT',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function rotateApplicationSecret(
  appCode: string,
  request: VersionedReasonRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<ApplicationSecretResponse> {
  return requestJson(`${apiBase}/applications/${encodeURIComponent(appCode)}/secret/rotate`, {
    method: 'POST',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function revokeApplicationSecret(
  appCode: string,
  request: VersionedReasonRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<ApplicationResponse> {
  return requestJson(`${apiBase}/applications/${encodeURIComponent(appCode)}/secret/revoke`, {
    method: 'POST',
    body: request,
    csrfToken,
    idempotencyKey,
  })
}

export function listUserApplicationAccess(userId: string): Promise<ApplicationAccessResponse[]> {
  return requestJson(`${apiBase}/users/${encodeURIComponent(userId)}/application-access`)
}

export function changeUserApplicationAccess(
  userId: string,
  appCode: string,
  request: ChangeApplicationAccessRequest,
  csrfToken: string,
  idempotencyKey: string,
): Promise<ApplicationAccessResponse> {
  return requestJson(
    `${apiBase}/users/${encodeURIComponent(userId)}/application-access/${encodeURIComponent(appCode)}`,
    {
      method: 'PUT',
      body: request,
      csrfToken,
      idempotencyKey,
    },
  )
}
