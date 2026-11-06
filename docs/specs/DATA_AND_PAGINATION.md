# 数据模型与分页引擎说明

> 本文保留最初交接时的设计建议，不代表全部功能已经实现。当前仅支持 schema 3（不兼容旧格式）、已实现功能与明确简化以 `README.md` 和 `src/models/project.ts` 为准；整理复验记录见 `docs/CODE_REVIEW_REPORT.md`。文中代码路径相对于项目根目录。Markdown 导出、单元素样式及孤行优化尚未实现。

## 项目文件

`assets/projects/brainco/project.json` 是从 V17 页面逆向提取的**可导入样例初稿**，不是最终的数据 schema。字段含 title、source.paragraphs、vocabulary、expressions、mainIdea、translation.paragraphs、theme、layoutOverrides。可参考并迁移为 Zod schema，保留 `schemaVersion` + 稳定 ID。

`highlights[]` 当前仅包含原样词组文本提示；**不能作为唯一的精确标注存储机制**，因同词多次出现，且用户可能只标记其中一次。建议在加载旧 fixture 时解析为稳定区间（paragraphId、range、quotedText、校验 hash），编辑时应用 transaction/map，保存时回写新 schema。失配则提示重新确认，严禁无声错位。

`article.md` 和 `translation.md` 是编辑之外的校验快照。项目 JSON 可作为 UI 当前权威数据，但导出 Markdown 应和 JSON 保持一致。

## 内容块/分页的推荐设计

渲染逻辑区分**逻辑内容结构**与**视觉页面片段**：
- 逻辑节点：articleParagraph、vocabColumnChunk、expressionEntry（由 phrase/meaning/example/exampleTranslation 四子节点组成）、mainIdea、translationParagraph、sectionHeading。
- 不可复制的节点身份稳定；实际分页将它切为若干 page fragment，每个 fragment 持有 source ID、文本区间或 layout range。
- 基于实际浏览器字体测量宽度和行高，二分文本可容纳的**可见行数/字符范围**；避免孤立代理对、合字、CJK 标点、组合音标与抓取样式丢失。可利用 DOM Range 的 `getClientRects()` 实测每行；HTML/CSS 在预览与导出环境中使用同一套变量。
- 不要简单用 `break-inside: avoid` 处理 `.note`；短语、释义、英文例句、中文翻译彼此可以分开；例句自身多行也能分页。
- 空间不足时从当前已绘制行后准确截断，下一页承接未输出字符；数据流只消费一次。最好在分页器中建立一份所有 page fragment 覆盖原文区间的连续性断言。
- 首行缩进由 `isLogicalParagraphStart` 决定，而不是新页是否有一个 `<p>` 标签决定；续页不能重复首行缩进。
- 尽量避免孤立行，但**不能**因为孤行控制遗留大空白或删除内容；增加可配置软规则。
- Article 与对应 Vocabulary 存在配套关系：V17 分两页英文，每页单独 Vocabulary；MVP 可先实现文章逐行分页，再按这一视觉意图分配对应页词汇；若实现成本高，应说明明确可预期的简化路径，并确保英文/词汇都完整。
- 正文某一重点词组不应在视觉上改变行高，重点字号继承正文。强调长词组在正常行断处允许分行，不得强行避免换行导致溢出。

## 样例项目与参考 HTML 的差异

- V17 参考 HTML 曾手工分页，第二段英文跨页部分拆成两个 `<p>`；项目 JSON 必须保留两段完整原文。
- V17 中文译文用了 `.zhline` 类，旧 CSS 中可能仍是 36px；最新需求已改为实际 32px。
- V17 HTML 将注释分散在多页，只有第一个标题；新分页器必须从一份 expressions 数组自动重排，而非把每页 HTML 当作数据。
- V17 参考 ZIP 中的历史排版可能有空白；实现优先遵循“页内尽量填满，不以词条为分页硬边界”。

## 测试夹具建议

制作可以确定各类跨页位置的 fixture：很短的项目、极长英文句、长中文译文、双栏词汇多行折行、包含 emoji/组合字符、高亮仅命中第 2 次出现、翻译段落中混合英数和标点；为每个可分页文本建立 `flatten(pageFragments) == originalText` 断言。
