# EnglishCards 项目总契约

> 本文件是项目唯一的总契约。当前产品行为以本文和仍然有效的专项规格为准；阶段计划、历史审查报告及旧版本文档不构成现行要求。

## 1. 产品与技术架构

- 产品：Windows x64 本地英语精读卡片编辑器。
- 技术栈：WPF + .NET 10 + WebView2 + React/TypeScript。
- WPF 负责窗口、原生文件夹对话框、文件系统访问、用户数据持久化和 ZIP 渲染/归档宿主；React 负责编辑器、预览和交互。
- 保持现有轻量架构；不迁移到 Tauri、Electron 或纯 WPF，不无必要引入重量级 MVVM、DI 容器或事件总线。
- 最终用户不需要 Node.js、npm、Express、Vite、Playwright 或 Chromium。
- 发布为 win-x64、Framework-dependent、PublishSingleFile。目标机器安装 .NET 10 Desktop Runtime x64 和 WebView2 Evergreen Runtime。
- 唯一正式发布输出目录为 `dist/EnglishCards/`。

## 2. 用户数据与兼容边界

- 用户数据位于实际 `EnglishCards.exe` 同级的 `userdata/`，包含设置、卡片馆路径、缓存、WebView2 Profile 和日志。
- 发布或升级不得删除 `userdata/`。
- 不扫描、不读取、不迁移、不删除旧版 `%LOCALAPPDATA%\\EnglishCards` 数据；不恢复旧版全局草稿。
- 不改变现有数据位置、部署方式或兼容策略，除非用户明确批准。

## 3. Article v6 数据契约

### 3.1 唯一正式格式

- 唯一正式格式为数字 `schemaVersion: 6`。v5 及更早格式拒绝；不静默迁移、不双写、不保留生产兼容路径。
- 顶层只允许：`schemaVersion`、`id`、`title`、`identityTag`、`content`、`vocabulary`、`translation`。
- `id` 为非空字符串；`title` 与 `identityTag` 必须存在且允许空字符串。
- `content` 和 `translation` 均包含 `paragraphs` 数组；每个段落仅包含 `id`、`text`。
- 正文、译文分别最多 999 段，各自从 `p001` 连续编号至 `p999`。两组可同时出现相同 ID，定位时必须带区域上下文。
- Vocabulary 最多 999 项，按数组顺序从 `v001` 连续编号至 `v999`。
- Vocabulary 统一使用 `word` 字段管理单词、词组和习语；保留 `ipa`、`highlight`、`senses` 等 schema 字段，不设置独立 expressions 集合。
- 拒绝未知字段、缺失字段、错误类型、超限内容及非连续/重复 ID。不得静默丢弃字段或截断内容。

### 3.2 生成质量约定

- Article Skill 生成的正文和译文段落不得为空。
- 单词词条（按空白分隔恰好一个 token）应提供英式音标、词性、含义、英文例句及中文例句翻译；不同词性分别列为 sense。
- 多词词条不设置词性和音标，但须提供含义、英文例句及中文例句翻译。
- 上述词汇质量要求约束 Skill 输出，不额外扩大为应用导入拒绝条件。

## 4. 卡片馆与编辑行为

- 左侧卡片馆以用户选择的目录为根，按需加载子目录；每个 Article 是独立 JSON 文件，点击 JSON 文件打开。
- 不引入卡片数据库、跨目录索引、递归后台监视或自动文件重命名/删除。
- 不提供桌面 JSON/TXT 导入按钮，不提供旧版全局草稿自动恢复。
- 编辑器顺序为 Vocabulary → Content → Translation；正文和译文分别采用连续多段落编辑区域。
- 左侧预览用于阅读和选择词汇；右侧独立编辑，通过 Article 数据模型同步。
- 预览选区加入 Vocabulary 的约束：同一文章、同一自然段；至少包含英文字母且不包含中文字符；新增词条使用 `word`，按规范化规则去重。
- 现行分页、预览、字体、布局和桥接细节见相关专项规格及生产实现；不得从历史阶段文档恢复旧 UI 约定。

## 5. 保存、切换与清空

