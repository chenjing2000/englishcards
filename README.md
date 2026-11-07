# EnglishCards

**EnglishCards** 是面向 Windows x64 的本地英语精读卡片编辑器。使用 **WPF (.NET 10) + WebView2 + React/TypeScript**，支持文章编辑、词汇与表达管理、卡片自动分页、实时预览、JSON 项目保存，以及将**全部卡片图片和项目 JSON 打包为 ZIP**。

> **项目状态：Release Candidate（候选发布）。** 2026-11-06 用户已在 Windows 上对字体精简后的最新源码完成 Vitest 35/35、Playwright 59/59、.NET 桌面测试 16/16、Vite 生产构建和 Windows x64 单文件发布；EXE 约 1.9 MB。用户还对比了中文预览与导出 PNG，未见明显差异。**独立 Windows 环境、运行时缺失及 `userdata/` 升级保护仍待验收**，因此尚非正式发布。详见 [`最终验收清单`](docs/RELEASE_ACCEPTANCE.md)。

## 主要功能

- **左侧预览、右侧编辑**：默认宽度 70% / 30%，可拖动分隔条调整，左右面板最小宽度 280 DIP（主窗口最小宽度 600 DIP）；卡片按宽度约束等比例显示并始终水平居中，Ctrl + 鼠标滚轮可在 20%–100% 范围内缩放；卡片宽度不会超过左栏可用宽度，内容仅纵向滚动。
- **编辑内容**：Article、Vocabulary、Useful Expressions、Main Idea、Translation。
- **自动分页**：保留现有按实际字体和行进行的分页逻辑；页面尺寸和排版样式可配置。英文使用内置 Nunito Sans（Latin / Latin Extended）；中文使用 Windows 系统字体回退。
- **本地文件**：使用 schemaVersion 5 的 JSON 项目格式，支持打开、保存和草稿。
- **导出全部 ZIP**：将每一页 PNG 和文章 JSON 打入一个 ZIP；JSON 使用 2 空格缩进的 UTF-8 Pretty JSON；导出进度采用可复用的 Win11 风格 WPF 对话框；不提供单页 PNG 导出入口。
- **便携式用户数据**：首次启动自动创建 EXE 同级的 `userdata/`；默认保存于该目录，也允许主动选择外部路径。

