# A1 开发分支实施状态（2026-11-22）

本分支仅落实获批 A1：Script 原生数据入口、可选 Vocabulary/Translation、单页只读阅读；保留现有懒加载目录树，PNG/MP4/播放操作不可用。生词写入与每 Script 设置、A2 目录语义、B 媒体及 C 导出均未完成。

旧编辑、清空、Article 自动保存和 JSON+ZIP 主路径从生产入口撤去；历史测试与专属导出实现移入 `EnglishCards.Tests/legacy-article/`、`EnglishCards.Tests/frontend/legacy-e2e/` 保留，不作为新入口兼容层。A1 定向验证：原生模型 5/5、浏览器交互 7/7、宿主只读文件检查 8/8，前端构建及依赖系统运行库的单文件发布通过。实际发布版 WPF/WebView2 在 144 DPI（150%）完成目录点击、四页翻页、完整正文还原、译文换行、边界按钮和源文件未修改检查。实际 WebView2 157.0.4341.60、.NET 10.0.14；验收数据全部隔离。该测试实际发现并修复宿主快照 PascalCase/camelCase 不一致。开发用生产渲染诊断 `npm.cmd run demo` 也已通过：原生 Script 输入、1200×1600、重复字节一致、无外部网络请求。该入口起初因 `.build` 固定页面被 Express 的 dotfile 默认规则拦截，已只对固定 render.html 放行；它是测试诊断，不表示 A1 的 PNG 导出按钮可用。旧 CI 数量不作为 A1 验收证据。仅创建开发 PR，不自动合并。

复跑命令：`npm.cmd test -- reader.test.ts`、`npm.cmd run build`、独立端口的 `npm.cmd run test:e2e -- readonly-reader.spec.ts`、`dotnet run --project EnglishCards.Tests/dotnet/EnglishCards.Tests.csproj -c Release -- --a1`；构建发布后 `./tools/test-desktop.ps1 -ExpectedDpi 144`。本地证据与截图位于 `.build/desktop/verification/bfb06408ab8846a0a61f57d7504b60e6/`。GitHub 新 PR CI 以实际运行结果为准，本记录不宣称其他 DPI、干净机器、媒体/导出或所有者验收已通过。

---

以下为 Article v6 历史实施与验收记录，不代表只读阅读器已经验证：

# EnglishCards 当前实施状态

**状态基准：** 2026-11-12
**主分支基准提交：** `839bf7f9e1aedc520776bd81193cbd0667908779`
**当前产品阶段：** Article v6、Phase E 卡片馆及 JSON + ZIP 联合保存已实施。

## 当前产品状态

- Windows x64：WPF + .NET 10 + WebView2 + React/TypeScript。
- Article v6 是唯一正式格式；v5 及更早格式拒绝，不迁移、不双写。
- 卡片馆通过目录树打开独立 JSON；保存期间拒绝切换。
- 工具栏提供清空当前文章和保存 JSON + ZIP。当前卡片 JSON 自动保存仍使用约 300 ms 防抖；保存按钮星号标识本次会话尚未联合保存的内容或页面设置变更。
- 非空文章清空时（包括当前尚无修改的已打开卡片）提供保存/放弃/取消；存在未完成保存任务时不得清空。
- 联合保存生成同名 JSON 和 ZIP；任一目标存在时使用统一前端覆盖确认。
- ZIP 内容、渲染和校验细节见专项契约。

## 已完成工作

- Article v6 生产数据模型、严格校验、编辑器、预览和 WPF 边界已统一。
- Phase E 卡片馆、懒加载目录树、文件打开、文件级保存协调和保存期间切换保护已完成。
- 清空当前文章与 JSON + ZIP 联合保存工作流已完成；覆盖确认复用前端 Phase E 弹窗样式。
- ZIP 仍使用共享渲染实现，输出 Article v6 JSON 和全部页面 PNG。
- 已完成预览稳定性改造：编辑、自动保存、设置和联合保存期间保留最后有效预览，新分页完成后再替换；明确清空才移除预览。
- Windows x64 发布、WPF/WebView2 实机验收及 GitHub CI 已按最近一轮交付记录完成。

## 验收证据与边界

- Phase E 基线验收记录：Vitest 64/64、Playwright 69/69、.NET 桌面测试 19/19、TypeScript/Vite 生产构建、Article v6 Skill 校验、Windows x64 发布、WPF/WebView2 启动及关键 UI 实机验收通过。
- 联合保存与清空、两批代码精简及预览稳定性修改均已合并。最新 `main` 验证为 Vitest 63/63、Playwright 76/76、React/TypeScript 构建和 Windows .NET 测试通过；项目所有者已确认预览稳定性修改的 Windows 实机验收。CI：https://github.com/chenjing2000/englishcards/actions/runs/43160647841 。Phase E 基线数据仍单独保留，不能混作当前测试数量。
- 外部干净 Windows 机器的 Runtime 缺失、可移植性、升级数据保全及公开样例素材权利检查，不属于已完成证据；发布前仍应按 [RELEASE_ACCEPTANCE.md](RELEASE_ACCEPTANCE.md) 的边界核实。

## 当前关键提交

- `8e47296` — Phase E 卡片馆合并。
- `822864f` — 清空当前文章与 JSON + ZIP 联合保存完成（历史基准）。
- `aa48ac7` — 第一批精简（PR #5）。
- `9832c42` — 第二批精简（PR #6）。
- `839bf7f` — 预览稳定性及未联合保存星号（PR #7，当前基准）。

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
