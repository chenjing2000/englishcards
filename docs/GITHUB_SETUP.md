# EnglishCards：GitHub 首次推送指南

本指南针对**首次创建仓库**，不是更新已有仓库。所有命令从解压后的 `EnglishCards` 项目根目录执行；建议先在 GitHub 创建一个**空仓库**（不要预先添加 README、`.gitignore` 或 LICENSE，以避免首次推送历史冲突）。本项目不代替用户操作 GitHub，也不会自动推送。

## 1. 首次公开前检查

- 检查 `assets/projects/`、`assets/reference/` 中的文章、图片、参考材料是否获得公开分发许可；如果没有，请在首次提交前移除或替换相关内容。**不要将未确认授权的第三方内容直接放入公开仓库。**
- 检查 `docs/`、`src/`、测试和历史报告中是否包含内部路径、隐私信息、凭据或不适合公开的内容。
- 检查 Git 状态中没有 `userdata/`、`.env`、`node_modules/`、`dist/`、`artifacts/dist/` 等构建和个人数据。
- 不需要把 Visual Studio、Node.js、.NET Runtime、Chromium 或 WebView2 Runtime 打包到源码仓库中。
- 如果 GitHub 仓库为公共仓库，代码和提交历史中的内容通常可被公众访问；请在首次 `git add` 前完成核对。

## 2. 初始化 Git 仓库

从项目根目录执行：

```bat
git init -b main
git status --short --ignored
```

确认忽略规则：

```bat
git check-ignore -v node_modules\dummy dist\wpf\EnglishCards.exe dist\wpf\userdata\settings\settings.json artifacts\dist\index.html
```

`git check-ignore` 应显示上述路径被忽略。**不要使用 `git add -f` 强制添加运行数据或构建产物。**

## 3. 创建首次提交

```bat
git add .
git status --short
git diff --cached --stat
git commit -m "Initial commit: EnglishCards Windows desktop editor"
```

使用 `git status --short` 核对待提交内容。建议提交源码、`package.json`、`package-lock.json`、README、项目契约、测试代码以及经版权确认可发布的示例文件。

如果 Git 提示没有作者信息，可以仅为当前仓库设置：

```bat
git config user.name "Your Name"
git config user.email "you@example.com"
```

请替换为你自己的名称与邮箱，然后重试提交。可在 GitHub 使用 `noreply` 邮箱保护隐私。

## 4. 绑定 GitHub 远程仓库并推送

先在 GitHub 网站创建名为 `EnglishCards` 的**空仓库**，复制它的真实 HTTPS 或 SSH URL，然后执行：

```bat
git remote add origin https://github.com/OWNER/EnglishCards.git
git push -u origin main
```

将 `OWNER` 换成真实的 GitHub 用户名或组织名；上述 URL **只是占位符**。如需使用 SSH，请换成 GitHub 提供的 SSH 地址。使用 HTTPS 时按照 Git Credential Manager / GitHub 的登录流程认证，不要把个人访问令牌写进源码或命令文档。

推送后可通过下面的命令确认：

```bat
git status
git remote -v
```

如果已经存在 `.git` 或远程仓库含有提交，则不要直接套用首次初始化流程；应先查看现有历史和分支。

## 5. 日常开发与发布

更新源码后：

```bat
git status
git add .
git commit -m "Describe the change"
git push
```

本项目**优先直接使用** `dotnet publish` 发布，不把 `.ps1` 作为默认入口：

```bat
npm.cmd ci
npm.cmd test
npm.cmd run build
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf
```

可选择运行 `npm.cmd run test:e2e` 进行 Playwright E2E 测试；必要时先运行 `npx.cmd playwright install chromium`。浏览器测试与真实 WPF 验收应分别记录。

`dist/` 和 `artifacts/` 下的构建产物不进入源码提交。以后如果发布可下载的 EXE，可考虑 GitHub Releases，**不要用 `git add -f` 把 EXE 混入源码仓库**。

## 6. 避免误提交的提醒

- `.gitignore` 仅对**未被 Git 跟踪**的文件有效。已经提交过的敏感文件需要从 Git 索引和历史中额外处理，不能指望后来补一条忽略规则就清除历史。
- 如果后来添加新的数据目录、工具缓存或本地配置，要同步检查 `.gitignore`。
- `userdata/` 及其中的 JSON 文章、草稿、导出文件不属于源码仓库。`assets/` 中现有内容是测试/参考素材，不是用户运行数据；公开前依然需要版权和隐私审查。
- 当前程序的完整 Windows 实机验收未结束，首次提交不意味着正式发布已完成。
