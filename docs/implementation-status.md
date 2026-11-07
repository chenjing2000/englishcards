# EnglishCards 桌面版实施状态与验收记录

> 本文前半部分包含历史阶段记录，旧路径（`desktop/`、`src/`、`tests/`、`dist/wpf/`）仅用于追溯。当前目录与目标数据契约以 `docs/project-contract.md` 为准。

2026-11-06；当前行为以 `docs/project-contract.md` 为准。本文包含历史执行环境记录及用户补充的 Windows 验收结果。

## 已修改源码（未声称 Windows 实机通过）

- React 两栏位置交换，默认预览 70% / 编辑与设置 30%，分隔条保留。
- `App.xaml.cs` 正常运行的用户数据根目录改为 EXE 同级 `userdata/`；`UserDataStore` 在使用 WebView2 前创建并检查数据目录可写。设置、草稿、WebView2 Profile、默认 JSON/ZIP 保存目录独立到子文件夹；不访问旧 LocalAppData。
- React 桌面导出请求改为 `exportAllZip`，包含不可变项目快照、schema 5 文档、预览分页签名、页数。
- 新增 `ZipExportService.cs`：独立 WebView2 加载 `render.html`，校验分页签名、页数及 PNG 尺寸，写入文章 JSON 与所有页面 PNG，按目标目录临时文件验证后提交。提供取消按钮；在导出期间关闭主窗口时要求先取消。
- 保留 `CardCapture.cs` 作为 ZIP 内 PNG 截图工具，不提供单页 PNG 用户入口。
- 去掉 `npm start` 独立网页产品入口；原 Express 用作开发 E2E 测试夹具（`npm run test:serve`），移到开发依赖；正式桌面发布仍是静态 WebContent。
- 更新 README 与部分测试以反映新行为。

## 当前环境验证

- 已检查 JS package manifest 与锁文件根依赖表一致。
- `npm ci --offline` 失败：所需依赖未全部缓存。
- 尝试从公共 registry 安装依赖，命令超时；因此未执行 TypeScript 构建和 Vitest/Playwright。
- 当前环境没有 `dotnet` 和 Windows/WPF，因此 **无法构建或运行 WPF，也不能验证真实 PNG/ZIP 导出**。

## 尚需在 Windows 上补做的事项

1. `npm.cmd ci`、`npm.cmd test`、`npm.cmd run build`；修正所有编译、测试回归。
2. `dotnet build` / `dotnet publish ... --self-contained false`（可选封装：`tools/publish-desktop.bat`），检查 WPF 编译与 NuGet 程序集调用。
3. 在运行中的 Windows WebView2 验证 ZIP 快照、字体、逐页 PNG、导出取消、覆盖已有 ZIP 的安全性、关闭窗口时的任务生命周期。
4. 确认 `userdata/` 首次创建、目录不可写时失败提示、便携目录移动、完全不迁移旧 LocalAppData。
5. 单实例“激活已有窗口”尚未实现，现有文件独占租约仍只阻止重复实例。
6. WebView2 Evergreen 缺失或初始化失败时，程序会显示中文恢复提示，并可打开微软官方安装/修复页面；需在干净 Windows 环境实测。
7. 浏览器开发测试中直接调用旧 Express `/api/export` 的历史回归用例需保留为测试夹具验证或迁移为桌面端到端用例；旧网页版 UI 导出测试不再代表正式产品。
8. 尚未完成正式安装包、干净 Windows x64 交付验收。

本工作副本是实质代码修改，不是已验证可用的 Windows 最终发行版。

## 用户 Windows 环境测试反馈（2026-11-06）

根据用户提供的 PowerShell 测试记录：

- `npm.cmd ci` 成功，安装 185 个 packages。
- `npm.cmd test`：9 个测试文件、35 项测试全部通过。
- `npm.cmd run test:e2e`：57 项中 53 项通过、4 项失败。
  - `editor.spec.ts`：旧浏览器 `/api/export` PNG 与 DOM 截图逐字节相等的断言失败。此断言不能直接证明桌面 WebView2 导出错误，需要用真实桌面导出产物验证；浏览器与 WebView2 截图环境不同。
  - `export-diagnostics.spec.ts`：测试仍调用浏览器旧 `/api/export`，但 UI 已明确提示 ZIP 导出仅在 Windows 桌面版可用；该测试需要改为验证桌面桥接/桌面导出错误，或保留为纯测试服务诊断，不应通过旧网页 UI 触发。
  - `layout.spec.ts` 与 `table-sizing.spec.ts`：失败原因是 splitter 的 accessible name 与既有测试期望不一致。已将 aria-label 恢复为 `调整编辑与预览宽度`，应在 Windows 环境重跑确认。
