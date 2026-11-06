# EnglishCards 项目契约（修订版 v1.2）

> 修订日期：2026-11-06。本文是 EnglishCards 当前确认的产品、架构、数据和验证契约。它区分**已实现现状**与**后续改造目标**；历史计划、原型和报告不能被当作当前已交付能力。新增约定：左侧预览 70%、右侧编辑与设置 55%，仅提供完整 ZIP 打包导出，所有程序产生的用户数据存放在 EXE 同级 `userdata/`，启动时目录不存在则自动创建。本次为**破坏性升级**：不检测、不迁移、不兼容旧版 `%LOCALAPPDATA%\EnglishCards\` 的用户数据。用户后续明确指示优先于本文。

## 1. 产品定位与范围

EnglishCards 是 Windows x64 本地英语精读卡片编辑器。正式产品只保留 Windows 桌面形态，不再提供独立网页版产品。

- 桌面技术：C# / WPF + WebView2 + React / TypeScript。
- React 编辑界面、数据模型、词汇/表达高亮和自动分页引擎是现有核心资产，原则上保留并渐进改造。
- WPF 负责 Windows 窗口、原生文件对话框、本地持久化、桌面桥接和最终 ZIP 导出。
- 两栏布局为左侧卡片预览（默认 45%）、右侧编辑与设置（默认 55%），分隔条可拖动；保留现有功能和交互。
- 正式导出仅提供“导出全部”入口，生成包含全部页面 PNG 与当前文章 JSON 的 ZIP；不保留单页 PNG 导出或逐页导出用户入口。
- 用户数据集中在可执行文件同级 `userdata/`；支持从外部路径导入 JSON，允许用户明确选择其他保存/导出路径。
- WebView2 负责承载 React 编辑器和本地卡片渲染页。
- 不采用 C++ Native Launcher、Tauri、Electron 或纯 WPF 重写。
- 正式运行不依赖 Node.js、npm、Express、Playwright 或独立 Chromium。Node/npm、Vite、Playwright 仅可作为开发、构建和测试工具。
- 不提供账号、云同步、远程 API 或在线文章处理；文章内容在本机处理。

## 2. 运行与交付契约

### 2.1 目标运行环境

| 项目 | 契约 |
|---|---|
| 操作系统 | Windows；正式目标架构 x64 |
| 桌面框架 | WPF |
| Target Framework | 当前项目为 `net10.0-windows` |
| 发布模式 | Framework-dependent，`--self-contained false` |
| .NET 依赖 | 目标电脑需要兼容的 x64 **.NET 10 Desktop Runtime**，不能只安装普通 .NET Runtime |
| WebView2 | Microsoft Edge WebView2 Evergreen Runtime |
| Web 内容 | 随桌面程序发布的本地静态资源，通过 WebView2 虚拟主机映射加载 |
| 首次联网 | 安装开发依赖和首次构建需要网络；目标电脑安装缺失运行依赖时需要按提示联网获取 |
| 日常运行 | Runtime 与 WebView2 已就绪后，编辑、预览、保存和导出应可离线进行 |

### 2.2 .NET Runtime 策略

- 保留 Framework-dependent 发布，不将 .NET Runtime 随应用自包含打包。
- 不开发独立 C++ 或其他 Native Launcher；不为本项目要求安装 Visual Studio C++ Desktop Development。
- 框架依赖的 WPF AppHost 在缺少兼容 .NET Desktop Runtime 时无法进入 WPF 代码，因此应用本身不能承担“Runtime 缺失时自动下载并部署 Runtime”的职责。
- 当前契约不实现自定义 .NET Runtime 自动下载器。目标电脑缺少 .NET 10 Desktop Runtime 时，提供明确的安装说明及 Microsoft 官方下载入口；安装完成后重新启动程序。
- 不要求不同电脑安装完全相同的 .NET 10 补丁版本；遵循 .NET 默认框架/补丁兼容策略，并在真实目标环境验证。
- 若未来重新提出“缺少 .NET 时由程序自动下载到应用目录”，这将改变启动和发布架构，必须单独评估并经用户确认，不得擅自增加启动器。

### 2.3 WebView2 Runtime 策略

- 使用 Microsoft WebView2 Evergreen Runtime，不随应用复制 Fixed Version Runtime。
- 程序启动时检查 WebView2 是否可用；缺失或初始化失败时，显示可理解的错误和 Microsoft 官方安装/修复入口。
- 不自行托管 WebView2 Runtime 更新；Evergreen 更新由 Microsoft 机制负责。
- WebView2 安装、修复提示不得要求用户安装 Node.js、Chromium 或 Playwright。
- WebView2 用户数据目录必须位于 EXE 同级 `userdata/cache/WebView2/` 下，不再默认放在 LocalAppData。创建 WebView2 环境前须确保该目录可用。

### 2.4 开发、构建与发布

- 开发工具：Node.js（满足 `package.json` engines）、npm、Vite、TypeScript、.NET 10 SDK、Windows x64 Desktop 开发环境。
- 不要求 C++ 编译器或 Visual Studio C++ 工作负载。
- 当前前端构建：`npm.cmd run build`。
- .NET 程序默认直接使用 `dotnet publish`；不将 PowerShell 脚本作为发布入口。
- 如需封装前端构建和发布步骤，优先使用 `tools/publish.bat`。
- 发布输出到 `dist/wpf/EnglishCards.exe`，采用 Framework-dependent + PublishSingleFile。React 资源在生成后嵌入程序集，运行时提取至 EXE 同级 `userdata/cache/ui/<模块版本>/`。
- 桌面发布命令的核心参数为 `-c Release -r win-x64 --self-contained false`。
- 发布前使用干净的暂存目录；不得把 Framework-dependent 输出覆盖到旧的 self-contained 发布目录。
- 本版本的数据布局按可写目录下的便携使用设计；默认安装位置、是否额外提供安装器和自动更新策略尚未锁定。安装/解压方案必须保证 EXE 同级 `userdata/` 可写；不得擅自引入自动更新、提权或将数据改写到 AppData。
- 发布目录不得包含 `node_modules`、Node.js、Express 服务端或 Playwright Chromium。

## 3. 架构与职责边界

### 3.1 React / TypeScript

保留现有前端及轻量分层：

- `src/models/`：数据结构、Zod 校验和纯业务规则。
- `src/viewmodels/`：编辑状态、撤销/重做和命令协调。
- `src/views/`：编辑界面、交互、焦点及预览挂载。
- `src/services/pagination.ts`：字体测量、逐行分页和页面片段。
- `src/services/projectIO.ts`：项目/草稿逻辑及前端到桌面桥接的调用。
- `src/services/desktopBridge.ts`：桌面宿主桥接。
- 不为套用架构而引入额外 MVVM 框架或无实际收益的抽象。

### 3.2 WPF / WebView2

WPF 负责：

- 主窗口生命周期与 Windows 原生交互。
- JSON 打开、保存对话框和文件读写。
- 用户设置、自动草稿和 WebView2 用户数据持久化。
- 与 React 之间的受控消息桥接。
- 正式“全部页面 ZIP 导出”及导出任务生命周期；PNG 是 ZIP 内的逐页图片，不提供单页 PNG 导出入口。
- Runtime / WebView2 缺失或初始化失败时的可理解提示。

React 只能通过明确列出的桌面桥接命令请求本地文件操作；不得获得任意本机文件系统、命令执行或任意 URL 导航权限。WPF 必须校验消息来源、命令名称、参数类型和数据格式。

### 3.3 本地资源与网络边界

- React 前端由 Vite 构建为静态文件，随 WPF 发布。
- WebView2 使用虚拟主机映射加载本地资源；当前实现映射到 `https://englishcards.invalid/`。
- 正式桌面程序不启动 Express，不监听 localhost 端口，不依赖外部浏览器。
- 限制 WebView2 导航和资源访问范围；拦截未知来源及未经授权的新窗口。
- 正式运行时不得从 Google Fonts、云 API 或其他远程服务获取文章内容、字体或业务数据；字体应由项目资源本地提供。

