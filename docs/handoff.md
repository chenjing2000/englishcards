# EnglishCards 开发交接（HANDOFF）

**交接日期：** 2026-11-22  
**仓库：** https://github.com/chenjing2000/englishcards  
**正式分支：** `main`  
**交接前已验收的代码提交：** `c7013a8454932c476308791583311cb5149928ae`（PR #10）  
**状态：** 旧版 Article v6 的三批精简与文档收尾已完成；2026-11-22 已讨论新一版只读 Script 阅读器、逐页视频时长与 PNG/MP4 导出方案，**尚未实施**（见第 7 节）。此前暂停的性能与无关测试仍暂停。

> 本文件为跨会话开发状态摘要，不是第二套产品规格。产品和架构约束以 [项目总契约](project-contract.md)、[AGENTS.md](../AGENTS.md) 以及现行 [专项规格](specs/) 为准。任何新的代码改动前先核对 GitHub 最新 `main`；本段提交号是交接时的已验收代码基线，不包括本次文档提交。

## 1. 当前产品与不可破坏的行为

- Windows x64 本地英语精读卡片编辑器：WPF + .NET 10 + WebView2 + React/TypeScript；发布仍为 win-x64、Framework-dependent、PublishSingleFile，运行数据位于 EXE 同级 `userdata/`。
- **唯一正式数据格式为严格 Article v6（`schemaVersion: 6`）**；拒绝 v5 及更早版本，不增加兼容迁移或双写。
- 左侧卡片馆按目录懒加载并打开独立 JSON，右侧按 Vocabulary → Content → Translation 编辑，中间预览。桌面端不再提供旧新建卡片、全局草稿恢复、独立 ZIP 导出等入口；浏览器测试模式保留自身草稿及 JSON 操作能力。
- 当前卡片 JSON **约 300 ms 防抖自动保存**；保存协调器保证目标文件、不可变快照、修订顺序及失败保护；保存中禁止切换卡片，被阻止的点击不排队。
- 工具栏「保存 JSON + ZIP」从同一 Article v6 快照生成同名文件；ZIP 含 `article.json` 和各页 PNG。覆盖前确认，采用暂存、备份和失败回滚保护已保存文件。**JSON 自动保存不代表 ZIP 已联合保存**；保存按钮星号表示当前会话内尚未联合保存的正文/页面设置变更。
- 非空文章清空时，即使未修改，也要求保存／放弃／取消确认；保存未完成不能清空。
- 编辑、自动保存、设置、联合保存及覆盖弹窗期间，预览不闪烁或清空；新分页准备就绪后替换，同一文章保持阅读位置；过时预览不能用来导出或执行失效的选词操作。

## 2. 最近完成和合并的工作

| PR | 工作 | 状态 |
| --- | --- | --- |
| #5 | 第一批：清理旧桌面持久化与浏览器 ZIP 导出 | 已合并 |
| #6 | 第二批：简化 Vocabulary 接口及联合保存校验 | 已合并 |
| #7 | 预览连续性、防闪烁、未联合保存星号 | 已合并，用户完成 Windows 实机验收 |
| #8 | 修正项目契约、验收、Bridge 等文档；删除临时说明文件 | 已合并 |
| #9 | 修复 `npm run demo`，改用 `/api/render-page`，修复测试服务器专用渲染入口并加入 CI | 已合并 |
| #10 | 第三批小范围精简：ViewModel 设置回调、类型断言及单用途桌面设置加载器；增加损坏设置保护测试 | 已合并 |

PR #3（旧 UI/New Card/ZIP 方案）**已关闭且未合并**，不要从该 PR 恢复旧流程。

## 3. 验收证据与未完成范围

