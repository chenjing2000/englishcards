# EnglishCards 项目契约

> 本文记录当前确认的产品行为和技术边界。基线为用户提供的 `EnglishCards.zip`（2026-11-06）及此前用户在 Windows 上报告的实机验收结果。该源码 ZIP 不含 `.git` 元数据，无法据此确认当前分支、提交或工作区状态。旧计划和原型报告只用于追溯，不覆盖本契约。

## 1. 产品定位

EnglishCards 是 Windows x64 本地英语精读卡片编辑器，正式产品只提供桌面版，采用 **WPF + WebView2 + React/TypeScript**。

- React 负责编辑界面、文章状态、样式设置、分页和预览。
- WPF 负责 Windows 窗口、原生文件对话框、用户数据持久化、WebView2 宿主和正式 ZIP 导出。
- 不迁移到 Tauri、Electron 或纯 WPF；不增加 C++ Native Launcher。
- 不引入重量级 MVVM、DI 或事件总线框架。
- Node.js/npm、Express、Vite、TypeScript、Playwright/Chromium 仅用于开发、构建和测试，不属于最终用户运行依赖。
- 不提供账号、云同步或在线文章处理。

## 2. 已确认产品行为

### 编辑与预览

- 左侧为卡片预览，右侧为文章编辑与设置。
- 初始宽度比例左 70%、右 30%；分隔条可拖动，不是固定宽度；左右面板最小宽度均为 280 DIP，WPF 主窗口最小宽度为 600 DIP。
- 预览卡片原始尺寸与分页/导出尺寸不变；卡片仅受左侧预览区可用宽度约束，按原始宽高比等比例缩放。预览区高度不参与缩放计算，卡片超出预览区高度时仅纵向滚动。
- 卡片显示宽度不得超过预览区扣除左右各 8 DIP 内边距后的可用宽度；显示比例上限为 100%。实际比例为用户当前要求比例与可用宽度比例两者中的较小值。
- Ctrl + 鼠标滚轮缩放，用户要求比例限制为 20%–100%；不需要按下鼠标中键。删除缩放比例浮窗、比例标签和重置按钮。
- 当预览区变窄导致当前比例超过可用宽度上限时，将当前比例永久下调至该上限；之后即使预览区变宽，也保持下调后的比例，不自动恢复之前的比例。用户可以再次使用 Ctrl + 滚轮放大。
- 卡片始终水平居中，不出现水平滚动条，不得被分隔条遮挡；多张卡片纵向排列，间距固定。
- 预览缩放只影响显示，不得改变分页计算、卡片原始尺寸或 PNG/ZIP 导出结果。
- 保留 Article、Vocabulary、Useful Expressions、Main Idea、Translation 编辑能力，以及现有词汇/表达管理、样式设置、预览定位和撤销/重做行为。
- 预览用于查看和定位，不替代右侧编辑器。

### 分页与渲染

- `src/services/pagination.ts` 是当前分页实现入口；修改前检查其调用方以及预览/导出共用关系。
- 预览和导出必须基于同一文章快照、字体回退顺序、分页规则和渲染入口。
- 英文内置 Nunito Sans，仅包含 Latin / Latin Extended 的 400 与 800 字重；不打包 Cyrillic、Cyrillic Extended、Vietnamese 子集。
- 中文不打包 Noto Sans SC，按 `Microsoft YaHei UI`, `Microsoft YaHei`, `DengXian`, `sans-serif` 顺序使用目标 Windows / WebView2 可用字体。系统字体可能因 Windows 版本和语言组件不同而存在度量差异；发布验收必须在目标中文 Windows 环境检查分页、预览和 PNG 导出。
- 默认画布 1200×1600，实际输出尺寸遵循项目样式设置。
- 字体未就绪或分页/渲染校验失败时，不得提交错误导出。

### 正式导出

- 唯一用户导出入口为**导出全部 ZIP**，不提供单页 PNG 或 PNG-only 导出。
- ZIP 包含根目录 `article.json` 和 `images/page-001.png` 等全部页面图片。
- `article.json` 为 UTF-8 无 BOM、2 空格缩进、中文不转义、末尾换行；格式化不得改变 Schema 5 数据。
- 导出进度窗口为可复用 WPF `ProgressDialog`，采用 Win11 风格。取消按钮文字“取消”，48×32 DIP；标题栏关闭按钮执行同一取消流程。
- 取消时显示“正在取消……”，禁用重复操作，等待渲染/写入停止并清理本任务临时 ZIP；不得损坏已有 ZIP。
- 用户已报告 Windows 实机验收：ZIP 内容正常、Pretty JSON 可读、Win11 风格窗口正常；取消按钮或标题栏关闭可停止导出、清理临时 ZIP、保护已有 ZIP。该结果是用户报告的验收证据，不是本轮重新执行。

详细导出约定见 [`specs/EXPORT_CONTRACT.md`](specs/EXPORT_CONTRACT.md)。

## 3. 运行环境与发布

| 项目 | 当前约定 |
|---|---|
| 操作系统/架构 | Windows x64 |
| 桌面框架 | .NET 10 WPF |
| 发布模式 | Framework-dependent、单文件、win-x64 |
| .NET 运行依赖 | 兼容的 .NET 10 Desktop Runtime x64 |
| WebView2 | Microsoft Edge WebView2 Evergreen Runtime |
| 前端资源 | Vite 构建后嵌入程序集，运行时提取到 `userdata/cache/ui/<模块版本>/` |
| Node.js | 最终用户不需要 |
| Express/Playwright/Chromium | 最终用户不需要 |

