# EnglishCards 项目总契约

## 当前范围：只读 Script 阅读器 A1

本开发分支落实 2026-11-22 批准的 A1，不代表后续阶段已完成。详细设计以 [PR #11 的实施方案](https://github.com/chenjing2000/englishcards/blob/58f309e1d7dcaf3516471d855a1d6403468a7434/docs/Implementation%20Plan.md) 为准；PR #11 仍是独立设计 PR，不能擅自合并。

### 平台与数据位置

- Windows x64，WPF + .NET 10 + WebView2 + React/TypeScript；轻量 MVVM，无额外 DI/消息总线。
- Framework-dependent、PublishSingleFile；唯一正式输出 `dist/EnglishCards/`。用户预装 .NET 10 Desktop Runtime x64 与 WebView2 Evergreen，运行不依赖 Node/npm/Playwright。
- 程序数据位于 EXE 同级 `userdata/`，升级保留。不扫描、迁移或删除旧 `%LOCALAPPDATA%/EnglishCards`。

### A1 生产数据与阅读

- 唯一必需文件为顶层 `filetype: "script"` 的 Script JSON；`title` 必需且可为空，`paragraphs` 是段落内的句子数组，句子正文来自 `text`。
- `timed_units` 只保留时间信息，不作为正文来源。空、缺失、null 或无效时间不阻止只读阅读；不伪造时间。
- 可选 Vocabulary 使用原生 `filetype: "vocabulary"`、`words`、`word`、`family`、`phonetic_uk`、`phonetic_us`、`meanings`；不转换成 Article。
- 可选 Translation 为 `filetype: "translation"` 加纯文本 `text`，保留换行。
- 内容顺序 Script → Vocabulary → Translation。无标题不显示文件名兜底。
- 每次只显示一张阅读卡片，上一页/下一页到边界禁用，页码与该次阅读分页一致。
- 继续使用现有字体实测、折行、逻辑段落首行缩进和分页连续性校验。切换加载的迟到结果不得覆盖当前会话；失败不改源文件。
- 不保留 Article v6 生产兼容/转换/编辑/自动保存路径，也不提供清空、旧编辑区、联合 JSON+ZIP 保存。留存旧专项规格或测试不意味着恢复旧入口。

### A1 界面与分期边界

- 左侧选择卡片馆和设置图标，底部 PNG（Tooltip「保存」）、MP4（「导出 MP4」）；右侧单页阅读和翻页。
- A1 的 PNG、MP4、播放/停止不可用；按需选词加号不得假装已写入 Vocabulary。A3 才实现生词即时保存和每 Script 基础设置。
- 复用现有隐藏根节点、逐层加载目录树。filetype 过滤、产物目录隐藏、自动打开及完整刷新语义在 A2；A1 手动打开非 Script 必须拒绝。
- 媒体自动选取、解码、播放和时间戳高亮在 B。PNG 独立静态分页在 C1；仅 Script 的视频分页及绝对翻页时刻在 C2。MP4 永不以 Vocabulary/Translation 为输入。
- 全局设置与当前阅读会话分离；A1 不偷偷实现 per-Script 设置落盘，也不恢复旧全局草稿。

### 后续文件保护约束

Script、Translation 和原媒体始终只读。A3 加词只原子写入当前活动 Vocabulary；无 Vocabulary 时首次添加才创建配套文件，并检查外部修改。设置独立保存在 `export/<script>/settings.json`。导出任务只在各自批准阶段实施，失败/取消不损坏旧产物。

### 验证和交付

仅运行阶段直接相关的规则测试、交互测试及前端/桌面构建；性能基准和无关测试继续暂停。分别记录自动化、真实 WPF/WebView2、所有者验收，不挪用旧 CI 计数。A1 完成提交开发 PR，等待用户验收；未经明确批准不得合并或启动 A2。

Article v6、Phase E、联合保存和 ZIP 专项规格保留为历史技术参考，不再约束 A1 生产行为。稳定的文件保护和独立 WebView2 捕获能力按实际后续调用复用，不恢复旧保存命令。
