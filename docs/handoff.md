# A2 开发分支交接补充（2026-11-23）

A1 已通过所有者实机验收，并在 Windows CI 成功后通过 PR #12 合并为 `ba3b5f2`。本分支仅继续获批 A2：按层筛选 Script 的目录树、单文件自动打开，以及目录和异步打开期间的阅读会话保护。A3/B/C 尚未实施。当前范围和验证证据分别见 [项目契约](project-contract.md) 与 [实施状态](implementation-status.md)。A2 开发 PR 仍须等待所有者验收，未经明确批准不得合并。

---
# A1 开发分支交接补充（2026-11-22）

本分支已实施 A1 只读 Script 入口，详见当前 [项目契约](project-contract.md) 和 [实施状态](implementation-status.md)。A2/A3/B/C 尚未实施。完整未来设计仍引用 PR #11 的最新实施方案；未经用户批准不合并 PR。下文为 main 在只读改造前的 Article v6 交接记录，仅用于历史追溯，不覆盖本分支当前契约，也不能作为新版测试证据。

---

# EnglishCards 开发交接（HANDOFF）

**交接日期：** 2026-11-22  
**仓库：** https://github.com/chenjing2000/englishcards  
**正式分支：** `main`  
**交接前已验收的代码提交：** `c7013a8454932c476308791583311cb5149928ae`（PR #10）  
**状态：** 前三批代码精简及文档收尾已完成；用户已明确要求**暂停性能与其他测试工作**，待新会话提出具体开发需求。

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
