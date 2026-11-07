> **历史记录：** 本文记录较早的实施阶段，可能包含旧目录、schemaVersion 5 或旧发布路径。当前有效目录、Article v6 契约和实施状态以 [`docs/project-contract.md`](../../project-contract.md) 与 [`docs/implementation-status.md`](../../implementation-status.md) 为准。

# EnglishCards WPF + WebView2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 发布可断网安装、双击启动并完整导出阅读卡片的 Windows 桌面版。

**Architecture:** WPF 主窗口内托管编辑 WebView2，保留现有 React/TypeScript MVVM。窄范围 JSON 消息替代正式版的 HTTP 与浏览器下载；独立导出 WebView2 复用分页器，WPF 负责截图和打包。

**Tech Stack:** .NET 10 WPF、WebView2 SDK、React/TypeScript/Vite、System.IO.Compression、Inno Setup。开发机已确认安装 .NET SDK 10.0.403；发布用 net10.0-windows / win-x64，依赖系统的 x64 .NET 10 Desktop Runtime。实施时将验证用 WebView2 SDK 和安装器版本锁入项目和发布说明。下文的自包含实测是原型历史记录。

**Spec:** [桌面版设计](../../specs/DESKTOP_WEBVIEW2.md)。

## 全局约束

- 保留 schema 5、现有编辑与排版行为及校验；不双写编辑状态和数据规则。
- 网页版保留为原型对照和回归入口，直至桌面正式包通过验收。Node.js、Express、Playwright 不进入桌面发布包。
- 用户目录和发布目录分离。原型使用隔离数据目录，不读取或覆盖真实设置与浏览器草稿。
- 每个任务验收通过后独立提交。按后续确认，原型已有本机实际 150% 证据，可先执行任务 2、3；未完成的真实 DPI 矩阵与干净 Windows 断网验证仍是任务 4、5 的关口。最终推送与发布按实施授权处理。

## 优先复核

1. 4,000 px 页面或 200% 系统缩放：必须整页、精确像素、无裁切（任务 1）。
2. 快速连续打开及导出时继续编辑：旧导入不能覆盖新内容，导出只用点击时的快照（任务 2、4）。
3. 设置或草稿损坏、写入失败或写入尚未完成时关闭：原始文件不丢失，关闭需等写入或明确选择放弃（任务 3）。
4. 导出取消、排版不符或磁盘写入失败：目标旧 ZIP 不变、下一次仍可导出（任务 4）。
5. 断网且没有 Node.js 的测试环境：已装 x64 .NET 10 Desktop Runtime 和 WebView2 时应可运行，缺先决条件时应明确提示；升级保留数据（任务 5）。

---

### 任务 1：先打包并验证 PNG 原型

**文件：** 新建 desktop/EnglishCards.Desktop/EnglishCards.Desktop.csproj、App.xaml、App.xaml.cs、MainWindow.xaml、MainWindow.xaml.cs、Web/LocalWebContent.cs、Export/CardCapture.cs；新增 tools/publish-desktop.ps1；调整 src/main.tsx、tools/vite.config.ts 支持本地导出页路径，保留网页 /render。

**接口：** 现有 window.renderProject(input) 返回分页签名和 window.renderDiagnostics；C# CardCapture.CapturePageAsync(int pageIndex, int width, int height, CancellationToken ct) 返回单页 PNG 字节，pageIndex 从 0 开始。

- [ ] 从基线运行 npm.cmd test、npm.cmd run build、npm.cmd run demo，保存四页 PNG、项目 JSON 和逐行诊断供比较。长文从现有分页测试生成；额外使用设置允许的 4,000 × 4,000 页面。
- [x] WPF 加载 Vite 成品和本地字体，使用仅映射成品资源目录的 HTTPS 虚拟主机。主窗口显示编辑器；原型导出视图直接接收测试快照，不接真实数据或旧服务。用 dotnet publish desktop/EnglishCards.Desktop/EnglishCards.Desktop.csproj -c Release -r win-x64 --self-contained true 输出至 artifacts/desktop/publish。
- [ ] 先验证以 100% 内容缩放显示单卡后用 CapturePreviewAsync 截取；以实际 PNG 检查视口、系统 DPI 和大页面边界。若视口限制导致裁切或尺寸错误，在同一 WebView2 试验通过 DevTools Page.captureScreenshot 的指定区域截图。不能靠事后缩放图片掩盖裁切；仅保留通过的方案。验证导出视图不夺焦、不改变编辑窗口滚动，隐藏或后台时也能得到有效帧。
- [ ] 打包产物在断网、无 Node.js/Playwright 且有 WebView2 的 Windows 环境启动。对默认四页、长文与最大页宽高，在 100% / 125% / 150% / 200% 下检查 PNG 头宽高、各页有效内容、预览/导出逐行记录与重复导出像素。记录运行时版本和与网页版的实际差异。按全局约束，可先完成任务 2、3；其余验收未通过，不进入任务 4、5。