- 用户日志最后执行 `./tools/publish-desktop.ps1`，未提供该命令的输出，因此不能据此判断发布成功或失败。

## 发布入口调整

- 默认发布方式改为：先 `npm.cmd run build`，再直接执行 `dotnet publish ... --self-contained false`。
- 可选的一键封装为 `tools/publish-desktop.bat`。
- 已移除 `tools/publish-desktop.ps1`，避免将 PowerShell 脚本作为发布入口。


## 2026-11-06：EnglishCards 单文件发布与样式页调整

- 正式入口 `desktop/EnglishCards.csproj`，输出 `dist/wpf/EnglishCards.exe`；Framework-dependent / PublishSingleFile，发布前需 `npm.cmd run build`。
- React 的 index.html、render.html、JS、CSS、字体均由 MSBuild EmbeddedResource 纳入程序集，启动时提取到 `userdata/cache/ui/<ModuleVersionId>/`；外部 `WebContent` 不再是运行依赖。
- 主程序命名空间 `EnglishCards`，测试项目 `EnglishCards.Tests`，WPF 主项目从默认 Compile 中排除测试代码。
- 左侧预览初始宽 70%、右侧编辑 30%，现有可拖动分隔条逻辑保持不变。相应调整 E2E 鼠标方向与表格高度测试。
- 样式页两张表的第二列居中，原设置提示移至第二表下方（20 DIP），下方按钮改为 80 DIP 宽、相隔 20 DIP、整体居中；文案为“默认配置”“导入配置”。
- 更新相关 E2E 以反映仅桌面端提供 ZIP 出口；保留测试专用浏览器导出服务作为诊断工具。
- Linux 容器没有 dotnet SDK，也无完整 npm 离线缓存；尚未运行 Windows WPF 编译、Playwright 或实机 ZIP 导出。需要 Windows x64 执行如下测试，不能把静态检查误报为功能验收。

```bat
npm.cmd ci
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf
dotnet run --project desktop\EnglishCards.Tests\EnglishCards.Tests.csproj -c Release
```

特别验收：删除 `dist\wpf\userdata` 后首次启动自动创建；打开并保存 JSON；设置页在真实 WPF 中显示两个按钮；字体、预览和 ZIP 多页导出；二次发布不得擦除 `userdata`；检查 `dist\wpf` 是否存在额外运行必需的附属文件。

## 2026-11-06：ZIP 导出窗口与 JSON 可读性优化

- 新增可复用 WPF `ProgressDialog`，使用自定义无边框窗口、浅色背景、圆角、轻阴影和居中布局；ZIP 导出窗口宽 460 DIP、高约 180 DIP。
- 取消按钮仅显示“取消”，尺寸为 48 × 32 DIP；标题栏关闭按钮执行同一取消流程。取消后禁用重复操作，显示“正在取消……”，等待导出任务退出并清理临时 ZIP 后关闭窗口。
- 进度窗口支持不确定进度与确定进度；验证字体/分页、生成文章 JSON、逐页渲染并写入 ZIP、验证压缩包分别显示阶段信息。页面渲染阶段按已完成页数更新进度。
- 新增 `ArticleJsonFormatter`：导出的 `article.json` 使用 UTF-8 无 BOM、2 空格缩进、中文不转义，并追加末尾换行；通过 JSON 结构比较测试确保格式化前后数据等价。
- 保持 ZIP 文件名、`article.json`、`images/page-XXX.png` 路径、PNG 截图与分页校验流程不变。
- 新增桌面测试覆盖 JSON 格式化的缩进、UTF-8、中文可读性及语义等价性。
- 当前执行环境不含 Windows/.NET SDK，尚未完成 WPF 编译与实机视觉验收；需要在 Windows 上重新 `dotnet publish` 并验证导出窗口、取消和 ZIP 内容。


## 2026-11-06：第七轮 Windows 发布与运行环境审查