## 4. 必须保护的产品行为

### 4.1 编辑器

- 保留现有两栏编辑与预览工作流，但**左右栏交换**：左侧卡片实时预览，右侧文章编辑、词汇、表达和样式设置。默认宽度：左侧 45%、右侧 55%，以内容区可用宽度为基准。
- 保留用户可拖动的分隔条；左右面板独立滚动，窗口变化时适当保持可用最小宽度，默认比例不是强制固定宽度。
- 预览点击对应内容时，应正确定位右栏编辑项；改变 DOM 布局不得改变编辑状态、分页、缩放和键盘导航语义。
- 保留原文、Vocabulary、Useful Expressions、Main Idea、Translation 的编辑能力。
- 保留词汇/表达条目管理、多义项编辑、手工高亮规则、预览定位和样式设置。
- 保留当前撤销/重做行为及草稿恢复规则。
- 不将预览改成直接编辑画布；预览点击用于定位相应编辑字段。
- 不擅自改变已确认的界面交互、字段含义、默认样式和排版规则。

### 4.2 分页与渲染

- `src/services/pagination.ts` 是现有权威分页实现；未经确认不得重写或以 CSS `break-inside` 等简化逻辑替代。
- 分页按实际字体度量和可见行边界进行；逻辑内容可以在行边界跨页，不能吞字、重复、截断或强制整条内容迁页。
- 首行缩进只作用于逻辑段落首行；续行及跨页续行不重复缩进。
- 词汇保持双栏，按每行左到右的顺序读取。
- 页面画布默认 1200×1600；输出尺寸必须按配置的实际画布尺寸。
- 预览和导出使用同一套项目数据、字体、分页规则和渲染代码。
- 字体未就绪、项目/分页签名不一致或几何校验失败时，不得导出错误排版。
- 预览缩放不得影响导出尺寸。
- 不设固定页数上限，不通过删减内容填满页面。

