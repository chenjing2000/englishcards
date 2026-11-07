# EnglishCards 项目契约

> **当前状态（2026-11-07）：** 用户已批准从 schemaVersion 5 破坏性升级至 Article v6。Article v6 数据模型、独立 JSON/TXT 导入基础及其单元测试已经建立；本轮完成了生产源码、测试、Skills、工具和构建输出目录的重组。桌面应用的实际读写、WPF 桥接、右侧编辑器、左侧预览及 ZIP 导出仍待接入 v6。过渡期间不得把 v5 与 v6 混合写入同一项目，也不得宣称整个应用已经完成 v6。

## 1. 产品定位与技术边界

EnglishCards 是 Windows x64 本地英语精读卡片编辑器，正式产品采用 **WPF + WebView2 + React/TypeScript**。

- React 负责文章编辑状态、界面、样式设置、分页和卡片预览。
- WPF 负责 Windows 窗口、原生文件对话框、用户数据持久化、WebView2 宿主及正式 ZIP 导出。
- 不迁移到 Tauri、Electron 或纯 WPF；不增加 C++ Native Launcher。
- 不引入重量级 MVVM、DI 或事件总线框架。
- Node.js/npm、Express、Vite、TypeScript、Playwright/Chromium 仅用于开发、构建和测试，不属于最终用户运行依赖。
- 不提供账号、云同步或在线文章处理。

## 2. Article v6 正式数据契约

### 2.1 顶层结构

Article v6 是唯一目标数据格式，`schemaVersion` 必须为数字 `6`。v5 及更早版本不兼容，不提供自动迁移、双写或静默兼容。

```typescript
interface Article {
  schemaVersion: 6;
  id: string;
  title: string;
  identityTag: string;
  content: { paragraphs: Paragraph[] };
  vocabulary: VocabularyItem[];
  translation: { paragraphs: Paragraph[] };
}

interface Paragraph {
  id: string; // p001–p999
  text: string;
}

interface VocabularyItem {
  id: string; // v001–v999
  word: string;
  ipa?: string;
  highlight: string[];
  senses: Sense[];
}

interface Sense {
  pos: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
}
```

### 2.2 字段与容量

- `title` 必须存在，允许空字符串。
- `identityTag` 替代旧 `personalizedHeader`，必须存在，允许空字符串，并继续承担卡片页眉显示功能。
- `content.paragraphs` 和 `translation.paragraphs` 分别最多 999 段，各自从 `p001` 连续编号至 `p999`。
- `vocabulary` 最多 999 项，按当前顺序从 `v001` 连续编号至 `v999`。
- 段落和词汇 ID 在各自集合内连续编号；正文与译文可以同时存在 `p001`，二者定位时必须带集合/区域上下文。
- 删除段落或 Vocabulary 项后，相关集合按当前顺序重新编号。ID 表示集合中的顺序位置，不是永久身份。
- Vocabulary 统一管理单词、词组、习语及用户选择的英文内容，核心字段保持 `word`。保留 `ipa`、`highlight`、`senses` 等已有辅助能力；不再使用独立 `expressions` 集合。
- 删除 `expressions`、`mainIdea`、`source`、`personalizedHeader`、`readingLevel`、`theme` 和 Article 顶层 `warnings`。运行时警告属于 UI 状态，不属于文章数据。
- 正文和译文自然段文本不能为空；字段和数组严格校验，未知字段拒绝，不静默丢弃。

### 2.3 TXT 与 JSON 导入

- 提供独立 `ArticleJsonImporter` 和 `PlainTextImporter`，由统一导入协调器负责调用。
- 先尝试 Article v6 JSON 解析；只有可以确定为普通文本的输入才允许回退 TXT。
- JSON 文件语法错误、schemaVersion 不是 6、缺字段、多余字段、ID 不连续或超出容量时，必须拒绝导入，不得把 JSON 内容静默当作正文。
- TXT 文件名（去掉扩展名）作为默认 `title`；`identityTag` 默认为空，`vocabulary` 和 `translation.paragraphs` 默认为空。
- TXT 采用 UTF-8；识别 BOM、CRLF、LF 和 CR。一个或多个空行分隔自然段，单个换行转换为空格。
- 正文或译文超过 999 段、Vocabulary 超过 999 项时拒绝本次操作，保留当前 Article，不截断、不部分导入。

## 3. 编辑器与选区目标行为

### 3.1 右侧编辑器

- 所有编辑内容放在同一个 TabPage。
- 顺序为 **Vocabulary → Content → Translation**。
- Vocabulary 位于第一个编辑区，正文第二，译文第三。
- 正文和译文各使用一个连续的多段落编辑区域，不为每个自然段落创建独立输入框；向下滚动编辑完整文章。
- 标题使用独立输入框，位于正文上方；标题可独立修改。
- 右侧只负责编辑，不提供选词加入 Vocabulary 的交互。

### 3.2 左侧预览与 Vocabulary 选择

- 左侧显示完整文章并自动分页；段落是数据结构和分页单元，不再按段落分段导入或分段编辑。
- 鼠标选中文字后，在选区右下角显示圆角方形加号；无 Tooltip。
- 选区必须在同一张卡片、同一个自然段内，不允许跨卡片或跨自然段。
- 选区必须至少包含一个英文字母（A–Z/a–z），且不得包含中文字符；纯数字、纯空白和含中文的混合选区不显示加号。
- 可以选择单词、多个单词、词组或习语；不做词性、词组或习语分类。
- 点击加号时必须在焦点变化前保存选区文本；执行空白规范化和大小写不敏感去重。重复项不新增、不覆盖现有释义。
- 新增条目写入 `vocabulary`，使用 `word` 字段，并保留现有义项编辑能力。

