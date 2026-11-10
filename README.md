# EnglishCards

**EnglishCards** 是面向 Windows x64 的本地英语精读卡片编辑器，采用 **WPF (.NET 10) + WebView2 + React/TypeScript**。

**Phase E 实现与前端自动化验证已完成，正在等待最后的 Windows/WPF 实机验收。** 功能包括三栏工作区、文件型 Article v6 自动保存、独立 JSON 新建、导出 ZIP、统一浮动通知和紧凑设置窗口。开发分支为 `feature/phase-e-card-library`，尚未合并到 `main`。

桌面端打开卡片馆里的 JSON 文件并直接保存到原文件。保存尚未完成时，切换卡片请求会被拒绝；保存完成后必须重新点击。旧全局草稿不会自动恢复或迁移，程序也不会自行删除既有草稿文件。

最新规则以 [Phase E 卡片馆规格](docs/specs/PHASE_E_CARD_LIBRARY.md) 为准。当前分支最近一次前端验证为 Vitest 64/64、Playwright 69/69、TypeScript/Vite 构建成功；合并前仍须完成 .NET 桌面测试、正式发布和真实 Windows/WPF/WebView2 验收。

## 已确认的目标产品规则

- Article 使用 `schemaVersion: 6`，不兼容 v5，不提供旧格式迁移或双写。
- Article 包含 `id`、`title`、`identityTag`、`content.paragraphs`、`vocabulary` 和 `translation.paragraphs`。
- 正文和译文各自最多 999 个自然段，分别使用 `p001`–`p999`；Vocabulary 最多 999 项，使用 `v001`–`v999`。
- Vocabulary 统一管理单词、词组和习语，核心字段为 `word`，保留音标、高亮规则及多义项。
- 正式桌面端直接从卡片馆打开严格的 Article v6 JSON，并自动保存到原文件；TXT 可作为 Skill 的输入资料，不再通过桌面端导入按钮操作。
- 右侧编辑器采用 Vocabulary → Content → Translation 顺序；正文和译文各使用连续多段落编辑区域。
- 生词只从左侧卡片预览选择；加号位于选区右下角。只允许同一自然段、同一张卡片内的选择；选区必须含英文字母且不得包含中文字符。
- 左侧预览用于阅读与提取：普通单击、双击不触发右侧编辑器导航；右侧编辑区独立工作，两侧通过 Article 数据模型同步。
- 不提供 Undo/Redo；Ctrl+Z、Ctrl+Y、Ctrl+Shift+Z 不执行撤销/重做。鼠标右键在 React 页面与 WPF/WebView2 宿主中均无操作；Ctrl+C、Ctrl+V、Ctrl+A 等正常键盘编辑操作保留。
- 唯一正式用户导出为完整 ZIP，包含 `article.json` 和全部页面 PNG。
- 保留 WPF + WebView2 + React 技术栈及 EXE 同级 `userdata/` 用户数据契约。

## 运行要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows x64 |
| .NET | [Microsoft .NET 10 Desktop Runtime (x64)](https://dotnet.microsoft.com/download/dotnet/10.0) |
| 页面引擎 | [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) |
| 中文字体 | Microsoft YaHei UI、Microsoft YaHei、DengXian，最后回退 sans-serif |
| Node.js | 最终用户不需要；仅开发、构建和测试使用 |

本程序采用 Framework-dependent 发布，不附带 .NET Runtime。目标电脑必须安装兼容的 .NET 10 Desktop Runtime x64。WebView2 使用 Evergreen Runtime。程序不需要独立安装 Chromium，也不需要启动 Express 服务。

## 开发环境与验证

需要 Windows x64、.NET 10 SDK、Node.js 22.12 或更高版本和 npm。在仓库根目录执行：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

.NET 桌面测试：

```bat
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
```

正式发布：

```bat
npm.cmd run build
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Playwright / Chromium 只用于开发测试，不属于最终用户运行依赖。自动化浏览器测试不能替代真实 Windows/WPF/WebView2 启动、用户数据和 ZIP 导出验收。

## 仓库目录

```text
EnglishCards/                    # 生产功能代码
├── desktop/                     # WPF 主程序、WebView2、持久化和 ZIP 导出
├── frontend/                    # React/TypeScript、前端入口和运行资源
└── .build/                      # Vite 生成的嵌入资源（可删除重建）

EnglishCards.Tests/              # 独立测试代码
├── dotnet/                      # .NET 桌面测试
└── frontend/
    ├── unit/                    # Vitest
    └── e2e/                     # Playwright

docs/                            # 项目契约、架构、规格、审查和历史记录
docs/skills/                    # 项目专属 Skills
tools/                           # 构建、测试、发布和开发辅助工具
.build/                          # 临时测试结果、报告和测试运行数据
dist/EnglishCards/               # 唯一正式发布目录
```

`package.json`、`package-lock.json`、`tsconfig.json`、`AGENTS.md` 和 `README.md` 保留在仓库根目录，作为仓库级构建与协作配置。`node_modules/`、`.build/`、`EnglishCards/.build/`、`bin/`、`obj/` 和 `dist/` 均不提交 Git。项目不再保留固定 `artifacts/` 目录。

## 用户数据

正式程序在 `EnglishCards.exe` 同级创建 `userdata/`，用于设置、卡片馆、导出、缓存、WebView2 Profile 和日志。旧版草稿内容不自动恢复，也不主动删除。发布/升级不得删除 `userdata/`。不要扫描、迁移或删除旧版 `%LOCALAPPDATA%\EnglishCards` 数据。用户数据不得放入源码包、Git 提交或发布构建清理流程。

## 文档与开发代理

- 项目契约：[`docs/project-contract.md`](docs/project-contract.md)
- Article v6 阶段记录：[`docs/architecture/ARTICLE_V6_PHASE1.md`](docs/architecture/ARTICLE_V6_PHASE1.md)
- Article v6 生成 Skill：[`docs/skills/article-to-englishcards/SKILL.md`](docs/skills/article-to-englishcards/SKILL.md)
- Windows 桌面审查 Skill：[`docs/skills/windows-app-review/SKILL.md`](docs/skills/windows-app-review/SKILL.md)
- 仓库代理规则：[`AGENTS.md`](AGENTS.md)

当前 Phase E 的文件工作流以 `docs/specs/PHASE_E_CARD_LIBRARY.md` 为准。旧版阶段记录和审查报告仅用于追溯，不覆盖后续确认的 Phase E 规则。