### 4.3 桌面导出

- **唯一正式导出形态**为“导出全部”：将当前文章全部页面的 PNG 和当次项目 JSON 打包为一个 ZIP 文件。
- 不提供“单页导出”“当前页导出”“单独导出所有 PNG”或其他独立 PNG 导出用户入口；底层逐页 PNG 渲染和截图能力继续保留，专供 ZIP 组装及开发验证使用。
- ZIP 建议结构：根目录 `article.json` 和 `images/page-001.png`、`images/page-002.png`……；编号按页面顺序、宽度至少三位并能覆盖实际总页数。
- 默认输出目录为 `userdata/exports/`，默认 ZIP 文件名从文章标题安全规范化得到；允许用户通过文件对话框明确选择其他合法目录或文件名。
- 导出使用用户点击时固定的项目与配置快照；导出期间继续编辑不得改变正在生成的任务。
- 导出先写入任务专属临时目录（默认位于 `userdata/temp/`）；完成后验证 PNG 尺寸、页数、内容/分页签名和 ZIP 完整性，再提交正式目标。若输出目标位于外部目录，则最终提交应在目标目录使用同卷临时文件/安全替换，以避免跨卷移动导致原子性丧失。
- 失败、取消或进程异常不得破坏已有目标文件。
- 取消、窗口关闭和资源释放顺序按长任务模式设计；不能在仍有截图或压缩进程使用文件时提前删除临时文件。
- **现状说明：** 旧版 `CardCapture.cs` 与 `PrototypeVerification.cs` 是截图/验证原型；现已增加 `ZipExportService.cs` 作为完整 ZIP 导出的初步实现，但还未在 Windows 实机验证，不得视为已经验收。不得将原型或网页版 PNG 导出报告成已交付的正式桌面功能。

## 5. 数据、设置与文件归属

### 5.1 文章项目