#### 任务 1 本机验收记录

从工作树根目录运行以下命令。发布输出为 artifacts/desktop/publish，验收脚本为每次运行创建单独的证据目录。

    npm.cmd ci
    npm.cmd test
    ./tools/publish-desktop.ps1
    ./tools/test-desktop.ps1 -ExpectedDpi 144
    ./node_modules/.bin/tsx.cmd tools/compare-desktop-web.ts <本次桌面验收目录>

- 基线 c367e51 的单元测试通过 34/34，Vite 构建成功。基线和本阶段的 npm.cmd run demo 都在首次 POST /api/export 时达到 30 秒超时，原有演示文件仍保留，需另查完整网页导出链路。
- WPF 以 win-x64 自包含 .NET 10.0.14 发布，WebView2 SDK 固定为 1.0.4258.31。本机 Evergreen 实测 156.0.4314.58，WPF DPI 为 144，编辑器原生 devicePixelRatio 为 1.5。试验中的 800 × 600 DIP 窗口由 CapturePreviewAsync 生成 1200 × 900，默认页底部超出截图。隐藏窗口时 DevTools 截图未返回，保留屏幕外、禁止初始激活的后台窗口。仅导出视图将设备比例设为 1，直接按 CSS 区域生成 PNG。
- 实测默认 4 页和长文 8 页均为 1200 × 1600，最大尺寸 2 页均为 4000 × 4000。预览和导出分别匹配 86、197、100 条完整逐行诊断和签名。每页有正文、页脚及四角背景，两次导出的解码像素一致。导出期间编辑窗口激活状态、预览焦点元素和非零滚动位置保持一致。
- 单独对比 Playwright Chromium 156.0.8078.4 的 /render 页面。工具直接读取 Vite 成品，使用上述桌面快照，不调用 Express 导出接口。三组页数、换行、分页签名均一致。各页不同像素占比约 0.47% 至 6.60%。证据目录保留 WebView2 PNG、Chromium PNG、双方逐行诊断和像素计数。
- 验收关口仍开放。实际 100%、125%、200% 显示缩放以及断网、仅已有 Evergreen 的清洁 Windows x64 环境尚未测试。复制 publish 整个目录及 test-desktop.ps1 到目标环境，运行 ./test-desktop.ps1 -PublishDir <发布目录> -OutputDir <证据目录> -ExpectedDpi <96/120/144/192>，每个 DPI 各运行一次。该脚本仅需要 Windows PowerShell 和已存在的 WebView2；Node.js、Playwright 和 .NET SDK 仅用于开发端。系统 DPI 不匹配时会立即失败。

### 任务 2：接通桌面文件操作

**文件：** 新建 desktop/EnglishCards.Desktop/Web/EditorBridge.cs、src/services/desktopBridge.ts；修改 src/services/projectIO.ts、src/viewmodels/useEditorViewModel.ts、src/views/ProjectActions.tsx。

**接口：** 页面发送 {id, command, payload}；宿主回 {id, ok, value?, error?}。文件命令 openProject() 返回 {name, text} 或 null；saveProject(text) 返回保存结果或取消。桌面传输只在 WebView2 中启用，网页对照版保留原入口。

- [x] 先扩充文件交互回归：取消对话框不改数据、不清除脏状态；旧格式和损坏 JSON 被拒绝；保存后重新打开，内容和 schema 5 一致；连续打开时只接收最后一次结果。
- [x] 宿主仅接受预期本地编辑页来源与命令白名单；导出页无文件权限。打开与保存使用原生对话框，不提供任意路径读写。沿用 parseProject，保存先校验后写入，原子替换目标；只有写入成功才清除未保存状态。
- [ ] 运行上述回归及现有导入顺序、编辑历史、JSON 格式测试；实测桌面取消、读写失败和重启后重开。通过后独立提交。

本地提交 9b0fa75、3e93bb9 已通过独立代码复核。34 项单元测试、11 项定向浏览器测试通过；修复后 5 项重点浏览器测试及自包含发布再次通过。C# 测试覆盖保存后才能读取、文件锁下保留旧字节并清理临时文件、解锁后重试。浏览器用例使用桥接桩，实际 WPF 文件对话框取消、读取失败及重启后重开仍待综合桌面验收；尝试启动桌面交互时审批超时。

