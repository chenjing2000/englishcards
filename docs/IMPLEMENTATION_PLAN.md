# 英语精读编辑器实施计划

> 本文是初次交接时的历史实施计划。下述“没有既有代码或 Git 仓库”等环境说明仅适用于当时；当前启动方法与目录以 [README](../README.md) 为准。

依据：HANDOFF.md、docs/specs/ACCEPTANCE.md、docs/specs/DATA_AND_PAGINATION.md。用户已要求直接实施，设计不重新审批；当前目录没有既有代码或 Git 仓库，不建分支、不提交。

架构：React/TypeScript/Vite 编辑器，Zod 版本化 JSON；独立 DOM Range 实测行模块输出稳定 sourceId/start/end 片段；预览与本地 Playwright PNG 导出共用同一渲染器。Node 仅监听 127.0.0.1，不上传文章。字体随 npm 包本地提供。

## Phase 1 骨架与数据
- [x] 先写数据迁移、非法输入、精确高亮编辑迁移测试并确认失败。
- [x] 实现版本 1 到 2 迁移、稳定 ID、全部受控字段、JSON 保存/打开、草稿、撤销/重做。
- [x] npm test 验证文章/译文独立快照与样例一致。

## Phase 2 分页
- [x] 先写 Chromium 集成用例：长例句、长译文、组合字符、两栏词汇与区间连续性。
- [x] Range 按 grapheme 测量行，逐行流入可用内容区域；片段保留原文区间，续段不缩进；不可用尺寸报错。
- [x] 文章后完整呈现词汇，再连续呈现表达、主旨、译文；不强制模块换页，不以 10 页截断。
- [x] 验证每个逻辑块的字符覆盖及每页几何边界。

## Phase 3 编辑与导出
- [x] 全字段编辑、稳定 ID 增删/上下排序、单处高亮/取消、失配提示、手动分页、样式面板、预览点击定位。
- [x] 本地 Node + Playwright 导出，等待字体，比较预览分页指纹；单 PNG 与 ZIP，附带项目 JSON。
- [x] 构建后离线运行；草稿失败与导出失败有提示。

## Phase 4 验收
- [x] 执行单元、E2E、构建；真实编辑并保存重开；PNG 尺寸、ZIP、重复导出像素比较。
- [x] 生成 demo PNG/ZIP 与实际编辑器截图。
- [x] README 提供 PowerShell 新装/运行/测试说明；IMPLEMENTATION_REPORT 逐条记录 20 项覆盖与局限。

重点回归：导入恶意/坏版本、同词第二处高亮、文本替换高亮失配、极长无空格 token/emoji、空段、极大样式、草稿与下载状态、导出期间并发编辑。
