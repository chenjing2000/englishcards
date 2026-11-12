# WPF + WebView2 桌面宿主规格

> 本文只记录当前仍然有效的宿主技术边界。旧版 LocalAppData、安装器和 schema v5 方案均已被后续决定取代；当前权威规则见 [`../project-contract.md`](../project-contract.md)。

## 目标架构

- Windows x64 桌面应用采用 WPF + WebView2 + React/TypeScript。
- WPF 负责窗口、原生文件夹对话框、EXE 同级 `userdata/` 持久化，以及 JSON + ZIP 联合保存时的 ZIP 渲染与归档。
- WebView2 使用 Microsoft Edge Evergreen Runtime；不捆绑 Fixed Version Runtime。
- React 前端由 Vite 构建为静态资源，嵌入 WPF 程序集，运行时提取到 `userdata/cache/ui/<module-version>/`。
- 正式用户不需要 Node.js、npm、Express、Vite、Playwright 或 Chromium。
- .NET 采用 Framework-dependent、win-x64、单文件发布，目标机需安装 .NET 10 Desktop Runtime x64。

## 数据边界

- 目标文章格式为严格 Article schemaVersion 6。
- 桌面文件入口使用 `openCardFile`、`activateCardFile`、`saveCardFile` 与 `saveArticlePair`。卡片文件操作与 JSON + ZIP 联合保存均须严格校验 Article v6；浏览器草稿与 JSON 操作不属于桌面桥接命令。
- 不兼容 schema v5，不做静默迁移或双写。
- 用户数据位于真实 EXE 所在目录同级 `userdata/`；不扫描或迁移旧 `%LOCALAPPDATA%\\EnglishCards`。

## 发布和恢复

- 唯一正式发布输出为 `dist/EnglishCards/`。
- 发布/升级不得删除其中的 `userdata/`；发布工具只处理应用产物。
- 缺少 .NET Desktop Runtime 时由 .NET Host 报告运行时缺失，README 提供 Microsoft 官方下载入口；不增加 Native Launcher。
- WebView2 缺失或初始化失败时显示中文恢复说明及 Microsoft 官方 Evergreen 安装/修复入口。

## 验收

在干净 Windows x64 环境验证 .NET Desktop Runtime、WebView2 Evergreen、离线启动、用户数据目录创建、卡片打开、JSON 自动保存、JSON + ZIP 联合保存、覆盖取消及失败恢复。自动化测试不能替代真实 WPF/WebView2 验收。