### 缺少 .NET Desktop Runtime

- 保持 Framework-dependent 发布，不随应用打包 .NET Runtime。
- 目标机缺少兼容的 .NET 10 Desktop Runtime x64 时，用户需通过 Microsoft 官方入口安装后重新启动。
- 不实现自定义 Runtime 下载器，不增加 Native Launcher。
- WPF 代码在 .NET Host 未启动前无法自行显示提示；因此 README 必须明确运行先决条件。若要定制启动前提示，须单独评估并取得确认。

### WebView2

- 使用 Evergreen Runtime，不随应用打包 Fixed Version Runtime。
- WebView2 缺失或初始化失败时，应提供可理解的错误及 Microsoft 官方安装/修复入口。
- WebView2 Profile 位于 `userdata/cache/WebView2/`。

### 构建与发布命令

```bat
npm.cmd ci
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
dotnet run --project desktop\EnglishCards.Tests\EnglishCards.Tests.csproj -c Release
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf
```

可选封装：`tools\publish.bat`。默认优先直接 `dotnet publish`；不以 `.ps1` 作为发布入口。Playwright E2E 是开发测试，不替代真实 WPF/WebView2 验收。

## 4. 用户数据与文件保护

- 数据根目录为真实 EXE 所在目录同级 `userdata/`，不是当前工作目录、快捷方式目录或 LocalAppData。
- 首次启动自动创建；目录不可写或创建失败时明确报错，不静默回退到其他位置。
- 不读取、不迁移、不合并、不提示迁移旧版 `%LOCALAPPDATA%\EnglishCards\` 数据；新版也不主动删除旧目录。
- 典型目录：

```text
userdata/
├── projects/
├── drafts/
├── settings/
├── exports/
├── cache/
│   ├── ui/
│   └── WebView2/
├── temp/
└── logs/
```

- 外部 JSON 可由用户明确打开；保存/另存遵循用户选择的路径。
- 保存失败不得静默覆盖或丢弃原始数据。
- 发布/更新不得清理 `userdata/`；发布脚本只处理应用产物。
- 用户数据不纳入源码包、Git 提交或 GitHub Release。

## 5. 架构职责

### React / TypeScript

- `src/models/`：文章/设置结构、Zod 校验及纯业务规则。
- `src/viewmodels/`：编辑状态、命令协调、撤销/重做。
- `src/views/`：界面、交互、焦点和预览挂载。
- `src/services/pagination.ts`：分页与布局计算。
- `src/services/projectIO.ts`：项目/草稿交互与桌面调用。
- `src/services/desktopBridge.ts`：WebView2 桥接客户端。
- `src/server/`：开发测试服务，不是正式桌面运行入口。

### WPF / WebView2

- `desktop/MainWindow.xaml(.cs)`：主窗口和生命周期。
- `desktop/Web/LocalWebContent.cs`：本地虚拟主机、导航边界和 WebView2 加载。
- `desktop/Web/EditorBridge.cs`：受控命令桥接。
- `desktop/Persistence/UserDataStore.cs`：用户数据、原子写入、实例租约及拒绝数据保护。
- `desktop/Export/ZipExportService.cs`：完整 ZIP 导出任务。
- `desktop/Export/CardCapture.cs`：ZIP 内逐页 PNG 截图。
- `desktop/Export/ArticleJsonFormatter.cs`：可读 JSON 序列化。
- `desktop/UI/Dialogs/ProgressDialog.xaml(.cs)`：可复用进度对话框。

桥接细节见 [`specs/EDITOR_BRIDGE_CONTRACT.md`](specs/EDITOR_BRIDGE_CONTRACT.md)。

## 6. 验证证据

用户此前报告：Vitest 35/35、Playwright E2E 58/58、.NET 桌面测试 9/9、Windows x64 发布成功，以及 ZIP/Pretty JSON/Win11 进度窗口/取消行为实机验收通过。以上是历史用户报告结果；必须在最终源码上重新执行后，才能作为该最终提交的发布证据。

本轮审查未在 Windows 上重新运行测试或发布。报告必须区分通过、失败、跳过和未验证。

## 7. 变更原则

- 用户当前明确指示优先于本文。
- 修改前检查调用方、规格、测试和失败路径；优先最小修正。
- 不擅自改变 Schema、用户数据位置、运行时策略、主交互或 ZIP 语义。
- 不增加 Native Launcher、Tauri、Electron 或重量级 MVVM 框架。
- 不删除仍承担测试、数据验证、样例或历史追溯作用的文件。
- 不提交、推送、打标签或修改远程仓库，除非用户明确授权。
- 未运行的测试必须标记为未验证。

## 8. 当前待审查事项

- WebView2 Evergreen 缺失/初始化失败时的实际提示。
- `EditorBridge` 异步事件异常边界、消息顺序和导航切换竞态。
- `UserDataStore` 原子替换、备份冲突和失败恢复边界。
- ZIP 导出取消、校验、提交竞态及异常清理。
- 发布脚本对已有 `dist/wpf/userdata` 的保护。
- 历史网页导出测试与正式桌面 ZIP 的职责隔离。
- 源码归档含 `desktop/bin/`、`desktop/obj/`、`artifacts/dist/` 等构建产物；正式源码归档应排除这些目录。
