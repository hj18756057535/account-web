import { messages } from '@/locales'

export function synchronizationError(code?: string | null): string {
  const copy = messages.access.syncErrors
  switch (code) {
    case 'SYNC_DISABLED':
    case 'SYNC_TARGET_UNAVAILABLE':
    case 'SYNC_TARGET_INVALID':
      return copy.configuration
    case 'SYNC_TARGET_CHANGED':
      return copy.changed
    case 'SYNC_IDENTITY_CONFLICT':
      return copy.identity
    case 'SYNC_RESULT_INVALID':
    case 'SYNC_RESPONSE_REJECTED':
    case 'SYNC_RESPONSE_TOO_LARGE':
      return copy.invalid
    case 'SYNC_DEPENDENCY_UNAVAILABLE':
      return copy.unavailable
    case 'SYNC_RETRY_EXHAUSTED':
      return copy.exhausted
    case 'SYNC_EXPIRED':
      return copy.expired
    case 'SYNC_USER_DISABLED':
      return copy.userDisabled
    case 'SYNC_PAYLOAD_INVALID':
    case 'SYNC_PAYLOAD_TOO_LARGE':
      return copy.payload
    default:
      return copy.unknown
  }
}