## 4. 分页、预览与渲染

- 保留当前分页引擎的字体测量、逐行布局、分页连续性校验等成熟算法；先改数据输入和段落映射，不无故重写测量算法。
- `EnglishCards/frontend/src/services/pagination.ts` 是当前分页实现入口；修改前检查调用方以及预览/导出共用关系。
- 预览和导出必须基于同一 Article 快照、字体回退顺序、分页规则和渲染入口。
- 段落 ID 重新编号后，分页和高亮定位必须使用区域上下文，不能仅凭 `p001` 在正文和译文之间定位。
- 英文内置 Nunito Sans，仅包含 Latin / Latin Extended 的 400 与 800 字重。
- 中文使用 Windows 系统字体回退：Microsoft YaHei UI、Microsoft YaHei、DengXian、sans-serif。
- 默认画布 1200×1600；实际输出尺寸遵循样式设置。
- 字体未就绪或分页/渲染校验失败时，不得提交错误导出。

## 5. 正式 ZIP 导出

- 唯一用户导出入口为**导出全部 ZIP**，不提供单页 PNG 或 PNG-only 导出。
- ZIP 包含根目录 `article.json` 和 `images/page-001.png` 等全部页面图片。
- `article.json` 使用 UTF-8 无 BOM、2 空格缩进、中文不转义、末尾换行；完成 v6 集成后必须保存完整 Article v6，不含样式配置或运行时字段。
- 保留现有 Win11 风格 WPF 导出进度对话框、取消流程、任务临时文件清理及原 ZIP 保护行为。
- 取消时必须等待渲染/写入停止并清理当前任务临时 ZIP，不得损坏已有 ZIP。

## 6. 运行环境与发布

| 项目 | 要求 |
|---|---|
| 操作系统/架构 | Windows x64 |
| 桌面框架 | .NET 10 WPF |
| 发布模式 | Framework-dependent、单文件、win-x64 |
| .NET 运行依赖 | 兼容的 .NET 10 Desktop Runtime x64 |
| WebView2 | Microsoft Edge WebView2 Evergreen Runtime |
| Node.js | 最终用户不需要 |
| Express/Playwright/Chromium | 最终用户不需要 |

目标机缺少兼容的 .NET 10 Desktop Runtime x64 时，用户需通过 Microsoft 官方入口安装后重新启动。保持 Framework-dependent，不实现自定义 Runtime 下载器，不增加 Native Launcher。

WebView2 使用 Evergreen Runtime；缺失或初始化失败时提供可理解的错误及 Microsoft 官方安装/修复入口。

## 7. 用户数据与文件保护

- 数据根目录为真实 EXE 所在目录同级 `userdata/`，不是当前工作目录、快捷方式目录或 LocalAppData。
- 首次启动自动创建；目录不可写或创建失败时明确报错，不静默回退到其他位置。
- 不读取、不迁移、不合并、不提示迁移旧版 `%LOCALAPPDATA%\EnglishCards\` 数据；新版也不主动删除旧目录。
- 发布/更新不得清理 `userdata/`；发布脚本只处理应用产物。
- 用户数据不纳入源码包、Git 提交或 GitHub Release。

## 8. 仓库目录和构建约定

```text
EnglishCards/
├── desktop/                 # WPF 主程序、WebView2、持久化和 ZIP 导出
├── frontend/                # React/TypeScript、前端入口及运行资源
└── .build/                  # Vite 嵌入资源，自动生成、可删除重建

EnglishCards.Tests/
├── dotnet/                  # .NET 桌面测试
└── frontend/
    ├── unit/                # Vitest
    └── e2e/                  # Playwright

docs/                        # 项目文档、规格、审查记录和历史材料
skills/                      # 项目专属 Skills
tools/                       # 构建、测试、发布及开发期测试服务
.build/                      # 测试结果、报告和临时运行数据
dist/EnglishCards/           # 唯一正式发布目录
```

- `package.json`、`package-lock.json`、`tsconfig.json`、`AGENTS.md`、`README.md` 为仓库级配置，保留在根目录。
- 不保留固定 `artifacts/` 目录。前端构建输出位于 `EnglishCards/.build/frontend-dist/`；测试输出位于根 `.build/`。
- `node_modules/`、`.build/`、`EnglishCards/.build/`、`bin/`、`obj/` 和 `dist/` 不提交 Git。
- 正式发布仅输出到 `dist/EnglishCards/`，不同时维护 `dist/wpf`、`publish`、`release` 等重复发布目录。

## 9. 构建与测试命令

在仓库根目录执行：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

单元测试、浏览器 E2E、.NET 桌面测试和真实 Windows/WebView2 实机验收是不同层级，报告必须区分通过、失败、跳过和未验证。

## 10. 当前迁移状态

- 已完成：Article v6 独立数据模型、严格校验、JSON/TXT 导入基础、v6 单元测试；目录迁移至 `EnglishCards/`、`EnglishCards.Tests/`、`skills/`、`tools/`；构建输出目标改为 `.build`。
- 尚未完成：将 WPF 桥接、自动草稿、项目打开/保存、React 编辑器、预览、高亮和 ZIP 导出全部迁移到 Article v6；删除 v5 生产模型及旧分区 UI；在迁移后的目录结构上完成 Windows .NET 测试与正式发布。
- 用户最近报告的验证结果：Vitest 46/46、Vite 构建成功、Playwright 61/61、.NET Release 发布成功。该日志对应目录迁移前的测试修复包；目录重组后的新路径尚未在 Windows 上验证。
