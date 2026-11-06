# EnglishCards 桌面改造工作副本 — 实施状态

2026-11-06；依据 `docs/project-contract.md`（v1.2）。

## 已修改源码（未声称 Windows 实机通过）

- React 两栏位置交换，默认预览 45% / 编辑与设置 55%，分隔条保留。
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
6. WebView2 Evergreen 缺失时的官方安装引导尚未完善。
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
