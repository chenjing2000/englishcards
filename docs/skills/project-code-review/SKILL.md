---
name: project-code-review
description: Use when a user requests a comprehensive project code review, cleanup, and necessary refactoring with verification and GitHub submission. Does not apply to creating, moving, or editing skill documentation.
---

# 项目代码审查与整理

请对整个项目进行一次全面的代码审查、整理与必要的重构，遵循以下要求：

1. **架构设计**：按下述 MVVM 设计要求检查模块划分、职责分配及函数设计，确保模块内部高内聚、模块之间低耦合，避免职责混乱和不必要的依赖。
2. **代码质量**：检查程序逻辑、命名、异常处理及可读性，消除不必要的复杂性、冗余与重复。优先采用简单、直接、清晰的实现方式，避免过度设计、过度抽象和不必要的高级语法。允许少量简单重复，但应合理复用复杂的重复逻辑。仅在能够降低整体复杂度、提高可维护性时引入抽象。不以减少代码行数、函数或模块数量为目标。
3. **问题整改**：修复发现的设计缺陷、潜在错误及其他必要问题。坚持最小必要修改原则，保持与本次获批重构无关的现有功能、外部接口及预期行为不变；对用户明确批准的 Article v6、目录迁移和界面改造按新规范实施。对于已经合理的实现，不做无意义的重构；对于可能改变功能或涉及重大架构调整的问题，先提出方案，不擅自实施。
4. **项目清理**：清理确认无用的文件、临时文件及构建垃圾，必要时完善 .gitignore。不得误删项目资源、配置及用户数据。同步更新相关文档，确保文档与实际代码一致。
5. **验证与提交**：完成修改后，运行适用的构建、测试及静态检查，确认没有引入新的问题。检查 Git 状态，保留原有未提交改动，不擅自切换或合并分支，仅提交本次任务涉及的修改。未经用户明确授权，不执行 commit、push、tag 或修改远程仓库。若验证失败或提交条件不满足，说明原因，不强行提交或推送。

最后，简要报告发现的主要问题、整改内容、删除的文件、验证结果、Git 提交记录及尚未解决的问题。

## MVVM 设计要求

本项目采用轻量 MVVM。遵循现有 React / TypeScript 实现，不为套用名称而引入额外框架。

- **Model（`EnglishCards/frontend/src/v6/article.ts`；当前 v5 过渡模型位于 `EnglishCards/frontend/src/models/project.ts`）**：Article v6 结构、严格校验、编号、导入及不依赖界面的数据规则应以 v6 模型为准；完成集成后删除 v5 过渡模型。不得依赖 View、React 组件、DOM、浏览器存储或 HTTP 服务。
- **ViewModel（`EnglishCards/frontend/src/viewmodels/`）**：持有编辑状态，协调撤销重做、增删排序、选中条目、保存和导出等操作命令；调用 Model 和 Services，向 View 暴露状态和命令。现有自定义 Hook 即 ViewModel，不必改为类。不得直接查找或修改界面 DOM，也不得自行拼接表单 JSX。
- **View（`EnglishCards/frontend/src/views/`）**：展示和绑定状态、转发编辑命令，管理焦点、光标/选区、滚动、缩放和 DOM 挂载等界面细节。纯界面临时状态可在 View 内；项目数据规则、持久化、历史栈和导出请求不得复制到 View。不要把 View 中所有 `useState` 一律搬走。
- **Services（`EnglishCards/frontend/src/services/`）**：集中实现文件/草稿 IO、网络请求、分页测量及导出校验等独立能力。分页服务因职责需要可使用 DOM/Canvas，但不拥有编辑器状态，也不引用 View 或 ViewModel。
- **Server（`tools/test-server/`）**：负责本机 HTTP、后台 Chromium、PNG/ZIP 导出和资源释放；可复用共享模型及校验规则，不混入客户端状态或 UI 控件逻辑。
- **依赖与入口**：View 调用 ViewModel；ViewModel 调用 Model / Services；Services 可依赖 Model；Model 不反向依赖其他层。`EnglishCards/frontend/src/main.tsx` 仅作应用与渲染入口。避免跨层循环依赖，不为消除少量重复添加 DI 容器、事件总线或通用仓储。
- **修改边界**：新增能力放入相应职责目录，复用现有直接清晰的调用链。已有分层合理时只做局部修改；必要的迁移同步调整导入和调用方，保持已确认的 Article v6、EXE 同级 userdata、撤销重做、草稿、预览与 ZIP 导出契约，按受影响路径验证。
- **格式同步**：调整项目字段或导入规则时，同时检查 `docs/skills/article-to-englishcards/SKILL.md` 的 JSON 契约、完整示例和校验脚本，使用实际 `parseArticleV6` 验证，避免 skill 与程序各维护一套互相矛盾的格式。
