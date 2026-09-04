import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http'
import { messages, setLocale } from '@/locales'
import { userImportErrorKey } from './user-import-errors'

afterEach(() => setLocale('zh-CN'))

describe('user import errors', () => {
  it('shows workbook requirements for IMPORT_FILE_INVALID and follows the selected language', () => {
    const error = new ApiError(422, {
      code: 'IMPORT_FILE_INVALID',
      message: 'Invalid XLSX',
      traceId: 'synthetic-trace',
    })
    const key = userImportErrorKey(error)
    setLocale('zh-CN')
    expect(messages.imports[key]).toContain('仅一个工作表、四列文本')
    expect(messages.imports[key]).not.toEqual(messages.imports.fileInvalid)
    setLocale('en-US')
    expect(messages.imports[key]).toContain('one sheet and four text columns')
  })

  it.each([
    [413, 'IMPORT_LIMIT_EXCEEDED', 'limitExceeded'],
    [413, 'UNEXPECTED_RESPONSE', 'limitExceeded'],
    [422, 'UNEXPECTED_RESPONSE', 'workbookInvalid'],
    [401, 'AUTHENTICATION_REQUIRED', 'denied'],
    [403, 'ACCESS_DENIED', 'denied'],
    [404, 'IMPORT_DISABLED', 'disabled'],
    [404, 'IMPORT_NOT_FOUND', 'expired'],
    [410, 'IMPORT_EXPIRED', 'expired'],
    [409, 'IMPORT_CONFLICT', 'conflict'],
    [500, 'INTERNAL_ERROR', 'failed'],
  ])('maps HTTP %s / %s to %s', (status, code, expected) => {
    expect(userImportErrorKey(new ApiError(status, { code, message: '', traceId: '' }))).toBe(
      expected,
    )
  })

  it('keeps network errors separate from file validation', () => {
    expect(userImportErrorKey(new TypeError('Network error'))).toBe('failed')
  })
})