### 任务 3：迁移设置、草稿和关闭流程

**文件：** 新建 desktop/EnglishCards.Desktop/Persistence/UserDataStore.cs；修改 EditorBridge.cs、MainWindow.xaml.cs、src/services/projectIO.ts、src/viewmodels/useEditorViewModel.ts。

**接口：** loadSettings / saveSettings、loadDraft / saveDraft 使用同一消息协议；prepareClose 返回待保存状态及写入结果。持久化在 %LOCALAPPDATA%/EnglishCards 下使用 settings.json、draft.json 和独立 WebView2 目录。

- [ ] 先验证：文件缺失生成默认设置；损坏配置保留并提示；损坏草稿可另存原始内容；导入旧设置校验后才生效；连改设置、立即撤销并关闭时，重启读取最后确认的值。
- [ ] 保留 TypeScript 现有校验及撤销规则，宿主负责串行写入和同目录临时文件替换。桌面启动先异步读取设置与草稿再开放编辑；将待写入快照和正在进行的写入纳入关闭流程。写入失败留在当前窗口并提示，除非用户明确放弃；不依赖 beforeunload 完成异步写入。旧配置由用户明确选择文件导入。
- [ ] 验证读写失败时原文件未被替换、失败后重试有效；运行配置、草稿、通知回归并做一次实际桌面重启测试。通过后独立提交。

本地实现 66445a8 接入桌面设置、草稿、坏文件保留和关闭握手；c83b670 增加原件被移走后的恢复以及用户数据目录的单实例锁；3fb554f、80408ec 防止恢复时把新草稿当作原件，或在保存失败后跳过刚放回原件的备份。35 项 TypeScript 单元、4 项桌面持久化桥接浏览器用例、7 项 C# 原生文件与队列检查通过；自包含发布的 WebView2 验收模式在真实 150% 缩放下再次通过 14 页截图回归。验收模式使用隔离目录并自动退出，尚不能证明普通桌面关闭后重启恢复。宿主等待超时且桥接回复永久丢失时的恢复仍需验证和处理。任务 3 的实际重启验收保持未完成。

### 任务 4：接通正式 PNG / ZIP 导出

**文件：** 新建 desktop/EnglishCards.Desktop/Export/ZipExport.cs；修改 CardCapture.cs、EditorBridge.cs、src/services/projectIO.ts、src/viewmodels/useEditorViewModel.ts。

**接口：** exportProject({project, signature, diagnostics, projectJson})。project 是含运行时样式的已冻结快照；projectJson 是同次 schema 5 文档且不含 styles；返回成功、取消或错误。

- [ ] 先验证：导出过程中继续编辑不改变 ZIP 内项目或截图；强制签名不一致时不产生 ZIP；失败、取消后可再次导出；覆盖旧文件前发生写入失败时旧文件字节不变。
- [ ] 沿用任务 1 通过的截图路径。冻结快照并等待字体、布局及截图就绪，比较完整排版签名；不一致沿用首条差异诊断，停止写出。仅允许一个导出操作，按页写入临时 ZIP（page-01.png 等和 project.json），完成才替换目标；取消或失败释放截图视图及临时文件。
- [ ] 用默认和自定义页面尺寸实测 ZIP，解包逐页校验大小及导出 JSON；重跑缩放矩阵、长文、取消与失败用例。通过后独立提交。

### 任务 5：离线安装、升级和交付

**文件：** 新建 desktop/installer/EnglishCards.iss、docs/DESKTOP_ACCEPTANCE.md；修改 tools/publish-desktop.ps1、README.md。

- [ ] 安装器纳入依赖框架的发布产物及字体，不附带 .NET/WPF。检查 x64 .NET 10 Desktop Runtime 和 WebView2 Evergreen；提供开始菜单入口和可选桌面快捷方式，更新仅替换程序文件。首版保留网页版开发回归，不打包其服务或测试运行时。
- [ ] 在无外网、无开发工具但装有两个先决运行时的清洁 Windows x64 测试安装；另验证缺少先决条件时的明确提示。验收双击、读写 JSON、配置及草稿恢复、PNG/ZIP、退出重启、覆盖安装保留数据，以及安装包不含 .NET/WPF 运行库或 Node.js/Playwright 服务依赖。
- [ ] 运行 npm.cmd test、npm.cmd run build、独立端口的 npm.cmd run test:e2e 和桌面验收矩阵。记录安装包哈希、大小、Windows/DPI/运行时版本、实际结果和未验证的平台；README 把安装包作为普通用户入口。通过后独立提交并按授权交付。
