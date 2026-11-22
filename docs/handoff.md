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

- 2026-11-22 在 GitHub 核对：远程**仅剩 `main`**；无开放 PR；历史 PR 的记录仍可在 GitHub 查看。
- 用户本机路径：`C:\Projects\EnglishCards`。远程分支清理已核对；**本机分支、工作区是否干净及是否已同步最新提交，需在新会话中用 Git 命令重新确认，不能凭远程状态推断。**
- 此前历史分支使用过 Squash Merge，若本机尚残留历史分支，需先检查未推送提交／未提交修改，再决定删除；**勿对 main 强制重置**。
- 本交接文件本身将产生新文档提交，故下次新会话读到的 `main` 提交号应比上方“已验收代码提交”更新；不要把文档提交当作未经验证的程序改造。

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

- [README](../README.md)；[实施状态](implementation-status.md)；[Windows 验收](RELEASE_ACCEPTANCE.md)
- [联合保存流程](specs/COMBINED_ARTICLE_SAVE.md)；[卡片馆规格](specs/PHASE_E_CARD_LIBRARY.md)；[Bridge 接口](specs/EDITOR_BRIDGE_CONTRACT.md)
- 主要前端状态：`EnglishCards/frontend/src/viewmodels/useEditorViewModel.ts`；
  浏览器／桌面设置服务：`EnglishCards/frontend/src/services/projectIO.ts`；
  文件及 JSON 自动保存：`cardFileIO.ts`、`cardSaveCoordinator.ts`。
- Windows 宿主：`EnglishCards/desktop/`；测试：`EnglishCards.Tests/`；开发工具：`tools/`。


---

## 7. 待实施：只读 Script 阅读器改造方案（2026-11-22 讨论基线）

> **状态：仅方案讨论，尚未修改生产代码或现行正式契约，未执行新功能测试。** 上述 Article v6、编辑器、JSON + ZIP 联合保存和验收记录仍描述当前 main 的实际行为。本节记录用户对下一版的决定，不可宣称已实现；实施前需对照 ReadArticles、ScriptToVideo 的最新代码与现有 EnglishCards 源码再次核对。保持第一性原理与最小改动，能删除旧编辑链路就不要新增兼容层；独立分支/PR，未经用户验收不合并。性能与无关测试仍暂停。

### 7.1 数据与目录加载

