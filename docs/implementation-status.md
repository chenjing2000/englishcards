# EnglishCards 当前实施状态

**状态基准：** 2026-11-11
**主分支基准提交：** `822864ff99787395b21b040a0b0fccc0c62e2fc6`
**当前产品阶段：** Article v6、Phase E 卡片馆及 JSON + ZIP 联合保存已实施。

## 当前产品状态

- Windows x64：WPF + .NET 10 + WebView2 + React/TypeScript。
- Article v6 是唯一正式格式；v5 及更早格式拒绝，不迁移、不双写。
- 卡片馆通过目录树打开独立 JSON；保存期间拒绝切换。
- 工具栏提供清空当前文章和保存 JSON + ZIP。
- 清空未保存文章时提供保存/放弃/取消；存在未完成保存任务时不得清空。
- 联合保存生成同名 JSON 和 ZIP；任一目标存在时使用统一前端覆盖确认。
- ZIP 内容、渲染和校验细节见专项契约。

## 已完成工作

- Article v6 生产数据模型、严格校验、编辑器、预览和 WPF 边界已统一。
- Phase E 卡片馆、懒加载目录树、文件打开、文件级保存协调和保存期间切换保护已完成。
- 清空当前文章与 JSON + ZIP 联合保存工作流已完成；覆盖确认复用前端 Phase E 弹窗样式。
- ZIP 仍使用共享渲染实现，输出 Article v6 JSON 和全部页面 PNG。
- Windows x64 发布、WPF/WebView2 实机验收及 GitHub CI 已按最近一轮交付记录完成。

## 验收证据与边界

- Phase E 基线验收记录：Vitest 64/64、Playwright 69/69、.NET 桌面测试 19/19、TypeScript/Vite 生产构建、Article v6 Skill 校验、Windows x64 发布、WPF/WebView2 启动及关键 UI 实机验收通过。
- 后续联合保存与清空工作流已在后续提交中完成，并由用户确认 Windows 本地验收；最新提交为 `822864f`。本文件不将 Phase E 基线测试数量冒充为后续每一项改动的独立测试计数。
- 外部干净 Windows 机器的 Runtime 缺失、可移植性、升级数据保全及公开样例素材权利检查，不属于已完成证据；发布前仍应按 [RELEASE_ACCEPTANCE.md](RELEASE_ACCEPTANCE.md) 的边界核实。

## 当前关键提交

- `8e47296` — Phase E 卡片馆合并。
- `822864f` — 清空当前文章与 JSON + ZIP 联合保存完成（当前基准）。

## 常用验证入口

从仓库根目录，在 Windows x64 开发环境执行：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Article Skill：

```bat
npx.cmd tsx docs/skills/article-to-englishcards/scripts/validate-project.ts
```

## 文档权威顺序

项目总规则见 [project-contract.md](project-contract.md)；用户流程见 [COMBINED_ARTICLE_SAVE.md](specs/COMBINED_ARTICLE_SAVE.md) 和 [PHASE_E_CARD_LIBRARY.md](specs/PHASE_E_CARD_LIBRARY.md)；ZIP 技术细节见 [EXPORT_CONTRACT.md](specs/EXPORT_CONTRACT.md)。本文件只记录现状和验证入口，不保留逐日开发流水账。