- 当前唯一接受的数据格式为 `schemaVersion: 5`。
- 数据结构权威来源：`src/models/project.ts` 及项目内文章转 JSON skill。
- Vocabulary / Useful Expressions 使用 `senses` 列表保存每个义项的 `pos`、`meaning`、`example`、`exampleTranslation`。
- 高亮规则由各词汇/表达条目的 `highlight: string[]` 管理；不保存顶层运行时命中坐标或顶层 `highlights`。
- 当前程序不支持 schema 1–4 自动迁移；旧格式必须按当前 skill 重新生成 schema 5 JSON。拒绝旧格式时不得覆盖原文件。
- JSON 是可移植的权威项目文件。新建/另存时默认目录为 `userdata/projects/`；用户可以从任意合法目录打开 JSON，也可以明确选择其他目录保存或导出。
- 默认位置不应强制重定位用户已打开的外部文件：用户对已打开文件执行“保存”时遵循已确认的当前文件路径；“另存为”允许重新选择位置。外部数据不应在未授权时被移动、删除或覆盖。
- 导出 ZIP 附带本次导出的项目 JSON；全局样式不写入文章 JSON。

### 5.2 用户数据及启动时目录创建（已确认目标）

- **数据根目录固定为可执行文件实际所在目录下的 `userdata/`**，即 `<ExeDirectory>/userdata/`。目录解析必须以真实 EXE 路径为依据，不使用当前工作目录、快捷方式所在目录或源码目录。
- **每次双击启动可执行文件后，在任何需要写入用户数据或初始化 WebView2 Profile 的操作之前，检查 `userdata/` 是否存在；若不存在，自动创建**。存在时直接复用，绝不为正常启动清空或重建。
- 根目录创建采用幂等操作；必要子目录允许按需自动创建。首次启动时既不要求用户手动建立文件夹，也不要求运行一段单独的初始化脚本。
- 若 `userdata/` 同名路径是普通文件、目录不可写、权限不足或创建失败，必须显示明确错误并安全停止需要持久化数据的启动流程；不得静默退回 `%LOCALAPPDATA%`、`%APPDATA%`、临时目录或其他位置，也不自动提权。
- 不在缺少兼容 .NET Desktop Runtime 时保证上述检查会运行：Framework-dependent 主程序必须在 .NET 加载成功后才能执行 WPF 启动初始化。Runtime 缺失依照第 2.2 节安装指引处理。
- **首次启动默认结构**（子目录按需建立；WebView2 Profile 可能包含运行时自动创建的内部文件）：

```text
<ExeDirectory>/
├── EnglishCards.exe
├── ...程序二进制文件与 WebContent...
└── userdata/
    ├── projects/             # 新建项目默认保存目录
    ├── drafts/               # 自动草稿
    ├── settings/             # 应用设置与窗口布局
    ├── exports/              # ZIP 默认导出位置
    ├── cache/
    │   └── WebView2/         # WebView2 用户数据 / Profile
    ├── temp/                 # 导出、保存等任务临时数据
    └── logs/                 # 运行日志
```

