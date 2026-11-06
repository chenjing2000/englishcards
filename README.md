# EnglishCards

**EnglishCards** 是面向 Windows x64 的本地英语精读卡片编辑器。使用 **WPF (.NET 10) + WebView2 + React/TypeScript**，支持文章编辑、词汇与表达管理、卡片自动分页、实时预览、JSON 项目保存，以及将**全部卡片图片和项目 JSON 打包为 ZIP**。

> **项目状态：Windows 桌面版候选发布。** 用户已报告完成 ZIP 导出、JSON 可读性、Win11 进度窗口及取消行为的 Windows 实机验收。发布前仍须对最终源码重新运行完整测试与发布检查；历史验收结果不自动代表后续源码版本。

## 主要功能

- **左侧预览、右侧编辑**：默认宽度 70% / 30%，可拖动分隔条调整。
- **编辑内容**：Article、Vocabulary、Useful Expressions、Main Idea、Translation。
- **自动分页**：保留现有按实际字体和行进行的分页逻辑；页面尺寸和排版样式可配置。
- **本地文件**：使用 schemaVersion 5 的 JSON 项目格式，支持打开、保存和草稿。
- **导出全部 ZIP**：将每一页 PNG 和文章 JSON 打入一个 ZIP；JSON 使用 2 空格缩进的 UTF-8 Pretty JSON；导出进度采用可复用的 Win11 风格 WPF 对话框；不提供单页 PNG 导出入口。
- **便携式用户数据**：首次启动自动创建 EXE 同级的 `userdata/`；默认保存于该目录，也允许主动选择外部路径。

## 运行要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows x64 |
| .NET | [Microsoft .NET 10 Desktop Runtime (x64)](https://dotnet.microsoft.com/download/dotnet/10.0) |
| 页面引擎 | [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) |
| Node.js | **最终用户不需要**；只在开发、构建及部分测试时使用 |

本程序采用 **Framework-dependent** 发布，不附带 .NET Runtime。目标电脑必须已安装兼容的 .NET 10 Desktop Runtime；如缺失，请先按微软官方说明安装。WebView2 使用 Evergreen Runtime。程序不需要 C++ Native Launcher，也不需要独立安装 Chromium 或启动 Express 服务。

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

> 注意：React 源码通过 Vite 构建成 `artifacts/dist/`，随后嵌入 .NET 程序集。`artifacts/` 的前端构建产物和 `dist/` 的发布产物均不提交 Git。`render.html` 是桌面 ZIP 导出的渲染资源，请勿删除。

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
- 单实例激活已有窗口、WebView2 缺失时的友好安装引导尚待完善。最新说明见 [`docs/implementation-status.md`](docs/implementation-status.md)。
- 正式设计及数据约束以 [`docs/project-contract.md`](docs/project-contract.md) 为准。

## GitHub 首次推送

请先阅读 [`docs/GITHUB_SETUP.md`](docs/GITHUB_SETUP.md)。`.gitignore` 已排除 `node_modules/`、`dist/`、`artifacts/dist/`、.NET `bin/obj/`、Playwright 结果、`userdata/`、本地配置及常见密钥文件。**`package-lock.json`、源码和必要测试样本应该提交。**

公开仓库前，请人工检查 `assets/` 中的示例文章、图片及其他素材是否有公开分发权限；`.gitignore` 无法替你完成版权审核。

## 开发代理与代码审查

- 仓库工作入口见 [`AGENTS.md`](AGENTS.md)。
- Windows 桌面应用审查规范见 [`docs/skills/windows-app-review/SKILL.md`](docs/skills/windows-app-review/SKILL.md)。
- 桥接与导出契约见 [`docs/specs/EDITOR_BRIDGE_CONTRACT.md`](docs/specs/EDITOR_BRIDGE_CONTRACT.md) 和 [`docs/specs/EXPORT_CONTRACT.md`](docs/specs/EXPORT_CONTRACT.md)。
- 审查结论及整改计划见 [`docs/CODE_REVIEW_REPORT.md`](docs/CODE_REVIEW_REPORT.md) 和 [`docs/remediation-plan.md`](docs/remediation-plan.md)。
