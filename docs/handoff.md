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
- 每次加载不同 Script 即自动按 .mp4 → .mkv → .m4a → .mp3 → .wav、同后缀文件名升序尝试打开并解码，选择首个成功媒体，不自动播放；异步结果绑定 Script 会话。**若 Script 含时间单元但媒体全部无法成功加载，弹出提示消息**，不影响文字阅读，导出不另选媒体。
- **切换到不同 Script**：结束旧会话，停止并释放旧媒体、取消失效异步请求，**关闭／清除所有旧的普通、警告、错误消息浮窗**，然后加载新 Script／设置／Vocabulary／Translation／媒体。旧会话迟到的通知和媒体回调不得污染新会话。重复点击当前同一 Script 或普通目录刷新不主动重载媒体。切换到不同卡片馆时结束旧 Script；选择同一路径仅刷新树且保留已有 Script／媒体。进行中的文件持久化和导出任务须按其安全关闭／取消规则处理，不能把关闭浮窗误当成任务已取消。
- 视频播放器固定在每张卡片的顶部位置，翻页只更新正文，**不得重建或重新加载播放器**；正文使用减去视频区域后的可用高度。只选中音频时按 **.png → .jpg → .jpeg** 及同后缀名称顺序选择有效图片，仅第一页显示；无媒体仍可读文及导出 PNG。静态 Vocabulary 高亮和有效时间戳驱动的动态高亮独立。

### 7.3 设置与逐页默认时长

- 每个 Script 的设置仍存 `<Script所在目录>/export/<script>/settings.json`，重命名成为新身份；先应用样式，媒体确定后完成分页，无文件不强制写盘，目录不可写仍能阅读。
- 旧 **`DefaultDurationMs`、`ModifiedDurationMs` 逐页停留时长**正式废弃，改为 **`AutoPageTurnMs`**（系统自动、只读）和 **`UserPageTurnMs`**（用户可编辑、初始等于自动值），记录相对原媒体起点的**绝对翻页时刻**（整数毫秒），末页时刻是**视频结束时间**，不额外持久化逐页时长。
- 在父**设置弹窗**中打开**独立模态子弹窗**，子窗**相对设置弹窗居中**且打开期间父窗不可操作。表格正上方居中显示「**视频翻页时间设置**」，三列表头为 **页码 | 默认翻页时间 /s | 自定义翻页时间 /s**，表头、单元格和输入文字全部**水平、垂直居中**。第二列自动值只读，第三列用户值可编辑；长表格滚动。子窗「确定」只更新父窗暂存配置，「取消」放弃本次修改；父窗「保存」才持久化。
- **非末页**：若本页含有效单词时间戳，以本页**最后有效词结束时间 `t1`**和后续**最近有有效词时间戳页的首个有效词开始时间 `t2`**计算 **`AutoPageTurnMs_i = (t1 + t2) / 2`**；允许跨越无有效时间戳的中间页。结果统一四舍五入到整数毫秒，UI 以秒显示三位小数。若本页**无有效时间戳**（包括 `timed_units` 时间单元存在但其值全部 `null`），则 **`AutoPageTurnMs_i = AutoPageTurnMs_(i-1)`**，第一行前置为 0。若本页有有效时间戳但后续无有效 `t2`，**弹出可关闭的警告消息**，说明对应页缺少下一有效单词的开始时间 `t2`，提示用户在源 Script 中修正时间戳；不猜测自动翻页时刻。
- **末页**：只要存在任何 `timed_units` **时间单元**（即使全部时间值为 `null`），**`AutoPageTurnMs_N = T_media`**，取当前已成功加载媒体的结束时刻；若**完全没有时间单元**（`timed_units` 为空或缺失），继承上一页 `AutoPageTurnMs`，单页文章继承 0。**全部为 null 不等于没有时间单元。** 若 Script 含时间单元而所有媒体均无法成功加载，**弹出提示消息**；末页缺少 `T_media` 时不得猜测结束时间，**弹出可关闭的警告消息**，提示用户检查或补充可成功解码的媒体文件；没有媒体终点时不填入虚构时间。
- `UserPageTurnMs` 须同时满足 **`UserPageTurnMs_i ≥ AutoPageTurnMs_i`** 和 **`UserPageTurnMs_i ≥ UserPageTurnMs_(i-1)`**（首行前置 0）。仅允许 ASCII 数字、一个小数点、最多三位小数；Enter 或失焦提交，编辑时可临时为空；无效或低于下限钳位到两者最大值并显示普通消息。前行改变后须校验后续行，媒体或分页变化时不能沿用不匹配旧页号的值。
- **零时长页**由 **`PageDurationMs_i = UserPageTurnMs_i - UserPageTurnMs_(i-1)`**（第一行前置 0）判断：差值为 0，该页无条件不出现在 MP4 中，不论文字、null 时间或音频，但保留于阅读和 PNG；全零不生成无效 MP4。**不能根据 UserPageTurnMs 本身是否为 0 判定跳页。**
- **以上两类时间计算错误一律通过警告弹窗提示用户修改源文件**（Script 时间戳或媒体文件），而不是尝试回退推测。相关 `AutoPageTurnMs` 保持未确定；无法有效计算时不能保存伪造的翻页设置或执行依赖这些时刻的 MP4 导出，但不阻断普通阅读、目录操作和 PNG 导出。用户修复文件后，明确重新打开 Script 进行验证；程序不自动改写源文件。Script 切换时旧消息应清除，旧异步通知不得重现。只有自定义翻页与原始媒体音画映射继续留待 C2 论证。

