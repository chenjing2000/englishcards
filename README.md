# EnglishCards

本开发分支为 Windows x64 **只读 Script 阅读器 A1 + A2 + A3**：WPF + .NET 10 + WebView2 + React/TypeScript。设计依据是 [PR #11](https://github.com/chenjing2000/englishcards/pull/11) 的实施文档；A1（PR #12）及 A2（PR #13）已合并，当前 [Draft PR #14](https://github.com/chenjing2000/englishcards/pull/14) 仅实现 A3，仍待所有者 Windows 实机验收，不代表 B/C 已完成。

## 当前范围

- 从现有目录树明确选择 Script JSON，显示其句子 text；可选显示同目录的原生 Vocabulary 与 Translation。
- 单页阅读，上一页/下一页与页码；标题可为空，时间戳不影响正文完整性。
- 不再编辑、清空、自动保存原文或执行 JSON + ZIP 联合保存，不接受 Article v6 作为生产输入。
- A3 可在 Script 有效句中选词，点击蓝色加号填写词性和释义，将词条立即写入当前活动 Vocabulary；没有生词本时首次加词才创建文件。外部修改或重复词会拒绝覆盖。
- A3 设置窗口按 Script 独立读取、编辑、显式保存基础页面样式；支持恢复默认、取消及校验，损坏设置不会被自动覆盖。媒体播放与 PNG/MP4 导出仍不可用，分别留到 B/C。
- 目录按层加载，仅显示 Script JSON；无当前 Script 时，本层只有一个便自动打开，多个等待选择。折叠重开和同路径根刷新保持当前阅读；取消/失败保留旧会话，不同根成功选择才切换。媒体与导出分别留到 B/C。
- [项目契约](docs/project-contract.md) 记录当前范围；[实施状态](docs/implementation-status.md) 分开记录自动化和实机证据。

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
npm.cmd test -- reader.test.ts
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release -- --a3
```

发布：

```bat
npm.cmd run build
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Playwright/Chromium 只用于开发测试。自动化浏览器及原生文件测试不能替代真实 Windows/WPF/WebView2 的 A3 生词与设置写入实机验收。

## 仓库与文档

- `EnglishCards/`：生产代码（WPF、WebView2、React/TypeScript）。
- `EnglishCards.Tests/`：.NET、Vitest 和 Playwright 测试。
- `docs/specs/`：现行技术规格。
- `docs/skills/`：项目 Skills。
- `docs/reference-assets/`：保留的参考素材。
- `tools/`：开发与发布工具。
- `dist/EnglishCards/`：唯一发布输出目录。

文档阅读顺序：

1. [项目总契约](docs/project-contract.md) 与根目录 AGENTS.md。
2. [完整设计（PR #11）](https://github.com/chenjing2000/englishcards/blob/58f309e1d7dcaf3516471d855a1d6403468a7434/docs/Implementation%20Plan.md)。
3. [当前实施状态](docs/implementation-status.md) 与 [Windows 验收记录](docs/RELEASE_ACCEPTANCE.md)。

原 Phase E、联合保存、ZIP 及旧编辑器桥接规格仅保留为历史技术参考，不是 A1 的生产操作说明。Article v6 生成 Skill 保留供历史素材使用，不能生成新阅读器的 Script 输入。项目代码审查与 Windows 应用审查 Skill 的通用方法继续有效；涉及旧数据和联合保存的段落须以当前产品契约为准。