- 统一通过一个可测试的 `UserDataPathProvider`（或等价单一组件）管理路径，避免各业务模块硬编码绝对路径。既有 `UserDataStore` 应逐步调整路径实现，不重写无关的原子写入逻辑。
- 实例锁等运行状态文件也应保存在 `userdata/` 内（例如 `userdata/.instance.lock`），并保证重复启动检测不会误删或覆盖用户文件。
- 程序目录应可写；在 `Program Files` 等受限目录下不可写时，提示用户移至可写位置，不自动改变数据位置。
- 用户把整个程序目录复制或移动至其他可写位置时，程序应使用新 EXE 目录中的 `userdata/`，不依赖旧目录的绝对路径。复制前应退出程序并释放 WebView2 Profile 等文件句柄。
- 发布/更新/解压操作**不得覆盖、清理或删除 `userdata/`**；应明确隔离产物目录与用户数据目录，发布脚本不可将干净构建逻辑应用到真实用户数据目录。
- **破坏性升级约定**：新版只使用 EXE 同级 `userdata/`。不检测、不读取、不复制、不合并、不提示迁移旧版 `%LOCALAPPDATA%\EnglishCards\` 下的设置、草稿、缓存或 WebView2 Profile；新版也不主动清理或删除旧目录。`userdata/` 不存在时按全新用户初始化；旧项目若需使用，由用户自行从明确选择的外部路径打开。

### 5.3 保存与损坏保护

- 用户数据写入使用同目录临时文件，完成后再替换目标。
- 更新持久状态前必须确认写入成功。
- 对损坏或不兼容草稿，优先保留原始内容并隔离备份；不得静默覆盖。
- 保存失败应给出明确反馈，并允许用户修正后重试。
- JSON 文件写入失败不得损坏已有目标文件。
- 设置损坏时不得未经用户明确操作就覆盖原文件。
- 文章文件、全局设置、自动草稿、缓存和 WebView2 Profile 的归属必须保持分离。

## 6. 单实例与窗口生命周期

- 目标行为：同一用户会话只允许一个 EnglishCards 主实例。
- 再次启动时应激活现有窗口，而不是创建第二个编辑器窗口。
- 当前代码使用 `%LOCALAPPDATA%\EnglishCards\.instance.lock` 文件租约检测重复实例，并在重复时提示“已经在运行”；尚未实现将已有窗口前置激活。这是**现状**而非目标。目标为使用 `userdata/` 下的运行状态并激活已有窗口；检测/激活策略需要避免数据目录创建与单实例竞争。
- 关闭窗口前等待前端文件操作和待保存状态完成；无法确认保存成功时，应允许用户取消关闭并保留编辑，或明确确认放弃。
- 释放 WebView2、实例租约、事件订阅及其他资源。
- 当前尚未约定托盘驻留、最小化隐藏、开机启动；不得擅自加入。

## 7. 当前代码入口与实际状态

| 路径 | 当前职责/状态 |
|---|---|
| `desktop/EnglishCards.csproj` | WPF 项目；`net10.0-windows`、WebView2 NuGet 包 |
| `desktop/App.xaml.cs` | WPF 入口、窗口初始化和验证参数 |
| `desktop/MainWindow.xaml(.cs)` | 主窗口、WebView2 初始化、关闭前保存协调 |
| `desktop/Web/LocalWebContent.cs` | WebView2 本地虚拟主机映射、导航限制及脚本执行 |
| `desktop/Web/EditorBridge.cs` | JSON 打开/保存、设置和草稿的宿主消息桥接 |
| `desktop/Persistence/UserDataStore.cs` | 现用 EXE 同级 userdata、原子写入、实例租约和损坏草稿备份 |
| `desktop/Export/CardCapture.cs` | 单页 PNG 截图原型 |
| `desktop/Export/PrototypeVerification.cs` | 桌面渲染验证原型 |
| `tools/publish.bat` | 可选的批处理发布封装；默认优先直接执行 `dotnet publish` |
| `tools/test-desktop.ps1` | 当前桌面原型验证脚本 |
| `tools/vite.config.ts` | React 与 `render.html` 静态资源构建 |
| `tools/playwright.config.ts` | 开发期浏览器 E2E 配置 |
| `src/server/index.ts` | 当前仍存在的 Express/Chromium 网页服务；正式桌面产品取消该运行形态后不再作为桌面运行依赖 |
| `render.html` | 本地卡片渲染入口；应保留供桌面导出使用，不是独立网页版产品入口 |

当前工作副本已接入编辑、预览、原生 JSON、设置、草稿及新增 ZIP 导出实现，并改为 EXE 同级 `userdata/` 自动创建；上述新增行为尚未在 Windows 环境运行验收。安装包尚未完成。当前 README 中仍包含网页版运行说明，后续产品化改造时应更新；不得将历史网页测试能力误当成正式产品要求。

## 8. 构建、测试与验证

### 8.1 开发与构建命令

在 Windows 终端、仓库根目录执行：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -o dist\wpf
```

如需将前端构建和发布步骤封装为单条命令，可执行 `tools\publish-desktop.bat`；不使用 `.ps1` 作为发布入口。

说明：

