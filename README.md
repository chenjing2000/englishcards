# EnglishCards

**EnglishCards** 是面向 Windows x64 的本地英语精读卡片编辑器，采用 **WPF + .NET 10 + WebView2 + React/TypeScript**。当前正式数据格式为 Article v6，卡片馆与 JSON + ZIP 联合保存工作流已完成。

## 当前功能

- 三栏工作区：卡片馆目录树、文章预览、连续编辑器。
- 卡片馆按目录浏览独立 JSON 文件；点击 JSON 打开文章。
- 右侧编辑器按 Vocabulary → Content → Translation 排列；左侧预览用于阅读和选词。
- Article v6 严格校验；v5 及更早格式拒绝，不做静默迁移或双写。
- 工具栏提供清空当前文章，以及保存 JSON + ZIP。普通编辑继续约 300 ms 防抖自动保存当前卡片 JSON；保存按钮右上角的星号表示本次会话中内容或页面设置尚未完成 JSON + ZIP 联合保存。
- 保存期间拒绝切换卡片；不会排队执行被阻止的切换请求。
- 保存成功后同时生成同名 JSON 与 ZIP。ZIP 包含 `article.json` 和全部页面 PNG。编辑、自动保存、保存及覆盖弹窗不应清空当前有效预览；新分页完成后再替换，保留阅读位置。
- 统一前端覆盖确认窗口；取消、关闭或点击遮罩均不执行覆盖。ESC 不作为取消方式。

## Article v6 数据规则

- 唯一正式格式：`schemaVersion: 6`。
- 顶层字段：`schemaVersion`、`id`、`title`、`identityTag`、`content`、`vocabulary`、`translation`。
- 正文与译文各自最多 999 段，分别连续编号 `p001`–`p999`。
- Vocabulary 最多 999 项，连续编号 `v001`–`v999`。
- Vocabulary 统一使用 `word` 字段管理单词、词组和习语。
- 不接受 v5 或更早格式，不做迁移、兼容双写或静默字段转换。

## 卡片馆、清空与联合保存

- 左侧目录树浏览用户选择的目录，按需加载子目录；点击独立 JSON 文件打开卡片。
- 保存期间拒绝切换卡片。用户需要在保存完成后重新点击目标卡片。
- 工具栏不提供新建卡片、旧版 JSON/TXT 导入或旧全局草稿恢复。
- 清空当前文章：对于内容非空的当前文章，即使本次会话尚无修改，也显示“保存”“放弃”“取消”确认；明确放弃后才清空。保存须在 JSON + ZIP 均成功后才清空；放弃不删除已保存文件；取消保持原状。已有保存任务未完成时先等待完成。
- 保存 JSON + ZIP：选择目标文件夹，默认定位到最近一次成功保存的卡片馆路径；按文章标题生成同名 JSON 和 ZIP。
- 只要 JSON 或 ZIP 任一目标已存在，就显示统一前端覆盖确认。确认后同时替换文件；取消、关闭弹窗或点击遮罩均不修改原文件。
- 两个文件均提交成功后，更新最近路径并将卡片馆根目录切换到目标目录。跨两个文件不宣称具备文件系统级原子性；实现通过暂存、备份和失败回滚尽可能保护已有文件。

## 运行要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows x64 |
| .NET | [.NET 10 Desktop Runtime (x64)](https://dotnet.microsoft.com/download/dotnet/10.0) |
| 页面引擎 | [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) |
| Node.js | 最终用户不需要；开发、构建和测试使用 |

程序采用 Framework-dependent、win-x64、单文件发布，不附带 .NET Runtime。目标电脑须安装兼容的 .NET 10 Desktop Runtime x64 和 WebView2 Evergreen Runtime。缺少 .NET Runtime 时由 .NET Host 提示；WebView2 初始化失败时应用提供 Microsoft 官方安装/修复入口。

用户数据位于 EXE 同级 `userdata/`，用于设置、卡片馆路径、缓存、WebView2 Profile 和日志。发布/升级不得删除该目录。不会扫描、迁移或删除旧版 `%LOCALAPPDATA%\\EnglishCards` 数据。

## 开发、测试与发布

开发环境需要 Windows x64、.NET 10 SDK、Node.js 22.12+ 和 npm。在仓库根目录运行：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
```

发布：

```bat
npm.cmd run build
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Playwright/Chromium 只用于开发测试。自动化浏览器测试不能替代真实 Windows/WPF/WebView2 启动及联合保存验收。

## 仓库与文档

- `EnglishCards/`：生产代码（WPF、WebView2、React/TypeScript）。
- `EnglishCards.Tests/`：.NET、Vitest 和 Playwright 测试。
- `docs/specs/`：现行技术规格。
- `docs/skills/`：项目 Skills。
- `docs/reference-assets/`：保留的参考素材。
- `tools/`：开发与发布工具。
- `dist/EnglishCards/`：唯一发布输出目录。

文档阅读顺序：

1. [项目总契约](docs/project-contract.md)
2. [Phase E 卡片馆规格](docs/specs/PHASE_E_CARD_LIBRARY.md)
3. [JSON + ZIP 联合保存规格](docs/specs/COMBINED_ARTICLE_SAVE.md)
4. [ZIP 渲染与归档技术契约](docs/specs/EXPORT_CONTRACT.md)
5. [WPF/WebView2 桌面宿主规格](docs/specs/DESKTOP_WEBVIEW2.md) 与 [编辑器桥接契约](docs/specs/EDITOR_BRIDGE_CONTRACT.md)
6. [当前实施状态](docs/implementation-status.md) 与 [Windows 验收记录](docs/RELEASE_ACCEPTANCE.md)

项目 Skills： [Article v6 生成](docs/skills/article-to-englishcards/SKILL.md)、[项目代码审查](docs/skills/project-code-review/SKILL.md)、[Windows 应用审查](docs/skills/windows-app-review/SKILL.md)。