- 检查了 `EnglishCards.csproj`、`tools/publish.bat`、`App.xaml.cs`、`MainWindow.xaml.cs`、`UserDataStore.cs`、`app.manifest`、`.gitignore`、README、项目契约及 Windows 应用审查 Skill。
- 确认发布模式仍为 win-x64 / Framework-dependent / PublishSingleFile；Node.js、npm、Express、Vite、Playwright 和 Chromium 不属于最终用户运行依赖。
- 确认 `tools/publish.bat` 不删除 `dist\wpf\userdata`；`.gitignore` 覆盖 `userdata/`、`dist/`、前端构建产物、.NET bin/obj 和测试输出。源码归档不含这些生成目录。
- **修复：** WebView2 环境创建或主 WebView 初始化失败时，之前只显示底层异常。新增专用启动异常和中文恢复提示，询问用户是否打开微软官方 Evergreen Runtime 安装/修复页面。没有自动下载或静默安装。
- **保留：** 缺少 .NET Desktop Runtime 时不增加自定义启动器；README 明确要求安装 .NET 10 Desktop Runtime x64。WPF 应用代码在 .NET Host 启动前无法自行执行。
- 新增桌面回归检查，确保 WebView2 启动异常类型提供官方微软入口。
- 当前执行环境未安装 Windows/.NET SDK；本轮 C# 编译、测试、发布及干净机器实测均未执行，须由用户在 Windows 上验证。


## 2026-11-06：发布候选收尾证据（最新，优先于上述历史待办）

- 用户在 Windows 上对字体优化后的源码运行：`npm.cmd ci` 成功（184 packages）、Vitest 35/35、Playwright 59/59、.NET 桌面测试 16/16。
- `npm.cmd run build` 及 `dotnet publish ... --self-contained false -p:PublishSingleFile=true -o dist\wpf` 成功。
- 用户实测 EXE 由约 14.9 MB 降至约 1.9 MB；中文卡片预览与导出图片无明显视觉差异。
- 上文早期提及的脚本名、错误测试数量及当时尚未验证的事项是**历史记录**，不得覆盖这次最新验证证据。当前发布命令与检查事项见 [`RELEASE_ACCEPTANCE.md`](RELEASE_ACCEPTANCE.md)。
- 独立 Windows 安装/Runtime 缺失测试、真实升级中 `userdata` 的数据保全、公开素材权利检查以及最终版本命名尚未完成；不应据此宣称正式发布已经完成。


## 2026-11-07 — Responsive preview layout and zoom toolbar

Superseded by the 2026-11-07 width-only preview update: 280 DIP pane minimums; cards are scaled only to fit the available preview width, remain horizontally centered, and scroll vertically. Ctrl + wheel controls a 20%–100% zoom. If a narrower pane forces the current zoom down, that lower value is committed and remains after the pane widens. The zoom toolbar, percentage label, reset control, and all fit-height behavior are removed. Pagination and export code paths are not changed. See `responsive-preview-change.md` for the current contract.

## Article v6 migration — data foundation (2026-11-07)

A separate v6 data model, JSON/TXT import coordinator and standalone tests have been added under `EnglishCards/frontend/src/v6/` and `EnglishCards.Tests/frontend/unit/`. **The running application and its bundled fixtures remain v5 until the coordinated migration**. See [`docs/architecture/ARTICLE_V6_PHASE1.md`](architecture/ARTICLE_V6_PHASE1.md). These files do not imply that the editor, desktop integration, export, or existing skills have been migrated.


## 2026-11-07 — Article v6 phase 1.1 Windows verification

The owner supplied a fresh PowerShell log after the Vitest test-file fix:

- `npm ci`: PASS; 184 packages installed. npm printed a non-blocking esbuild `allow-scripts` notice.
- `npm test`: PASS, 10 suites and 46 tests. The 11 Article v6 tests are now recognized by Vitest.
- `npm run build`: PASS; TypeScript and Vite production build completed. Rollup printed non-blocking third-party Zod annotation warnings.
- `npm run test:e2e`: PASS, 61/61. These tests still exercise the existing v5 editor/bridge and do not prove v6 integration.
- `dotnet publish ...`: PASS on the owner's Windows x64 environment.

## 2026-11-07 — Phase 2A directory/build migration (current work)

- Production code moved to `EnglishCards/desktop/` and `EnglishCards/frontend/`.
- Tests moved to `EnglishCards.Tests/dotnet/` and `EnglishCards.Tests/frontend/{unit,e2e}/`.
- Skills moved from `docs/skills/` to root `skills/`; the Article-to-EnglishCards Skill now describes Article v6.
- Development-only Express test server moved to `tools/test-server/`.
- Vite output target changed from `artifacts/dist/` to `EnglishCards/.build/frontend-dist/`; test outputs use root `.build/`. The permanent `artifacts/` directory has been eliminated from the intended layout.
- WPF embedded-resource paths, .NET test project reference, Vite, Playwright, TypeScript aliases and publish output target were updated.
- The runtime editor and desktop bridge still use v5. This phase only reorganizes paths; it does not claim v6 app integration.
- The new directory layout has not yet been re-run on Windows. Container verification is limited by unavailable npm dependencies and no Windows/.NET runtime in this environment.
