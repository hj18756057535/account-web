import { test, expect } from '@playwright/test'

test('opens the Account engineering baseline', async ({ page }) => {
  await page.goto('/console/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Account 管理端')
  await expect(page.getByRole('status')).toHaveText('工程基线已就绪')
})
