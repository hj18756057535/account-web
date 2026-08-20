export interface ApiErrorBody {
  code: string
  message: string
  traceId: string
  fieldErrors?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId: string
  readonly fieldErrors: Record<string, string>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.traceId = body.traceId
    this.fieldErrors = body.fieldErrors ?? {}
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  csrfToken?: string
  timeoutMs?: number
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { body, csrfToken, timeoutMs, ...requestOptions } = options
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs ?? 10_000)
  const headers = new Headers(requestOptions.headers)
  headers.set('Accept', 'application/json')
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  try {
    const response = await fetch(url, {
      ...requestOptions,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      headers,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new ApiError(response.status, await readError(response))
    }
    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

async function readError(response: Response): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>
    if (typeof body.code === 'string' && typeof body.message === 'string') {
      return {
        code: body.code,
        message: body.message,
        traceId: typeof body.traceId === 'string' ? body.traceId : '',
        fieldErrors: body.fieldErrors,
      }
    }
  } catch {
    // 非 JSON 错误统一收敛，避免把代理或服务器内部页面直接展示给用户。
  }
  return {
    code: 'UNEXPECTED_RESPONSE',
    message: 'Unexpected service response',
    traceId: response.headers.get('X-Trace-Id') ?? '',
  }
}
