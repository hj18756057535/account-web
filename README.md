# account-web

Account Center 独立管理前端，包含用户管理、应用及 Secret 管理、用户授权、接入调试、审计和管理概览。新建用户不自动授权；授权应用后同步，匹配当前版本的确认才表示生效。

## 技术基线

- Node.js 24 LTS（`.nvmrc`、`.tool-versions` 与 `.vfox.toml` 固定本机验证版本）
- pnpm 11.19.0 与 frozen lockfile
- Vue 3、TypeScript strict、Vite、Vue Router、Pinia、Element Plus
- Vitest、Playwright、ESLint、Oxlint、Stylelint、Prettier
- 语言 `zh-CN`、`zh-TW`、`en-US`、`vi-VN`，资源归入 `src/locales`，组件与日期/数字同步切换

## 本地启动

使用 mise 时，先在 `account-web` 运行 `mise install`，安装 `.tool-versions` 中固定的 Node.js 和 pnpm。

复制 `.env.example` 为本地未提交的 `.env.local`，按需调整 Account Server 地址。配置键不包含 Secret：

- `VITE_ACCOUNT_API_BASE`：浏览器使用的同源 API 前缀，默认 `/api`
- `ACCOUNT_DEV_PROXY_TARGET`：仅 Vite 开发服务器使用，默认 `http://127.0.0.1:8088`

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

开发地址为 `http://localhost:5173/console/`，`/api/**` 通过 Vite 同源代理转发到 Account Server。

“接入调试”入口检测连接、拉取和确认导入用户/角色/组织；“用户授权”选择用户后授权应用、查看同步结果，并进入独立的角色与菜单授权页面。用户列表可点击“授权”直接进入指定用户；应用列表和详情可通过“进入应用”打开登记入口。授权与撤权不填写理由，菜单及角色定义由应用维护，Account 不提供目录编辑；应用返回角色列表时才显示角色选择。应用只要求编码、名称，其余地址按需填写；可用功能由配置派生，没有协议勾选或功能启停。默认 CMS 数据使用一条 SQL，CMS 使用默认 bootstrap，页面没有特定应用的本机配置按钮。页面设计见 [控制台操作与用户授权](../docs/account-center/控制台操作与用户授权-设计.md)，部署及数据库步骤见 [对接方案](../docs/application-integration/CMS接入-部署对接方案.md)。

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