- **只有**顶层 \`filetype: "script"\` 的 JSON 必需；Script 数据直接采用 \`script-timestamp-aligner\` Skill 的 Script JSON 结构：\`title\` 字段必需、允许空字符串（为空时不显示标题，不用文件名补标题）；\`paragraphs\` 为段落 → 句子，每句含 \`text\` / \`timed_units\`。正文永远由 \`text\` 显示，不反向拼接 \`timed_units\`；时间戳 \`null\` 的单元正常显示但不随播放进度高亮。
- \`filetype: "vocabulary"\` 与 \`filetype: "translation"\` 均可选；Vocabulary 直接采用 ReadArticles 的 Vocabulary Enrichment Skill 格式（\`words\`、\`word\`、\`family\`、英美音标、\`meanings\`），不转换或写回旧 Article v6；Translation JSON 固定两个字段：\`{"filetype":"translation","text":"..."}\`，\`text\` 为保留换行的纯文本。
- 同一目录允许同一 \`filetype\` 的多个 JSON。目录树**只显示 Script JSON**；参照 ReadArticles 的逐层 Lazy Tree：展开目录时仅枚举该目录直接包含的子目录和 JSON、仅检查 JSON 顶层 \`filetype\`，不递归扫描下级目录，不提前加载音视频。隐藏 \`cache/\`、\`export/\` 等程序产物目录。目录树不得依赖 JSON 文件名后缀判断是否 Script。
- 当前展开/选定目录有 **1 个 Script** 时自动加载；有 **2 个及以上 Script** 时预览为空，等待用户明确点击，**点击哪个就打开哪个**，废除 Script 按文件名排序取第一个的规则。对已选定的同一 Script，普通目录刷新不应随意清空预览。
- 可选 Vocabulary / Translation 若存在多个，按确定性的文件名顺序默认打开第一个，并以 ReadArticles 风格的**普通浮窗**提示选用了哪个；其余文件不删除。选词加号始终写入**当前实际打开的 Vocabulary 文件**，而非固定名 \`vocabulary.json\`。若当前目录一个 \`filetype: "vocabulary"\` 文件都没有，则首次添加生词时创建 \`<script>.vocabulary.json\`（\`<script>\` 为当前 Script 文件名去掉最后的 \`.json\`，如 \`lesson.script.json\` → \`lesson.script.vocabulary.json\`），随后作为当前生词本。原文与 Translation 始终只读。
- 预览中的蓝色圆形加号及选区行为参考 ReadArticles 的 \`web/icons/selection-add.svg\`、\`reader.js\`：仅允许有效 Script 句内选词/短语，验证原文位置、规范化与重复词；新增立即对活动 Vocabulary 执行受控原子持久化（外部修改冲突保护），磁盘保存成功才确认 UI 成功，导出阶段不再额外生成或保存 Vocabulary。

### 7.2 页面、媒体、通知与操作界面

- 删除右侧中英文及词汇编辑栏和编辑用分割条，只保留左侧卡片馆与右侧只读阅读区。卡片馆底部左对齐固定按钮：**设置、清空、导出 PNG、导出 MP4**。设置窗口按 ReadArticles 的分组样式排列，保留底部保存/取消/恢复默认按钮；Script/Translation 禁止在程序内编辑，选词新增 Vocabulary 是唯一受控内容写入入口。
- 预览区一次只显示 **1 张卡片**，提供前/后翻页及页码；正文分页仍按 Script → 可选 Vocabulary → 可选 Translation 排列。底部播放器进度条、播放/暂停、停止、定位、快捷键与普通/警告/错误浮窗参照 ReadArticles，尽量复用现有 EnglishCards 分页和通知实现。
- 只有**点击播放**时才从选中 Script 所在目录的直接文件中按后缀优先级 **.mp4 → .mkv → .m4a → .mp3 → .wav** 查找候选；同后缀按文件名排序尝试，失败继续下一个，首个成功打开并解码的文件成为唯一媒体源；不按 Script 文件名同 stem 限制媒体、无自动拼接或递归查找。媒体播放中途失败不自动切源，文章切换/清空时取消旧加载与播放。借鉴 ScriptToVideo 的媒体探测、带 Range 的本地媒体访问及生命周期保护。
- 若选中**视频**：同一播放器固定在每张阅读卡片顶部，翻页只变更正文、不得重建或重载视频；页面高度为卡片高度减视频区域，保持合适宽高比与正文可用空间。若选中**音频**：再从同目录按 **.png → .jpg → .jpeg** 顺序、同扩展名文件名升序选第一张有效图片，仅在第一页显示；无图片则不显示图片区。没有媒体不妨碍文字阅读与 PNG 导出。静态 Vocabulary 高亮与 Script 有效时间戳的播放进度高亮分开处理。

### 7.3 每 Script 配置与视频逐页时长

- 每篇 Script 的文章级样式、播放与视频导出设置分别保存于 **\`<Script所在目录>/export/<Script文件名去掉最后.json>/settings.json\`**，如 \`lesson.script.json\` 对应 \`export/lesson.script/settings.json\`。Script 重命名即新配置身份，不自动迁移旧配置；相同文件名在相同目录下读取旧配置，所在目录不同则独立。加载 Script 时同时读取配置，先应用页面样式再计算分页；配置不存在则采用/建立默认配置，目录不可写不应阻止只读阅读。全局卡片馆路径等与文章无关的信息仍由程序级设置管理；用户持久配置不放在可清理的 \`cache/\`。
- 视频导出设置下方提供**有表头的四列表格**：\`页码 | 停留时间 (s) | 页码 | 停留时间 (s)\`。总页数为 N，左组依页码升序展示 \`1…ceil(N/2)\`，右组依页码升序展示其余页；奇数页时左组多一页，右组末行留空。页码不可编辑，时长是文本输入框，仅接受 ASCII \`0–9\` 和至多一个小数点，最多 **3 位小数**；界面单位 s，内部单位 ms。
- 每页数据字段严格命名 **\`DefaultDurationMs\`**（程序建议）和 **\`ModifiedDurationMs\`**（用户修改）；首次创建时二者相等。含有效时间戳的页面按实际媒体/Script 时间区间计算建议值，**没有有效时间戳的页面默认 \`DefaultDurationMs = 0\`**（废除此前 3 秒统一停留值）。同页含 Vocabulary 不另加时间。配置恢复/分页或媒体信息变化时应重新校验默认值、避免把旧页码设置错误复用到新页面。
- **只在用户按 Enter 或输入框失去焦点时提交并校正编辑**：若输入已清空或解析值小于同页 \`DefaultDurationMs\`，则把 \`ModifiedDurationMs\` 设为该 \`DefaultDurationMs\`，立即更新表格并显示 ReadArticles 风格的**普通消息**；例如默认 3132 ms 显示 \`3.132\`，默认 0 ms 显示 \`0.0\`。输入未提交时允许临时空值或末尾小数点；保存/导出必须为有效非负整数毫秒。已保存值因最新默认值变大而不合法，也须钳位且提示。用户可将某页设为 0，只要该页默认也是 0。
- **\`ModifiedDurationMs = 0\` 的页面跳过 MP4 渲染，但仍保留在单页阅读和 PNG 导出；其他正时长页不受影响，MP4 正常导出**。若所有页面均为 0，则需提示无可渲染画面，不生成无效 MP4。MP4 的页码/时间表**以视频版分页为准**，不与重新分页后的 PNG 页码混用。需要用冻结帧/静音和明确的源时间轴到导出时间轴映射保护音画同步，不能直接改 Script 原时间戳、裁掉朗读或擅自改变语速；具体跨页时间锚点和插入停留的算法仍需专项实现与实机验证。

### 7.4 缓存及两类导出

- 同目录为每个 Script 隔离 \`cache/<script>/\` 与 \`export/<script>/\`（\`<script>\` 同上，指文件名去掉最后 \`.json\`）；缓存按实际需求分 \`render/\`、\`media/\`、\`temp/\` 等任务目录，按需创建，不创建无用空目录；原 Script、音视频和 Translation 不得修改。导出 MP4 不放回源目录根部，以免被下一次媒体优先级搜索选中。
- **不再导出 ZIP，也不联合保存 JSON + ZIP。** PNG 直接导出到 \`export/<script>/images/page-001.png\` 等，生成全部静态分页图片（不是只生成当前预览页），保留现有 EnglishCards 的独立 WebView2 页面捕获、尺寸与 PNG 格式验证；临时批次先完整生成再安全替换正式 \`images/\`，避免多页/少页两次导出混杂。
- PNG 遇到**视频**时，提取视频**第 1 帧**只放在**第一页顶部**，随后以无视频占位的静态布局**重新分页**，后续 PNG 不再重复视频首帧；遇音频加图片也只在第一页显示图片。首帧提取不得重置正在播放的视频。PNG 页数与 MP4 页数因此可以不同。
- MP4 复用 ScriptToVideo 的 Remotion 编码、媒体探测、进度/取消、子进程生命周期、临时输出验证及不覆盖既有文件的安全提交思路，但不照搬其不同的 ScriptToVideo v3 数据格式、同名媒体限制、revised/TXT/project 三文件编辑保存链。MP4 最终输出放在 \`export/<script>/\`，按逐页 \`ModifiedDurationMs\` 时序生成；导出依赖检测仅在使用 MP4 功能时进行，不应阻断普通阅读/PNG 导出。

### 7.5 开发和验收边界

- 目标阶段：A 数据格式、目录懒加载、单页只读预览及当前生词本写入；B 媒体播放、浮窗、顶部视频/图片与时间戳高亮；C PNG 目录导出、MP4 逐页时间轴和安全提交。每阶段先检查对应源码及约束，再在独立分支/PR 实现；未经明确批准不合并。
- 验收至少覆盖：多/单 Script 自动/手动选择、无 Vocabulary/Translation、重复 Vocabulary 选择、加号持久化/冲突保护、标题空字符串、\`null\` 时间戳、目录非递归扫描、媒体查找优先级及解码回退、视频翻页不断流、设置随 Script 文件名变化、四列表格数字约束/回车失焦钳位及浮窗、0 ms 页面跳过 MP4、PNG 首帧及重新分页、图片批次原子性、MP4 音画同步/取消与原文件不变。
- 当前 main 的 \`AGENTS.md\`、\`docs/project-contract.md\`、\`docs/specs/\` 尚描述 Article v6；这是**待实施版本差异**，不是文档冲突已经解决。实施时按批准阶段同步更新正式契约，并且不将此前的自动化测试通过误报为新方案验收。
