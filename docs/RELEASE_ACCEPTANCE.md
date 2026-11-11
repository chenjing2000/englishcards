# EnglishCards — Windows x64 验收记录

**产品基线：** Article v6 + Phase E Card Library + JSON/ZIP paired save
**最新源码基线：** `822864ff99787395b21b040a0b0fccc0c62e2fc6`
**状态：** 项目所有者已确认 Windows/WPF 本地验收通过；外部干净机器与公开发布前置检查仍需单独处理。

## A. 已完成的 Windows 验收

### Phase E 基线

项目所有者提供并确认的验收结果：

| 检查 | 结果 |
|---|---|
| Vitest | PASS — 64/64 |
| Playwright | PASS — 69/69 |
| .NET 桌面测试 | PASS — 19/19 |
| TypeScript / Vite 生产构建 | PASS |
| Article v6 Skill 校验 | PASS |
| Windows x64 Framework-dependent 发布 | PASS |
| WPF / WebView2 启动与关键 UI 实机验收 | PASS |
| GitHub Windows CI | PASS |

以上计数属于 Phase E 基线。后续联合保存与清空工作流已另行完成；项目所有者确认了 Windows 本地验收，但本记录不把上述数字表述为后续改动的独立测试计数。

### JSON + ZIP 联合保存与清空

- 保存从单独 ZIP 导出操作调整为同名 JSON + ZIP 联合保存。
- JSON 与 ZIP 使用同一 Article v6 快照；覆盖任一目标时先显示统一前端确认。
- 清空流程包含保存、放弃、取消；保存任务未完成时不允许清空。
- 覆盖弹窗复用 `phase-e-modal` 与 `phase-e-modal-heading`，不使用原生 WPF MessageBox。
- 用户实机确认：取消按钮和点击遮罩均可取消覆盖；ESC 不支持取消，该行为按用户决定保留。
- 后续提交 `822864ff99787395b21b040a0b0fccc0c62e2fc6` 完成联合保存与清空工作流。

## B. 发布环境要求

- Windows x64。
- Microsoft .NET 10 Desktop Runtime x64。
- Microsoft Edge WebView2 Evergreen Runtime。
- 最终用户不需要 Node.js、npm、Visual Studio、.NET SDK、Vite、Playwright 或 Chromium。
- 发布模式为 Framework-dependent、win-x64、PublishSingleFile；保留发布输出目录中的所有必要文件，不只复制 EXE。
- 用户数据在 EXE 同级 `userdata/`；升级不得删除该目录。不扫描或迁移旧版 `%LOCALAPPDATA%\\EnglishCards`。

## C. 可复现构建与测试

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Article v6 Skill 验证：

```powershell
npx.cmd tsx docs/skills/article-to-englishcards/scripts/validate-project.ts
```

## D. 外部发布前仍需独立核实

以下事项不因本地开发机验收通过而自动视为完成：

- [ ] 在隔离的干净 Windows x64 环境验证 .NET 10 Desktop Runtime 与 WebView2 Evergreen 前置条件及启动提示。
- [ ] 在便携目录验证首次创建 `userdata/`、移动目录后的数据可用性。
- [ ] 在一次性副本上验证发布/升级不会破坏 `userdata/`；不要在含真实数据的目录中做破坏性测试。
- [ ] 核实仓库内样例文章、图片等公开分发素材的授权。
- [ ] 明确正式版本号、发布标签和 GitHub Release；本记录不表示已创建 Release 或发布标签。

浏览器 E2E 不替代真实 WPF/WebView2 验收。发布决策应依据目标机器实测，不将未执行项目标为通过。