## 运行要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows x64 |
| .NET | [Microsoft .NET 10 Desktop Runtime (x64)](https://dotnet.microsoft.com/download/dotnet/10.0) |
| 页面引擎 | [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) |
| 中文字体 | Windows 系统字体：Microsoft YaHei UI、Microsoft YaHei、DengXian，最后回退 sans-serif |
| Node.js | **最终用户不需要**；只在开发、构建及部分测试时使用 |

本程序采用 **Framework-dependent** 发布，不附带 .NET Runtime。目标电脑必须已安装兼容的 .NET 10 Desktop Runtime x64；如缺失，Windows/.NET Host 会在程序代码启动前报告运行时缺失，请先从 [Microsoft .NET 10 下载页面](https://dotnet.microsoft.com/download/dotnet/10.0) 安装 **.NET Desktop Runtime 10 x64**，再重新启动。程序不增加 Native Launcher 或自定义 Runtime 下载器。

WebView2 使用 Evergreen Runtime。若 WebView2 缺失、损坏或初始化失败，EnglishCards 会显示中文说明，并询问是否打开 [Microsoft 官方 WebView2 Evergreen Runtime 页面](https://developer.microsoft.com/microsoft-edge/webview2/)；安装或修复后请重新启动程序。程序不需要独立安装 Chromium 或启动 Express 服务。

## 开发环境与首次构建

需要 **Windows x64、.NET 10 SDK、Node.js 22.12 或更高版本和 npm**。在项目根目录的 PowerShell 或 CMD 中执行：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run build
```

开发期的浏览器 E2E 使用 Playwright：

```bat
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright / Chromium **只用于开发测试**。部分现有测试仍涉及旧的 HTTP 测试服务，因此通过与否不等同于真实桌面 ZIP 导出验证；详见 [`docs/project-contract.md`](docs/project-contract.md) 与 [`docs/CODE_REVIEW_REPORT.md`](docs/CODE_REVIEW_REPORT.md)。

## 桌面发布

先生成 React 静态资源：

```bat
npm.cmd run build
```

再从项目根目录直接发布 WPF：

```bat
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf
```

发布目标为 `dist\wpf\EnglishCards.exe`；是否存在额外运行依赖文件，以实际 Windows 发布输出为准。也可使用可选的 `tools\publish.bat`。**不使用 PowerShell `.ps1` 作为默认发布入口。**

> 注意：React 源码通过 Vite 构建成 `artifacts/dist/`，随后嵌入 .NET 程序集。Nunito Sans 仅打包 Latin 与 Latin Extended 的 400/800 字重；中文不再打包 Noto Sans SC，依赖目标 Windows 上可用的 Microsoft YaHei UI / Microsoft YaHei / DengXian 系统字体及浏览器 sans-serif 回退。`artifacts/` 的前端构建产物和 `dist/` 的发布产物均不提交 Git。`render.html` 是桌面 ZIP 导出的渲染资源，请勿删除。

## 使用与用户数据

首次运行时，程序在 `EnglishCards.exe` 同级创建 `userdata/`：

```text
dist/
└── wpf/
    ├── EnglishCards.exe
    └── userdata/                    # 首次运行自动创建，不提交仓库
        ├── projects/                # 默认 JSON 项目目录
        ├── settings/settings.json   # 全局配置
        ├── drafts/draft.json        # 自动草稿
        ├── exports/                 # 默认 ZIP 导出位置
        ├── cache/ui/                # 嵌入式前端资源的版本化缓存
        ├── cache/WebView2/          # WebView2 用户数据
        ├── temp/
        └── logs/
```

**运行目录必须可写。** 缺少 `userdata/` 时程序自动创建；如无权限，会提示失败，不会擅自改用 LocalAppData。此次为破坏性升级，**不读取或迁移旧版 LocalAppData 数据**。用户仍可从外部目录打开 JSON 或主动另存。

重新执行 `dotnet publish` 时，**切勿为了清理旧产物直接删除含用户数据的整个 `dist/wpf/` 文件夹**。建议将正式使用的程序复制到独立于开发构建目录的可写目录，并在升级时备份 `userdata/`。

## 项目结构

```text
EnglishCards/
├── desktop/              # WPF 主程序、WebView2、文件存储和 ZIP 导出
├── src/
│   ├── models/           # JSON 模型与校验
│   ├── services/         # 分页、桌面桥接及文件服务
│   ├── viewmodels/       # 编辑状态管理
│   ├── views/            # React 编辑界面和预览
│   └── server/           # 仅供开发期 E2E 使用的测试 HTTP 服务
├── tests/                # Vitest 与 Playwright 测试
├── assets/               # 随仓库保留的样例及回归参考素材
├── tools/                # Vite、Playwright 和可选发布脚本
├── docs/                 # 项目契约、规格和实施状态
├── index.html
├── render.html
└── package-lock.json
```

## 质量与已知限制

- 单元测试、浏览器测试和真实 Windows 桌面验证是不同层级；不能用前两者代替 WPF 启动与导出验证。
- 现有历史测试与旧网页导出服务仍有部分耦合，相关失败应先区分测试预期变更与真实缺陷。
- WebView2 缺失或初始化失败的中文恢复入口已有桌面测试覆盖，但仍需在隔离 Windows 环境验证实际缺失 Runtime 的行为。现有单实例约束阻止同时使用同一数据目录；再次启动时是否自动激活已有窗口，需按实际发布程序验收，不在本轮宣称已实现。
- 正式设计及数据约束以 [`docs/project-contract.md`](docs/project-contract.md) 为准。

## Release Candidate 交付与验收

- [`docs/RELEASE_ACCEPTANCE.md`](docs/RELEASE_ACCEPTANCE.md)：最终发布门禁、Windows 独立环境测试与安全升级检查。
- [`docs/RELEASE_NOTES_RC.md`](docs/RELEASE_NOTES_RC.md)：本轮发布候选的功能、修复、体积变化与限制。
- [`docs/FINAL_REVIEW_SUMMARY.md`](docs/FINAL_REVIEW_SUMMARY.md)：七轮审查及字体精简的质量证据汇总。
- 当前 `package.json` 为 `1.0.0`，早期计划出现过 `v0.1.0`；**正式 Git 标签尚未确定或创建**。

## GitHub 首次推送

请先阅读 [`docs/GITHUB_SETUP.md`](docs/GITHUB_SETUP.md)。`.gitignore` 已排除 `node_modules/`、`dist/`、`artifacts/dist/`、.NET `bin/obj/`、Playwright 结果、`userdata/`、本地配置及常见密钥文件。**`package-lock.json`、源码和必要测试样本应该提交。**

公开仓库前，请人工检查 `assets/` 中的示例文章、图片及其他素材是否有公开分发权限；`.gitignore` 无法替你完成版权审核。

## 开发代理与代码审查

- 仓库工作入口见 [`AGENTS.md`](AGENTS.md)。
- Windows 桌面应用审查规范见 [`docs/skills/windows-app-review/SKILL.md`](docs/skills/windows-app-review/SKILL.md)。
- 桥接与导出契约见 [`docs/specs/EDITOR_BRIDGE_CONTRACT.md`](docs/specs/EDITOR_BRIDGE_CONTRACT.md) 和 [`docs/specs/EXPORT_CONTRACT.md`](docs/specs/EXPORT_CONTRACT.md)。
- 审查结论及整改计划见 [`docs/CODE_REVIEW_REPORT.md`](docs/CODE_REVIEW_REPORT.md) 和 [`docs/remediation-plan.md`](docs/remediation-plan.md)。