### 7.4 导出路径与边界

- 每个 Script 使用隔离的 `cache/<script>/`（按需创建任务子目录）和 `export/<script>/`，持久设置不放缓存。原 Script、Translation、音视频不修改；Vocabulary 仅由明确加词入口修改。MP4 不写回 Script 根目录，以免误入媒体候选。
- **PNG 不打包 ZIP，也不再保存 Article v6 JSON＋ZIP 组合**：全部页面直接存入 `export/<script>/images/page-001.png` 等，复用现有独立 WebView2 捕获、图片尺寸及格式验证；先完整生成临时批次再安全替换正式图片目录，旧文件不得残留。视频只提取**第 1 帧**放在 PNG 第一页，后续无视频占位且重新静态分页；音频配图也仅第一页显示；提帧不能影响正在播放的视频。PNG 与视频版页数可不同。
- MP4 使用已选定的会话媒体，按相邻 `UserPageTurnMs` 差值推导视频各页时长，差值为零的页跳过；参考 ScriptToVideo 的 Remotion、进度／取消和安全提交，不引入其编辑保存模型。
- **错误处理**：非末页无未来有效 `t2` 或末页有时间单元但无媒体结束时刻，按第 7.3 节以警告弹窗引导用户修复源文件，不能擅自计算回退值。**仍待专项论证**：自定义翻页与媒体音画映射。

### 7.5 分阶段实施与验收

- **A**：只读 Script、Lazy Tree、Vocabulary、基础设置；**B**：加载 Script 即解码媒体及无媒体提示、播放／通知与高亮；**C1**：PNG；**C2**：三列模态弹窗、绝对翻页时间算法、零时长跳页与 MP4。代码实施须另行批准。
- 验收包括目录刷新不干扰已打开 Script／媒体、媒体解码回退与有时间单元但无媒体时提示、Script 切换清理旧浮窗；三列表头与居中标题、相对父设置弹窗居中的模态行为、表格双向居中；自动值只读、用户值可改，前后有效词中点、无有效时间戳页继承、末页全 null 与无时间单元区别，用户时间非递减和差值为零跳页，PNG／MP4 安全导出。 并验证缺 `t2` 或媒体终点时显示具体修复提示、拒绝使用未确定的自动时间导出 MP4，修复后可重新打开 Script。
- 现行 `main` 的 `AGENTS.md`、`docs/project-contract.md` 与 `docs/specs/` 仍描述 Article v6；只有未来得到代码实施批准后才按阶段更新正式契约。旧 CI 结果不代表新方案已通过验收。
