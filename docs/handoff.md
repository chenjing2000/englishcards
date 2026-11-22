# EnglishCards 开发交接（HANDOFF）

**交接日期：** 2026-11-22  
**仓库：** https://github.com/chenjing2000/englishcards  
**正式分支：** `main`  
**交接前已验收的代码提交：** `c7013a8454932c476308791583311cb5149928ae`（PR #10）  
**状态：** 旧版 Article v6 的三批精简与文档收尾已完成；2026-11-22 已讨论新一版只读 Script 阅读器、绝对翻页时刻与 PNG/MP4 分范围导出方案，**尚未实施**（见第 7 节）。此前暂停的性能与无关测试仍暂停。

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

## 7. 待实施：只读 Script 阅读器改造（2026-11-22 设计基线）

> **状态：仅设计，尚未修改生产代码或正式契约。** 上文第 1～6 节为当前 Article v6 实际状态；**唯一详细实施规格**见 [Implementation Plan.md](Implementation%20Plan.md)。PR #11 仅修改这两份设计文档，未经授权不启动代码阶段、不合并；无关与性能测试继续暂停。

- **数据与阅读**：必需 `filetype: "script"`；可选 Vocabulary、Translation。只读 Script／Translation；选词只向**当前打开的 Vocabulary** 原子保存，无生词本则首次加词时创建。单页阅读按 Script → Vocabulary → Translation 呈现。目录树隐藏根节点，逐层懒加载；展开／刷新不得影响已打开 Script 或媒体。
- **界面与媒体**：左上选卡片馆＋设置、左下 PNG（Tooltip「保存」）＋MP4（「导出 MP4」）；无清空、刷新按钮。阅读区单页、上一页／下一页、播放／暂停、停止、进度与选词加号。切换不同 Script 时自动按既定扩展名顺序逐个尝试解码媒体、成功后不自动播放；切换释放旧媒体并清除全部旧提示，旧异步结果无效。视频固定在卡片顶部，翻页不断流；音频配图仅首页。
- **三种内容范围**：**阅读与 PNG** 均包含 Script、可选 Vocabulary 和 Translation；PNG 独立静态分页，视频首帧／音频配图仅第一页，批次安全导出且不生成 ZIP。**MP4 只接受 Script 原文、当前已选媒体和必需的视频设置**；无需读取、校验、转换 Vocabulary／Translation，不渲染其视频页面，不设置内容开关。共用现有分页引擎，按内容及布局生成不同结果，**只有 Script 视频分页**用于 MP4 页码和翻页时间；Vocabulary／Translation 的变化不得触发 MP4 重新计算。
- **MP4 翻页**：`AutoPageTurnMs` 只读、`UserPageTurnMs` 可编辑，均为相对媒体起点的**绝对时间**；不再记录旧的逐页停留时长。设置窗口内打开独立三列模态子窗，居中标题「视频翻页时间设置」，表头「页码 | 默认翻页时间 /s | 自定义翻页时间 /s」，所有内容水平、垂直居中；相对于设置窗口居中。非末页有有效时间戳时采用前后有效词时间中点，无有效时间戳时继承上一页；末页有时间单元（全 `null` 也算）使用媒体终点，无单元则继承。用户时间不得早于自动值或上页用户时刻；相邻用户时刻相等时跳过零时长 Script 页。
- **异常与安全**：含时间单元但媒体未成功加载、缺后续有效词起点或无法取得末页媒体结束时间时，弹出可关闭的警告消息，提示用户修复 Script／媒体；不杜撰时间，不用未确定时刻导出 MP4，但阅读及 PNG 不受阻。用户修复后重新打开 Script。保留导出取消、输出验证和原有文件保护；**MP4 自定义翻页与原始媒体音画映射仍待 C2 专项确定**。
- **阶段**：A 为只读阅读、目录与 Vocabulary／基础设置；B 为媒体、播放和高亮；C1 为三类内容的 PNG；C2 为**仅 Script** 视频分页、时间弹窗、MP4 渲染及安全导出。正式规则、验收及代码核查入口全部以实施计划为准；当前 `main`、`AGENTS.md` 和正式产品契约仍是 Article v6。