- `npm.cmd ci` 安装前端开发/测试依赖；只在开发机器执行。
- `npm.cmd test` 运行 Vitest 单元测试。
- `npm.cmd run test:e2e` 使用 Playwright 启动本地开发服务并运行浏览器回归；这是开发验证，不代表正式桌面程序需要 Express/Chromium。
- `npm.cmd run build` 执行 TypeScript 检查及 Vite 生产构建，输出 `artifacts/dist/`。
- 默认先执行 `npm.cmd run build`，再直接运行 `dotnet publish ... --self-contained false`；可选 `tools/publish.bat` 封装这两个步骤。
- `./tools/test-desktop.ps1` 在发布目录存在时运行当前桌面截图验证原型；不能代替正式导出验收。
- 正式桌面导出通过 WPF 桌面界面执行；浏览器 E2E 测试不得将旧 Express `/api/export` 当作正式桌面 ZIP 导出实现。

### 8.2 按改动范围选择验证

- Model、JSON、Schema 或高亮规则：运行相关 Vitest，并验证 schema 5 有效/无效输入、损坏输入及原文件保护。
- 分页、字体、样式或渲染：运行分页相关单元/E2E；必须使用代表性长文本、跨页、中文、组合字符和字体冷启动样本。
- React 与 WPF 桥接：验证消息来源、非法命令/参数、文件对话框取消、读写失败、导航切换及旧异步响应隔离。
- WPF 生命周期：验证启动、重复启动、关闭前保存、保存失败取消关闭、进程异常及资源释放。
- 布局：验证左侧预览/右侧编辑的 45%/55% 默认比例、拖拽分隔条、窗口缩放、独立滚动和预览跳转右栏。
- 导出：唯一用户入口为“导出全部 ZIP”；同一输入走预览和真实桌面导出，比较页数、每页 PNG 尺寸、内容完整性和分页签名；检查 ZIP 内所有 PNG 与 JSON，验证没有单页导出入口。
- 用户数据：从不存在 `userdata/` 的可写目录首次启动时自动创建；再次启动不清空；验证根路径与 EXE 同级、只读目录失败提示、外部保存、无旧 AppData 迁移行为及发布覆盖保护。
- 发布：验证真实 `dist/wpf/` 交付物、.NET 10 Desktop Runtime x64 和 WebView2 Evergreen 依赖提示、无 Node/Express/Playwright 运行依赖；将产物复制到可写目录双击启动，验证 EXE 同级 `userdata/` 自动创建和用户数据保护。

### 8.3 验证证据分层

报告必须区分：

1. **核心测试**：数据模型、校验、分页规则、序列化和失败边界。
2. **集成测试**：React/WPF 消息桥接、文件 IO、WebView2 资源加载。
3. **真实桌面测试**：Windows x64、真实 WebView2 Evergreen、DPI/窗口缩放、文件对话框及生命周期。
4. **交付物测试**：实际发布目录在目标 Windows 环境启动，缺少依赖时给出可执行的安装指引，用户数据不因升级丢失，最终 ZIP 内的 PNG 和 JSON 均为真实可打开产物。

不得将历史报告中的通过结果描述为本轮重新执行。报告必须标明通过、失败、跳过和未验证。

## 9. 已知差距与待确认事项

以下是当前事实，不得假定已经实现：

1. 独立网页版和 Express 服务目前仍在仓库中；正式产品目标是取消网页版形态，清理时须保留开发测试所需的最小工具。
2. 桌面版“导出全部 ZIP”尚未完成；现有 `CardCapture` 和验证代码是原型；单页导出不再是正式产品需求。
3. WebView2 缺失时的友好检测、官方安装引导和修复流程尚需完善。
4. 当前重复实例检测会提示已运行，但尚未将已有主窗口激活。
5. 当前桌面标题仍含“桌面 PNG 原型”字样，需在正式产品化时调整。
6. 当前 README 混合了桌面版和网页版说明，需按正式产品定位重写。
7. 以可写目录中的便携数据布局作为当前开发目标；是否另提供安装包、默认安装位置、自动更新策略尚未最终确认，不得擅自决定。
8. 是否支持托盘、最小化隐藏和开机启动尚未确认。
9. 目标 Windows 最低版本及具体实机测试矩阵尚需最终确定。
10. .NET Runtime 缺失时不做自定义自动下载；如需改变该策略，必须重新评估启动前依赖问题并经用户确认。
11. 两栏位置互换、45%/55% 默认比例与右侧编辑交互尚待实现和实测。
12. 目标 `userdata/` 数据目录、首次启动自动创建、WebView2 Profile 路径切换尚待实现和验证；本次为破坏性升级，不实施旧数据复制或迁移。
13. 仅保留“导出全部 ZIP”用户入口，单页导出及独立 PNG 输出不属于最终正式产品。

