# account-web AI 协作规则

## 项目范围

本仓库是 Account Center 独立管理前端。业务事实和最终授权由 Account 后端负责；前端只负责管理体验，不作为安全边界，也不直接调用业务应用。

## 技术与目录

- Node.js 24 LTS、pnpm、Vue 3、TypeScript strict、Vite。
- Vue Router 管理路由；Pinia 只保存跨页面必要状态。
- Element Plus 提供基础组件，Account Design Token 位于 `src/design`。
- 功能按 `src/features/<domain>` 纵向组织；API 请求和生成类型位于 `src/api`。
- 用户可见文案进入 `src/locales`，首期语言为 `zh-CN`。

## 硬规则

1. 先读取协调工作区中 ACCOUNT-001 的 Spec、Design、Plan、TASKS 和技术画像，再实现当前最小切片。
2. API 类型必须来自批准的 OpenAPI；不得根据旧字段名猜 DTO，也不得在页面里维护平行 HTTP 客户端。
3. 路由与按钮隐藏只改善体验，不能代替后端 Session、CSRF、角色和对象范围校验。
4. 不在 localStorage、sessionStorage、日志、截图或测试夹具中保存 Secret、Ticket、Token、Session ID 或真实用户数据。
5. 用户文案、可访问性标签、错误和空状态统一进入 locale 资源；布局必须适应长文案和窄视口。
6. 使用设计令牌，不散落重复颜色、间距、圆角、z-index 和断点。
7. 不自动修复作为质量门；自动格式化或 fix 命令必须由开发者明确执行并 Review 差异。
8. 不提交、合并或部署，除非开发者明确授权。

## 验证

```powershell
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
git diff --check
```

每个切片按适用范围运行定向测试，并在协调工作区的 `TEST-REPORT.md` 记录命令、退出码和证据。Playwright 必须说明浏览器、视口、服务地址和夹具。

## 最终回复

说明改动文件、验证命令、未验证项和已知风险。不得把脚手架通过描述为业务功能或人工验收通过。