**最新已确认的合并后 Windows CI：** [Run #43169050732](https://github.com/chenjing2000/englishcards/actions/runs/43169050732)，对应 `c7013a8`，结论 **success**：

- Vitest：**64/64**，13 个测试文件；
- Playwright E2E：**76/76**；
- React / TypeScript 构建、Windows .NET 测试：通过；
- `npm run demo`：通过；4 张 1200×1600 PNG，重复渲染逐字节一致，无外部网络请求；
- .NET 联合保存覆盖确认、失败回滚及暂存清理测试：通过。

这些是**自动化 CI 和此前用户已确认的实机验收**，不应声称在 2026-11-22 又重新执行了程序实机测试。外部干净 Windows 机器的运行时缺失、升级数据保全及正式发布前验证仍未被该 CI 覆盖，见 [发布验收记录](RELEASE_ACCEPTANCE.md)。

**用户最新决定：** 第三批精简正式收尾，暂时不再重构 `CardSaveCoordinator`、分页算法、联合保存回滚等稳定模块；长文章、词汇量、内存和编辑响应等性能基准测试**暂停**，不是待自动启动的任务。

## 4. Git 与分支状态

- 2026-11-22 旧版收尾时曾核对远程仅剩 `main`、无开放 PR；**此后已创建 [Draft PR #11](https://github.com/chenjing2000/englishcards/pull/11)**，位于 `docs/readonly-reader-design-handoff-20261122`，只承载下一版只读阅读器设计文档，尚未合并。
- 用户本机路径：`C:\Projects\EnglishCards`。远程分支清理已核对；**本机分支、工作区是否干净及是否已同步最新提交，需在新会话中用 Git 命令重新确认，不能凭远程状态推断。**
- 此前历史分支使用过 Squash Merge，若本机尚残留历史分支，需先检查未推送提交／未提交修改，再决定删除；**勿对 main 强制重置**。
- PR #11 的设计文档提交不代表 `main` 已改变，更不代表新版功能已经实现；下次会话以最新 GitHub 分支／PR 状态为准。

## 5. 下一会话建议流程

1. 先读取本文件、[项目总契约](project-contract.md)、[AGENTS.md](../AGENTS.md)，再按需求读取 [现行专项规格](specs/) 和源码；核对 GitHub 最新 `main` 与 PR/CI 状态。
2. 若需要本机同步，在 PowerShell 中执行：
   ```powershell
   cd C:\Projects\EnglishCards
   git status --short
   git switch main
   git fetch origin --prune
   git pull --ff-only origin main
   git branch -a
   ```
   本机存在未提交修改时先保护修改，不能覆盖。
3. 新需求先讨论设计、涉及文件、风险和验收口径；遵循**第一性原理、奥卡姆剃刀、最小修改**，不新增无必要的功能、抽象、代码或文档。
4. 按用户明确批准的范围实施。默认开发分支 + PR + CI + 必要的 Windows 实机验收；**未经用户确认不合并 PR**。将自动化通过与实机验收严格区分。
5. **当前明确暂停测试与性能优化工作**；没有用户的新指令，不主动启动新的性能测试、优化或重构。

## 6. 重要入口

- [README](../README.md)；[只读 Script 阅读器实施方案](Implementation%20Plan.md)；[实施状态](implementation-status.md)；[Windows 验收](RELEASE_ACCEPTANCE.md)
- [联合保存流程](specs/COMBINED_ARTICLE_SAVE.md)；[卡片馆规格](specs/PHASE_E_CARD_LIBRARY.md)；[Bridge 接口](specs/EDITOR_BRIDGE_CONTRACT.md)
- 主要前端状态：`EnglishCards/frontend/src/viewmodels/useEditorViewModel.ts`；
  浏览器／桌面设置服务：`EnglishCards/frontend/src/services/projectIO.ts`；
  文件及 JSON 自动保存：`cardFileIO.ts`、`cardSaveCoordinator.ts`。
- Windows 宿主：`EnglishCards/desktop/`；测试：`EnglishCards.Tests/`；开发工具：`tools/`。


---

## 7. 待实施：只读 Script 阅读器改造（2026-11-22 最新讨论基线）

> **状态：设计已记录，尚未修改生产代码或正式契约，未执行新版功能测试。** 上文第 1～6 节记录当前 Article v6 的实际行为；本节仅概述未来版本，具体工作分解、依赖、验收与待论证问题以 [Implementation Plan.md](Implementation%20Plan.md) 为准。坚持最小修改，删除废弃编辑链路，不设旧 Article v6 兼容层。未经明确批准不创建实施 PR、不合并代码，性能与无关测试仍暂停。

### 7.1 数据、目录树及打开行为

- 唯一必需文件是顶层 `filetype: "script"` 的 JSON：沿用 ScriptTimestamp／`script-timestamp-aligner` Skill 的 `title`、`paragraphs`（段落 → 句子 → `text` / `timed_units`）结构；`title` 必需但允许空字符串；正文总是由 `text` 显示，时间戳 `null` 的文字不参与播放高亮。可选 Vocabulary 使用 ReadArticles Vocabulary Enrichment Skill 的 `words/word/family/音标/meanings` 格式；可选 Translation 固定为 `{"filetype":"translation","text":"..."}`，其纯文本保留换行。
- 卡片馆根目录**不是树节点**，选择后只显示根目录内部的直属子目录与 Script 文件；逐层 Lazy Loading，展开时仅检查该层直属 JSON 的顶层 `filetype`，不依据文件名后缀猜测类型，不递归扫描；隐藏 `cache/`、`export/` 等程序产物目录。借鉴 ReadArticles 的展开、折叠、请求失效与重试行为，尽量复用 EnglishCards 已有目录树。
- 目录折叠后重新展开可重新枚举该层；同路径再次选择卡片馆可刷新根目录。**只要已有 Script 打开，目录折叠／展开／刷新不得主动重新加载、切换、清空或重新分页该 Script，也不得重新加载／停止其媒体。** 无 Script 打开时，当前目录只有一个 Script 则自动打开；有多个时等待用户点选，不能默认取第一个。明确点击某个不同 Script 才切换阅读对象。
- 同目录可有多个 Vocabulary／Translation：按确定性文件名顺序打开第一个，以 ReadArticles 风格普通浮窗提示，不删除其他文件。选词加号只能在 Script 有效句内出现，校验原文位置、规范化与重复词；新增立即原子持久化到**当前打开的 Vocabulary** 并保护外部修改冲突，保存成功才提示成功。目录完全没有 Vocabulary 时首次加词才创建 `<script>.vocabulary.json`（`<script>` 为去掉最后 `.json` 的 Script 文件名）。Script、Translation 只读，导出时不额外保存 Vocabulary。

### 7.2 主界面、媒体与通知生命周期

- 删除右侧编辑栏和编辑分割条。左侧**顶部**为「选择卡片馆」文字按钮，右侧紧邻 ReadArticles `ui/icons/setting.svg` 同款图标设置按钮（Tooltip「设置」）；左侧**目录树底部仅保留 PNG 和 MP4**，PNG Tooltip **「保存」**，MP4 Tooltip「导出 MP4」。**删除「清空」按钮，不新增刷新按钮。** 设置窗口参考 ReadArticles 分组布局，保留恢复默认／取消／保存。
- 右侧只显示一张阅读卡片，含上一页、下一页、页码、播放／暂停切换、停止、可拖动进度条及选词时的蓝色圆形加号；共 9 个主界面功能按钮（左侧 4、阅读区 5，加号按需出现），进度条不另算按钮。分页顺序 Script → 可选 Vocabulary → 可选 Translation；借鉴 ReadArticles 的播放快捷键、普通／警告／错误浮窗。
- **每次真正加载／切换 Script 时即开始检索媒体并逐个尝试打开、解码，不等待用户点击播放。** 仅在该 Script 所在目录的直属文件中按 **.mp4 → .mkv → .m4a → .mp3 → .wav**、同后缀文件名升序依次尝试；首个成功解码者成为当前会话唯一媒体，立即停止后续尝试，加载就绪但**不自动播放**；全部失败或无候选则无媒体。不能只以文件存在／可读取元数据视为解码成功；不按 Script 同名 stem 限制，不递归、不拼接。为避免阻塞文字预览，媒体尝试可异步执行，但必须绑定 Script 会话；媒体确定后按实际视频／音频布局完成或更新分页，导出也使用已选定的媒体文件，不另选其他候选。
- **切换到不同 Script**：结束旧会话，停止并释放旧媒体、取消失效异步请求，**关闭／清除所有旧的普通、警告、错误消息浮窗**，然后加载新 Script／设置／Vocabulary／Translation／媒体。旧会话迟到的通知和媒体回调不得污染新会话。重复点击当前同一 Script 或普通目录刷新不主动重载媒体。切换到不同卡片馆时结束旧 Script；选择同一路径仅刷新树且保留已有 Script／媒体。进行中的文件持久化和导出任务须按其安全关闭／取消规则处理，不能把关闭浮窗误当成任务已取消。
- 视频播放器固定在每张卡片的顶部位置，翻页只更新正文，**不得重建或重新加载播放器**；正文使用减去视频区域后的可用高度。只选中音频时按 **.png → .jpg → .jpeg** 及同后缀名称顺序选择有效图片，仅第一页显示；无媒体仍可读文及导出 PNG。静态 Vocabulary 高亮和有效时间戳驱动的动态高亮独立。

### 7.3 设置与逐页默认时长

- 每个 Script 的持久设置存储在 `<Script所在目录>/export/<script>/settings.json`；Script 更名即视为新配置身份，不迁移旧配置；不同目录独立。加载时先读取设置、应用文章样式再分页；没有文件时使用默认设置，不因只读打开就必须写盘；目录不可写不阻碍阅读。
- 视频导出设置下方为有表头的四列表格：**页码 | 停留时间 (s) | 页码 | 停留时间 (s)**；按页码依次分入两组，左侧 `1…ceil(N/2)`、右侧其余，奇数页右下留空。页码不能编辑，界面秒最多 3 位小数，内部整数毫秒；N 为视频布局页数，与 PNG 重新分页不同。
- 字段严格命名 **`DefaultDurationMs`** 和 **`ModifiedDurationMs`**，首次后者等于前者。**默认时长不是各单词朗读长度之和**：每页的结束锚点取该页**最后一个具有有效时间戳的单词的结束时间** `T_i`；若末尾单词为 `null`，向本页前面寻找最后一个有效结束时间。前置锚点 `T_prev` 是此前最近一个有有效时间戳页面的结束锚点，初始为 `0 ms`；则 `DefaultDurationMs_i = T_i - T_prev`。**整页无有效时间戳时默认 0 ms，且不更新前置锚点**，供下一个有锚点的页面使用。时间差自然包含单词间的停顿；Vocabulary／Translation 独立页面不增加时长。统一以整数毫秒计算，非递增／异常时间戳须校验提示，不得产生负默认时长。
- 仅在输入框 **Enter 或失焦**时提交与校正：只接受 ASCII 数字、至多一个小数点、最多 3 位小数；编辑中可暂时清空或以小数点结尾。空值或小于同页 `DefaultDurationMs` 的输入恢复为默认值并显示 ReadArticles 普通浮窗，3132 ms 显示 `3.132`、0 ms 显示 `0.0`；保存及导出必须满足 **`ModifiedDurationMs ≥ DefaultDurationMs`** 且为非负整数毫秒。分页／媒体／设置变化后重新核对默认值与用户值，不能盲目复用旧页号。
- **任何 `ModifiedDurationMs = 0` 的页面均不出现在 MP4 中**，无论其内容、`null` 时间戳或原始媒体是否含该段朗读；仍保留于阅读和 PNG。没有其他跳过条件，也不因音频情况自动为零时长页增时长。全部为 0 时提示并不生成无效 MP4；正时长页继续导出。原始媒体与导出媒体的跨页时间轴映射、延长与尾段处理仍需 C2 专项论证，不能把单一时长下限误当作已经证明全音频可无损容纳。

### 7.4 导出路径与边界

- 每个 Script 使用隔离的 `cache/<script>/`（按需创建任务子目录）和 `export/<script>/`，持久设置不放缓存。原 Script、Translation、音视频不修改；Vocabulary 仅由明确加词入口修改。MP4 不写回 Script 根目录，以免误入媒体候选。
- **PNG 不打包 ZIP，也不再保存 Article v6 JSON＋ZIP 组合**：全部页面直接存入 `export/<script>/images/page-001.png` 等，复用现有独立 WebView2 捕获、图片尺寸及格式验证；先完整生成临时批次再安全替换正式图片目录，旧文件不得残留。视频只提取**第 1 帧**放在 PNG 第一页，后续无视频占位且重新静态分页；音频配图也仅第一页显示；提帧不能影响正在播放的视频。PNG 与视频版页数可不同。
- MP4 使用本 Script 会话已确定的媒体，借鉴 ScriptToVideo 的 Remotion、进度／取消、输出验证与安全提交，不照搬其 v3 数据模型、同名媒体约束或编辑保存链。导出依赖检测只在 MP4 功能调用时进行；无相关依赖不得阻断文字阅读、Vocabulary 或 PNG。
- **待专项论证而非已定规则**：当零时长页、缺失时间戳或媒体尾部使最终画面总时长与原媒体不一致时，如何保留原朗读并确定音画映射；此处不擅自增加禁止导出、自动补时、改变零时长跳页等新业务限制。

### 7.5 分阶段实施与验收

- **A**：只读 Script／可选文件、既有 Lazy Tree 最小修改、单页预览、最新按钮、Vocabulary 即时持久化及基础独立设置；**B**：Script 打开时即选择并加载媒体、播放／浮窗生命周期、顶部视频／首图及有效时间戳高亮；**C1**：PNG 目录导出与静态重分页；**C2**：明确页间锚点及完整导出时间轴后实现四列表格、零时长跳过及 MP4 安全提交。阶段实施须另获授权，暂停无关及性能测试。
- 验收包括：根不显示为节点、单／多 Script 选择、目录刷新不干扰当前文章或播放、自动按格式解码回退、媒体随 Script 切换重选且不自动播放、切换时清掉全部旧浮窗且无迟到通知、空标题／`null` 文字、活动 Vocabulary 写入及冲突保护、页间结束锚点差与中间无时间戳页、时长输入钳位／消息、零时长页**无条件**跳过、视频翻页不断流、PNG 首帧及重分页、安全提交和 MP4 音画同步专项验收。
- 现行 `main` 的 `AGENTS.md`、`docs/project-contract.md` 与 `docs/specs/` 仍描述 Article v6；只有未来得到代码实施批准后才按阶段更新正式契约。旧 CI 结果不代表新方案已通过验收。
