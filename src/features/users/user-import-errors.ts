import { ApiError } from '@/api/http'

export function userImportErrorKey(error: unknown) {
  if (!(error instanceof ApiError)) return 'failed'
  if (error.status === 401 || error.status === 403) return 'denied'
  if (error.code === 'IMPORT_DISABLED') return 'disabled'
  if (error.status === 404 || error.status === 410) return 'expired'
  if (error.status === 409) return 'conflict'
  if (error.code === 'IMPORT_FILE_INVALID') return 'workbookInvalid'
  if (error.code === 'IMPORT_LIMIT_EXCEEDED' || error.status === 413) return 'limitExceeded'
  if (error.status === 422) return 'workbookInvalid'
  return 'failed'
}
