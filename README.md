# account-web

Account Center 独立管理前端。当前包含登录态、全局用户管理、应用登记/编辑/启停、一次性 Secret 创建/轮换/撤销，以及用户应用准入期望状态。准入只记录 Account 期望，固定显示“待应用适配”，不代表业务应用已经生效；审计与运营页面后续交付。

## 技术基线

- Node.js 24 LTS（`.nvmrc`、`.tool-versions` 与 `.vfox.toml` 固定本机验证版本）
- pnpm 11.19.0 与 frozen lockfile
- Vue 3、TypeScript strict、Vite、Vue Router、Pinia、Element Plus
- Vitest、Playwright、ESLint、Oxlint、Stylelint、Prettier
- 首期语言 `zh-CN`，用户可见文案归入 `src/locales`

## 本地启动

复制 `.env.example` 为本地未提交的 `.env.local`，按需调整 Account Server 地址。配置键不包含 Secret：

- `VITE_ACCOUNT_API_BASE`：浏览器使用的同源 API 前缀，默认 `/api`
- `ACCOUNT_DEV_PROXY_TARGET`：仅 Vite 开发服务器使用，默认 `http://127.0.0.1:8088`

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

开发地址为 `http://localhost:5173/console/`，`/api/**` 通过 Vite 同源代理转发到 Account Server。

## 质量门

以下命令均为非交互检查，不会自动修复源码：

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

ACCOUNT-001 的浏览器测试由开发者负责；Agent 不新增、运行或排查 E2E，自动质量门仅包含前五项。`test:e2e` 保留为开发者可选入口，不代表当前已验证。人工页面清单见协调工作区 `ACCEPTANCE.md`。

## 边界

- API 类型必须从批准的 `openapi/account-api.yaml` 生成，禁止手写重复 DTO。
- 浏览器不保存 Session、Token、Secret、Ticket 或完整用户资料。
- 当前仓库不包含 `cms-ai` 代码，不允许绕过 Account API 直接调用业务应用。
