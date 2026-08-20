import { test, expect } from '@playwright/test'

test('shows the secure login recovery state when Account API is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.route('**/api/session', (route) => route.abort())
  await page.goto('/console/login')

  await expect(page.getByRole('heading', { name: '登录账号管理端' })).toBeVisible()
  await expect(page.getByText('暂时无法连接 Account 服务')).toBeVisible()
})

test('opens the authenticated user directory with contract-shaped data', async ({ page }) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
        roles: ['ACCOUNT_ADMIN'],
        capabilities: ['users:read'],
        csrfToken: 'synthetic-csrf-token-for-browser-test',
      }),
    }),
  )
  await page.route('**/api/users?**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'synthetic-user',
            account: 'zhangsan',
            email: 'zhangsan@example.test',
            name: '张三',
            phone: '13800000000',
            status: 'enabled',
            createdAt: '2026-08-20T00:00:00Z',
            updatedAt: '2026-08-20T00:00:00Z',
          },
        ],
        page: 1,
        size: 20,
        total: 1,
      }),
    }),
  )

  await page.goto('/console/users')

  await expect(page.getByRole('heading', { name: '全局用户' })).toBeVisible()
  await expect(page.getByText('zhangsan', { exact: true })).toBeVisible()
  await expect(page.getByText('张三')).toBeVisible()
})

test('returns safely to login when the user directory reports an expired session', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
        roles: ['ACCOUNT_ADMIN'],
        capabilities: ['users:read'],
        csrfToken: 'synthetic-csrf-token-for-expiry-test',
      }),
    }),
  )
  await page.route('**/api/users?**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'synthetic expired session',
        traceId: 'synthetic-trace',
      }),
    }),
  )

  await page.goto('/console/users')

  await expect(page).toHaveURL(/\/console\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: '登录账号管理端' })).toBeVisible()
})
