import express from 'express';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRenderProject } from '../../EnglishCards/frontend/src/models/project';
import { SettingsStore } from './settingsStore';
import { describeLayoutMismatch, type LayoutDiagnostics } from '../../EnglishCards/frontend/src/services/layoutVerification';

const root = fileURLToPath(new URL('../../', import.meta.url));
const frontendRoot = resolve(root, 'EnglishCards/frontend');
const frontendDist = resolve(root, 'EnglishCards/.build/frontend-dist');
const app = express();
const port = Number(process.env.PORT ?? 4317);
const baseURL = `http://127.0.0.1:${port}`;
let busy = false;
app.use(express.json({ limit: '5mb' }));
const settingsStore = new SettingsStore(process.env.SETTINGS_PATH ?? resolve(root, '.build/test-runtime/settings.json'));
const initialSettings = await settingsStore.load();
if (initialSettings.error) console.warn(initialSettings.error);
app.get('/api/settings', async (_request, response) => { response.json(await settingsStore.load()); });
app.put('/api/settings', async (request, response) => {
  if (request.headers.origin && request.headers.origin !== baseURL) { response.status(403).send('只允许本机编辑器修改配置。'); return; }
  response.json(await settingsStore.save(request.body));
});
app.post('/api/render-page', async (request, response) => {
  if (request.headers.origin && request.headers.origin !== baseURL) { response.status(403).send('只允许本机编辑器请求页面渲染。'); return; }
  if (busy) { response.status(409).send('正在渲染另一个页面，请稍后重试。'); return; }
  busy = true;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let result: Buffer | undefined;
  let failure = '';
  try {
    const project = parseRenderProject(request.body.project);
    const requested = request.body.page as number | undefined;
    if (!Number.isInteger(requested) || requested! < 1) throw new Error('页码无效。');
    try { browser = await chromium.launch(); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (/Executable doesn't exist at/i.test(message)) throw new Error('页面渲染用的 Playwright Chromium 未安装或已被移除。请在项目目录运行 npx.cmd playwright install chromium，然后重试；已安装的 Chrome 和 Node.js 不能代替此组件。');
      throw reason;
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1800 }, deviceScaleFactor: 1 });
    await page.goto(`${baseURL}/render`);
    await page.waitForFunction(() => typeof window.renderProject === 'function');
    const signature = await page.evaluate(input => window.renderProject(input), project);
    if (signature !== request.body.signature) {
      const diagnostics = await page.evaluate(() => window.renderDiagnostics);
      const detail = diagnostics ? describeLayoutMismatch(request.body.diagnostics, diagnostics as LayoutDiagnostics) : '渲染页面缺少诊断信息，请重新构建、重启服务并刷新页面后重试。';
      throw new Error(`渲染与预览分页不一致：${detail}`);
    }
    const count = await page.locator('.card').count();
    if (requested! > count) throw new Error('页码无效。');
    result = await page.locator('.card').nth(requested! - 1).screenshot({ animations: 'disabled', timeout: 60000 });
  } catch (reason) {
    failure = `本地页面渲染失败：${reason instanceof Error ? reason.message : String(reason)}`;
  }
  finally {
    try { await browser?.close(); }
    catch (reason) { failure += `${failure ? '；' : '本地页面渲染失败：'}浏览器清理失败：${reason instanceof Error ? reason.message : String(reason)}`; }
    busy = false;
  }
  if (failure) response.status(400).type('text').send(failure);
  else response.type('png').send(result);
});
if (process.argv.includes('--production')) {
  app.use(express.static(frontendDist));
  app.get('/render', (_request, response) => response.sendFile(resolve(frontendDist, 'render.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: frontendRoot, configFile: resolve(root, 'tools/vite.config.ts'), server: { middlewareMode: true, host: '127.0.0.1', hmr: false } });
  app.use(vite.middlewares);
}
app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => response.status(400).send(`请求失败：${error.message}`));
app.listen(port, '127.0.0.1', () => console.log(`英语精读编辑器：${baseURL}`));