- 卡片 JSON 自动保存到当前打开的原文件。保存绑定目标路径和不可变 Article v6 快照，并按修订版本串行写入。
- 保存期间拒绝切换卡片；被阻止的点击直接丢弃，不排队、不记忆目标卡片。保存完成后用户重新点击。
- 保存错误时保留内存修改和错误状态，不允许切换丢弃修改。
- 工具栏提供“清空当前文章”和“保存 JSON + ZIP”，不再提供“新建卡片”。
- 清空时：无未保存修改则直接清空；有未保存修改则提供“保存”“放弃”“取消”。保存必须等 JSON + ZIP 均提交成功后再清空；放弃只丢弃当前未保存修改，不删除已保存文件；取消不改变状态。
- 有未完成的保存任务时不得清空；先等待任务完成或提示用户完成保存。异步旧会话写入不得重新激活已清空文章。

## 6. JSON + ZIP 联合保存

- 用户选择目标文件夹；默认目录为最近一次成功记录的卡片馆路径。
- 按文章标题生成同名 `.json` 和 `.zip`，两者来自同一个不可变、已验证的 Article v6 快照及同一分页/渲染签名。
- ZIP 内含根目录 `article.json` 和所有页面 PNG（`images/page-001.png` 等）。
- 如果 JSON 或 ZIP 任一目标已存在，弹出统一前端覆盖确认窗口。使用现有 `phase-e-modal` 与 `phase-e-modal-heading` 样式；不使用原生 WPF MessageBox。
- 点击取消、关闭弹窗或点击遮罩均取消保存且不修改原文件；ESC 不作为取消方式（此行为已由用户接受）。
- 确认后同时替换 JSON 与 ZIP。两个文件系统提交不具备真正的跨文件原子性；实现必须使用同目录暂存、校验、备份、提交和尽可能的回滚，失败时保留/恢复原目标。
- 仅当两个文件均成功提交后，更新最近成功路径并将卡片馆根目录切换到目标目录。若偏好设置写入失败，应单独报告，不将已成功提交的文件对误报为失败。
- 取消或失败不得改变最近路径、活动文章或卡片馆根目录。

## 7. ZIP 技术契约

- ZIP 渲染与归档细节由 [EXPORT_CONTRACT.md](specs/EXPORT_CONTRACT.md) 定义；用户操作流程由 [COMBINED_ARTICLE_SAVE.md](specs/COMBINED_ARTICLE_SAVE.md) 定义。
- 预览和导出共享分页/渲染实现、字体回退顺序和同一快照。
- ZIP 必须在提交前验证 Article schema、归档条目、每张 PNG 的签名与尺寸，并完整读取 PNG 数据。
- 临时文件按任务隔离；取消/失败仅清理本任务暂存文件，不破坏已有目标。

## 8. 分页、图片与视觉一致性

- 分页逻辑以完整自然段为数据单元；视觉分页可拆分段落片段，但不得丢失、重复或重排字符。分页片段展平后必须与原文一致。
- 使用实际浏览器字体测量和同一渲染入口；首行缩进只作用于逻辑段落起点，续页不得重复缩进。
- 预览与 ZIP 渲染必须使用相同 Article 快照、分页签名、字体与会话资源。
- Article v6 不保存配套图片路径或 Base64。若当前生产流程加载会话级配套图片，预览和导出必须共用同一资源，不得在导出阶段重新搜索或泄露预览中已裁掉的区域。
- 当前布局与字体的具体常量以生产样式和有效专项规格为准，不从已删除的阶段计划推断。

## 9. 当前专项规格与 Skills

- [Phase E 卡片馆](specs/PHASE_E_CARD_LIBRARY.md)
- [JSON + ZIP 联合保存](specs/COMBINED_ARTICLE_SAVE.md)
- [ZIP 渲染与归档技术契约](specs/EXPORT_CONTRACT.md)
- [WPF/WebView2 宿主](specs/DESKTOP_WEBVIEW2.md)
- [编辑器桥接接口](specs/EDITOR_BRIDGE_CONTRACT.md)
- [Article v6 生成 Skill](skills/article-to-englishcards/SKILL.md)
- [项目代码审查 Skill](skills/project-code-review/SKILL.md)
- [Windows 应用审查 Skill](skills/windows-app-review/SKILL.md)

`docs/reference-assets/` 中的历史样本和截图是参考素材，不是现行 schema 或 UI 契约。历史报告和阶段计划不再作为常规项目文档维护。