## 10. 变更原则

- 用户本轮明确指示优先于本契约。
- 改动前先检查相关规格、调用方、测试和当前工作区状态。
- 对已有成熟分页、数据和编辑逻辑采取最小改动，不以“重构”为由整体重写。
- 已确认的 `userdata/` 数据位置、左预览右编辑、45%/55% 默认比例和仅完整 ZIP 导出不可擅自改变。后续改变 schema、用户数据位置、运行时发布方式、安装/更新方式或主交互，必须先说明影响并取得确认。
- 不增加 C++ Launcher、Electron、Tauri、额外 MVVM 框架或其他非必要依赖。
- 不删除仍承担开发测试、数据验证或历史追溯作用的文件，除非确认无用且获得授权。旧版 LocalAppData 数据虽然不再读取，也不得由新版自动删除。
- 不提交、不推送、不覆盖用户文件，除非用户明确授权。
- 任何未实际运行的测试必须标记为未验证；不得编造测试结果。

## 11. 本次修订与落实顺序

1. **阶段 0：只读基线审查**。记录当前桌面启动、布局、LocalAppData 读写、网页导出依赖和测试结果。
2. **阶段 1：桌面化与便携数据**。取消独立网页版产品入口；实现左预览 45% / 右编辑 55% 及分隔条；在 WPF 初始化用户数据前检查/创建 EXE 同级 `userdata/`；将设置、草稿、WebView2 Profile 路径和实例锁的读写位置改为 `userdata/`（不迁移旧数据）；完善外部 JSON 的保存/另存行为。
3. **阶段 2：完整 ZIP 导出**。仅实现“导出全部”用户入口，保留内部逐页 PNG 渲染，组合全部图片及当次文章 JSON；加入进度、取消、完整性校验与失败清理；完善单实例激活及关闭时数据安全。
4. **阶段 3：清理与发布**。移除正式网页版及无用生产依赖，但保留必要开发测试能力；验证 Framework-dependent x64、WebView2 Evergreen、无 Node 运行依赖，以及解压后首次自动创建 `userdata/` 和更新不删数据。

本契约是规划与验收依据，不代表以上目标已经完成。


## 当前确认的桌面单文件交付与样式布局（2026-11-06）

本节为最新确认约定，优先于上方未同步的历史描述：

- 项目文件：`desktop/EnglishCards.csproj`；程序集、根命名空间和 EXE 均为 `EnglishCards`。
- 开发机先执行 `npm.cmd run build`，再直接执行 `dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf`。可选 `tools\publish.bat`。
- .NET 10 Framework-dependent，WebView2 Evergreen；无需 C++、Node.js 或 Chromium 浏览器运行时。
- React 的 `index.html`、`render.html`、JS、CSS 和字体嵌入 EXE；启动时按模块版本提取到 `userdata/cache/ui/` 后进行虚拟主机映射。
- 主窗口默认左侧预览 70%、右侧编辑 30%；分隔条仍可自由拖动，切换 Tab/文章不重置比例。
- “样式”两表格第二列（单元格及输入控件）全部水平居中。提示位于第二表格底部约 20 DIP，下面单行居中的“默认配置”“导入配置”按钮各宽 80 DIP、间距 20 DIP。
- 仅保留所有页面 ZIP 打包导出；`userdata/` 由程序启动时自动创建，破坏性升级不迁移 LocalAppData。
- 保留必要测试服务作为开发期 E2E 基础设施，不把 Express 服务端、Node.js、Playwright 或外置浏览器打入正式发布。
